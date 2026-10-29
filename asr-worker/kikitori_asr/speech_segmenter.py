"""Silero VAD で、声の始まりと、無音が続いたところで音声を区切る。"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np
import torch
from silero_vad import load_silero_vad

from .settings import WorkerSettings

SAMPLE_RATE = 16000
# Silero VAD が 16kHz で受け付ける窓の長さ（32ms）
WINDOW_SAMPLES = 512
# 声とみなす確率。Silero VAD の推奨値
SPEECH_THRESHOLD = 0.5
# 声が続いているあいだの無音の判定は、少し下げてゆらぎで切れないようにする
SILENCE_THRESHOLD = 0.35
# 上限を超えた区切りは、この長さの無音でも閉じる（文の途中の小さな間で切るため）
FORCED_CUT_SILENCE_MS = 160
# 上限を超えてから無音が来ない場合でも、ここまで来たら切る
HARD_CUT_EXTRA_MS = 5000


@dataclass
class SegmentEvent:
    kind: str  # "start"・"audio"・"end"
    audio: np.ndarray | None = None


def _ms_to_windows(milliseconds: int) -> int:
    return max(1, round(milliseconds * SAMPLE_RATE / 1000 / WINDOW_SAMPLES))


class SpeechSegmenter:
    """音声を 32ms の窓に分けて VAD にかけ、区切りの開始・中身・終了を順に返す。"""

    def __init__(self, settings: WorkerSettings) -> None:
        # Silero VAD は直前の音声の状態を持つので、ストリームごとに別に読み込む
        self._model = load_silero_vad()
        self._pending = np.zeros((0,), dtype=np.float32)
        self._pre_speech: deque[np.ndarray] = deque(maxlen=_ms_to_windows(settings.speech_pad_ms))
        self._min_silence_windows = _ms_to_windows(settings.min_silence_ms)
        self._max_segment_windows = _ms_to_windows(settings.max_segment_ms)
        self._forced_cut_windows = _ms_to_windows(FORCED_CUT_SILENCE_MS)
        self._hard_cut_windows = self._max_segment_windows + _ms_to_windows(HARD_CUT_EXTRA_MS)
        self._in_speech = False
        self._segment_windows = 0
        self._silence_windows = 0

    @property
    def in_speech(self) -> bool:
        return self._in_speech

    def push(self, samples: np.ndarray) -> list[SegmentEvent]:
        self._pending = np.concatenate([self._pending, samples])
        events: list[SegmentEvent] = []
        while self._pending.shape[0] >= WINDOW_SAMPLES:
            window = self._pending[:WINDOW_SAMPLES]
            self._pending = self._pending[WINDOW_SAMPLES:]
            events.extend(self._process_window(window))
        return events

    def flush(self) -> list[SegmentEvent]:
        """話し終えたときに、残りの音声を今の区切りに足して閉じる。"""
        events: list[SegmentEvent] = []
        if self._in_speech:
            if self._pending.shape[0] > 0:
                events.append(SegmentEvent("audio", self._pending))
            events.append(SegmentEvent("end"))
        self._pending = np.zeros((0,), dtype=np.float32)
        self._in_speech = False
        return events

    def _process_window(self, window: np.ndarray) -> list[SegmentEvent]:
        probability = float(self._model(torch.from_numpy(window), SAMPLE_RATE).item())
        if not self._in_speech:
            if probability < SPEECH_THRESHOLD:
                self._pre_speech.append(window)
                return []
            self._in_speech = True
            self._segment_windows = len(self._pre_speech) + 1
            self._silence_windows = 0
            head = np.concatenate([*self._pre_speech, window])
            self._pre_speech.clear()
            return [SegmentEvent("start"), SegmentEvent("audio", head)]

        self._segment_windows += 1
        self._silence_windows = self._silence_windows + 1 if probability < SILENCE_THRESHOLD else 0
        events = [SegmentEvent("audio", window)]
        if self._should_close():
            events.append(SegmentEvent("end"))
            self._in_speech = False
            self._model.reset_states()
        return events

    def _should_close(self) -> bool:
        if self._silence_windows >= self._min_silence_windows:
            return True
        if self._segment_windows >= self._hard_cut_windows:
            return True
        return (
            self._segment_windows >= self._max_segment_windows
            and self._silence_windows >= self._forced_cut_windows
        )
