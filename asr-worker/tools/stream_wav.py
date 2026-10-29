"""音声ファイルを話す速さで文字起こしの常駐プロセスへ流し、届いた知らせと時刻を記録する。

使い方:
  python tools/stream_wav.py ws://127.0.0.1:8781/v1/stream input.wav --log out.jsonl
入力は ffmpeg で 16kHz・モノラル・16bit に変換してから流す。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import time

import websockets

SAMPLE_RATE = 16000
# 話し手の端末と同じく 100ms ずつ送る
FRAME_MS = 100
FRAME_BYTES = SAMPLE_RATE * 2 * FRAME_MS // 1000


def read_pcm16(path: str, start_sec: float, duration_sec: float | None) -> bytes:
    command = ["ffmpeg", "-v", "error", "-ss", str(start_sec)]
    if duration_sec is not None:
        command += ["-t", str(duration_sec)]
    command += ["-i", path, "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"]
    return subprocess.run(command, check=True, capture_output=True).stdout


async def run(arguments: argparse.Namespace) -> None:
    pcm = read_pcm16(arguments.input, arguments.start, arguments.duration)
    headers = {"Authorization": f"Bearer {arguments.token}"} if arguments.token else {}
    records: list[dict] = []
    async with websockets.connect(arguments.url, additional_headers=headers, max_size=None) as socket:
        await socket.send(json.dumps({"type": "start", "context": arguments.context}))
        ready = json.loads(await socket.recv())
        started = time.perf_counter()
        stop_sent_at: float | None = None

        async def receive() -> None:
            async for message in socket:
                event = json.loads(message)
                event["t"] = round(time.perf_counter() - started, 3)
                records.append(event)
                if event["type"] in ("segment", "error", "end"):
                    print(json.dumps(event, ensure_ascii=False), flush=True)
                if event["type"] in ("end", "error"):
                    return

        receiver = asyncio.create_task(receive())
        for offset in range(0, len(pcm), FRAME_BYTES):
            await socket.send(pcm[offset : offset + FRAME_BYTES])
            # 実際の話す速さに合わせる（送るのが早すぎると、途中結果の間隔を測れない）
            target = started + (offset + FRAME_BYTES) / (SAMPLE_RATE * 2)
            await asyncio.sleep(max(0.0, target - time.perf_counter()))
        stop_sent_at = time.perf_counter() - started
        await socket.send(json.dumps({"type": "stop"}))
        await receiver

    partials = [r for r in records if r["type"] == "partial"]
    segments = [r for r in records if r["type"] == "segment"]
    end = next((r for r in records if r["type"] == "end"), None)
    summary = {
        "type": "summary",
        "model": ready.get("model"),
        "audioSec": round(len(pcm) / (SAMPLE_RATE * 2), 2),
        "partials": len(partials),
        "segments": len(segments),
        "partialDecodeMsMax": max((p["decodeMs"] for p in partials), default=None),
        "partialDecodeMsAvg": round(sum(p["decodeMs"] for p in partials) / len(partials), 1) if partials else None,
        "closedToFinalMsMax": max((s["closedToFinalMs"] for s in segments), default=None),
        "stopToEndMs": round((end["t"] - stop_sent_at) * 1000, 1) if end and stop_sent_at else None,
        "text": "".join(s["text"] for s in segments),
    }
    print(json.dumps(summary, ensure_ascii=False))
    if arguments.log:
        with open(arguments.log, "w", encoding="utf-8") as log_file:
            for record in [*records, summary]:
                log_file.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("input")
    parser.add_argument("--start", type=float, default=0.0)
    parser.add_argument("--duration", type=float, default=None)
    parser.add_argument("--context", default="")
    parser.add_argument("--token", default=None)
    parser.add_argument("--log", default=None)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
