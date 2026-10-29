"""文字起こしの WebSocket サーバー。API サーバー（server/）からだけ使う内部の口。

手順は docs/asr-worker-protocol.md。
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status

from .engine import AsrEngine
from .settings import WorkerSettings
from .stream_session import StreamSession

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("kikitori_asr")

settings = WorkerSettings.from_environment()
engine: AsrEngine | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global engine
    engine = AsrEngine(settings)
    logger.info("モデルを読み込みました: %s", settings.model)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict:
    return {"ready": engine is not None, "model": settings.model, "language": settings.language}


def _is_authorized(websocket: WebSocket) -> bool:
    if settings.access_token is None:
        return True
    return websocket.headers.get("authorization") == f"Bearer {settings.access_token}"


@app.websocket("/v1/stream")
async def stream(websocket: WebSocket) -> None:
    if not _is_authorized(websocket):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    if engine is None:
        await websocket.send_json({"type": "error", "message": "モデルを読み込み中です"})
        await websocket.close()
        return

    start = await websocket.receive_json()
    if start.get("type") != "start":
        await websocket.send_json({"type": "error", "message": "最初に start を送ってください"})
        await websocket.close()
        return

    events: asyncio.Queue[dict] = asyncio.Queue()
    session = StreamSession(
        engine=engine, settings=settings, context=str(start.get("context") or ""), events=events
    )
    sender = asyncio.create_task(_send_events(websocket, events, session))
    await websocket.send_json({"type": "ready", "model": settings.model})
    try:
        while not session.finished.is_set():
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                session.cancel()
                break
            if message.get("bytes") is not None:
                session.push_pcm16(message["bytes"])
                continue
            command = json.loads(message.get("text") or "{}")
            if command.get("type") == "stop":
                session.stop()
            elif command.get("type") == "cancel":
                session.cancel()
    except WebSocketDisconnect:
        session.cancel()
    await sender


async def _send_events(websocket: WebSocket, events: asyncio.Queue[dict], session: StreamSession) -> None:
    try:
        while True:
            event = await events.get()
            await websocket.send_json(event)
            if event["type"] in ("end", "error"):
                break
    except (WebSocketDisconnect, RuntimeError):
        session.cancel()
        return
    await websocket.close()
