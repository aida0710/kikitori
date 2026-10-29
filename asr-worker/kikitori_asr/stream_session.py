"""1 本の音声ストリーム。区切りごとに途中結果を出し直し、区切りが閉じたら確定した文を出す。

解き直しは同時に 1 本だけ走らせる。閉じた区切りの確定を、話し中の区切りの途中結果より先にする
（確定した文を待っている相手が先にいるため）。
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

import numpy as np

from .engine import SAMPLE_RATE, AsrEngine
from .settings import WorkerSettings
from .speech_segmenter import SpeechSegmenter

logger = logging.getLogger(__name__)


@dataclass
class Segment:
    index: int
    chunks: list[np.ndarray] = field(default_factory=list)
    samples: int = 0
    decoded_samples: int = 0
    decode_count: int = 0
    raw_decoded: str = ""
    text: str = ""
    closed: bool = False
    closed_at: float | None = None
    finalized: bool = False

    def audio(self) -> np.ndarray:
        if len(self.chunks) > 1:
            self.chunks = [np.concatenate(self.chunks)]
        return self.chunks[0]

    def append(self, samples: np.ndarray) -> None:
        self.chunks.append(samples)
        self.samples += samples.shape[0]


class StreamSession:
    def __init__(
        self,
        *,
        engine: AsrEngine,
        settings: WorkerSettings,
        context: str,
        events: asyncio.Queue[dict],
    ) -> None:
        self._engine = engine
        self._settings = settings
        self._prompt = engine.build_prompt(context)
        self._events = events
        self._segmenter = SpeechSegmenter(settings)
        self._segments: list[Segment] = []
        self._decode_interval_samples = settings.decode_interval_ms * SAMPLE_RATE // 1000
        self._decoding: asyncio.Task | None = None
        self._stopping = False
        self._finished = asyncio.Event()

    @property
    def finished(self) -> asyncio.Event:
        return self._finished

    def push_pcm16(self, payload: bytes) -> None:
        if self._stopping:
            return
        samples = np.frombuffer(payload, dtype="<i2").astype(np.float32) / 32768.0
        self._apply_segment_events(self._segmenter.push(samples))
        self._schedule()

    def stop(self) -> None:
        """話し終えた。残りの音声で区切りを閉じ、確定を待ってから終わる。"""
        if self._stopping:
            return
        self._stopping = True
        self._apply_segment_events(self._segmenter.flush())
        self._schedule()

    def cancel(self) -> None:
        if self._finished.is_set():
            return
        self._stopping = True
        if self._decoding is not None:
            self._decoding.cancel()
        self._events.put_nowait({"type": "end", "segments": len(self._segments), "cancelled": True})
        self._finished.set()

    def _apply_segment_events(self, segment_events) -> None:
        for event in segment_events:
            if event.kind == "start":
                self._segments.append(Segment(index=len(self._segments)))
            elif event.kind == "audio":
                self._segments[-1].append(event.audio)
            elif event.kind == "end":
                segment = self._segments[-1]
                segment.closed = True
                segment.closed_at = time.perf_counter()

    def _next_job(self) -> tuple[Segment, bool] | None:
        for segment in self._segments:
            if segment.closed and not segment.finalized:
                return segment, True
        if not self._segments:
            return None
        active = self._segments[-1]
        if active.closed:
            return None
        if active.samples - active.decoded_samples >= self._decode_interval_samples:
            return active, False
        return None

    def _schedule(self) -> None:
        if self._decoding is not None:
            return
        job = self._next_job()
        if job is None:
            if self._stopping and all(s.finalized for s in self._segments):
                self._finish()
            return
        segment, is_final = job
        self._decoding = asyncio.create_task(self._decode(segment, is_final))

    async def _decode(self, segment: Segment, is_final: bool) -> None:
        audio = segment.audio()
        try:
            outcome = await self._engine.decode(
                audio=audio,
                prompt=self._prompt,
                previous_raw=segment.raw_decoded,
                decode_count=segment.decode_count,
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 - 解き直しの失敗は相手に知らせて、ストリームを終える
            logger.exception("解き直しに失敗しました")
            await self._events.put({"type": "error", "message": f"文字起こしに失敗しました: {error}"})
            self._decoding = None
            self.cancel()
            return

        segment.decode_count += 1
        segment.decoded_samples = audio.shape[0]
        segment.raw_decoded = outcome.raw_decoded
        segment.text = outcome.text
        audio_ms = round(audio.shape[0] * 1000 / SAMPLE_RATE)
        logger.info(
            "decode segment=%d final=%s audio_ms=%d decode_ms=%.1f chars=%d",
            segment.index, is_final, audio_ms, outcome.decode_ms, len(outcome.text),
        )
        if is_final:
            segment.finalized = True
            await self._events.put({
                "type": "segment",
                "segment": segment.index,
                "text": segment.text,
                "audioMs": audio_ms,
                "decodeMs": round(outcome.decode_ms, 1),
                "closedToFinalMs": round((time.perf_counter() - segment.closed_at) * 1000, 1),
            })
        else:
            await self._events.put({
                "type": "partial",
                "segment": segment.index,
                "text": segment.text,
                "audioMs": audio_ms,
                "decodeMs": round(outcome.decode_ms, 1),
            })
        self._decoding = None
        self._schedule()

    def _finish(self) -> None:
        if self._finished.is_set():
            return
        self._events.put_nowait({"type": "end", "segments": len(self._segments)})
        self._finished.set()
