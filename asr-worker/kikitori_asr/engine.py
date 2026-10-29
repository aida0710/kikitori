"""Qwen3-ASR（vLLM）を 1 つだけ持ち、解き直しを 1 本ずつ順に実行する。

qwen-asr の streaming_transcribe() は決まった長さの区切りごとに解き直すため、処理が遅れると
溜まった区切りの数だけ解き直しを繰り返す。ここでは同じ考え方（それまでの音声を全部入れ直し、
前回の結果の末尾を少し戻したものを続きの手がかりにする）を、溜まった音声をまとめて 1 回で
解き直す形で持つ。
"""

from __future__ import annotations

import asyncio
import math
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import numpy as np
from qwen_asr import Qwen3ASRModel
from qwen_asr.inference.utils import parse_asr_output
from vllm import SamplingParams

from .settings import WorkerSettings

SAMPLE_RATE = 16000
# 最初の数回は前回の結果を手がかりにしない（出だしの誤りを引きずらないため。qwen-asr の既定と同じ 2）
UNFIXED_DECODE_COUNT = 2
# 手がかりにするとき、前回の結果の末尾から戻すトークン数（境目のゆれを直せるようにするため。qwen-asr の既定と同じ 5）
UNFIXED_TOKEN_COUNT = 5
# 日本語の話し言葉は 1 秒あたり 10 トークンに届かない。止まらない繰り返しを打ち切るための上限なので多めにとる
TOKENS_PER_AUDIO_SECOND = 15
MIN_NEW_TOKENS = 32
WARM_UP_SECONDS = 1


@dataclass
class DecodeOutcome:
    raw_decoded: str
    text: str
    decode_ms: float


class AsrEngine:
    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        self._model = Qwen3ASRModel.LLM(
            model=settings.model,
            gpu_memory_utilization=settings.gpu_memory_utilization,
            max_model_len=settings.max_model_len,
            max_num_seqs=settings.max_num_seqs,
            max_num_batched_tokens=settings.max_model_len,
            max_new_tokens=MIN_NEW_TOKENS,
        )
        # vLLM の LLM は同時に呼べないので、解き直しはこの 1 本のスレッドに並べる
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="asr-decode")
        self._base_prompt = self._model._build_text_prompt(context="", force_language=settings.language)
        self._warm_up()

    def _warm_up(self) -> None:
        """最初の解き直しだけ 2 秒ほどかかる（実行の準備が走るため）。起動のうちに 1 回済ませておく。"""
        silence = np.zeros((WARM_UP_SECONDS * SAMPLE_RATE,), dtype=np.float32)
        self._decode_blocking(silence, self._base_prompt, "", 0)

    @property
    def model_name(self) -> str:
        return self._settings.model

    @property
    def language(self) -> str:
        return self._settings.language

    def build_prompt(self, context: str) -> str:
        if not context:
            return self._base_prompt
        return self._model._build_text_prompt(context=context, force_language=self._settings.language)

    async def decode(
        self, *, audio: np.ndarray, prompt: str, previous_raw: str, decode_count: int
    ) -> DecodeOutcome:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._executor, self._decode_blocking, audio, prompt, previous_raw, decode_count
        )

    def _decode_blocking(
        self, audio: np.ndarray, prompt: str, previous_raw: str, decode_count: int
    ) -> DecodeOutcome:
        started = time.perf_counter()
        prefix = "" if decode_count < UNFIXED_DECODE_COUNT else self._rollback(previous_raw)
        audio_seconds = audio.shape[0] / SAMPLE_RATE
        sampling = SamplingParams(
            temperature=0.0,
            max_tokens=MIN_NEW_TOKENS + math.ceil(audio_seconds * TOKENS_PER_AUDIO_SECOND),
        )
        request = {"prompt": prompt + prefix, "multi_modal_data": {"audio": [audio]}}
        outputs = self._model.model.generate([request], sampling_params=sampling, use_tqdm=False)
        raw_decoded = prefix + outputs[0].outputs[0].text
        _, text = parse_asr_output(raw_decoded, user_language=self._settings.language)
        return DecodeOutcome(
            raw_decoded=raw_decoded,
            text=text,
            decode_ms=(time.perf_counter() - started) * 1000,
        )

    def _rollback(self, raw_decoded: str) -> str:
        """前回の結果から末尾のトークンを戻す。文字の途中で切れる（U+FFFD が出る）なら、さらに戻す。"""
        tokenizer = self._model.processor.tokenizer
        token_ids = tokenizer.encode(raw_decoded)
        rollback = UNFIXED_TOKEN_COUNT
        while True:
            end = max(0, len(token_ids) - rollback)
            if end == 0:
                return ""
            prefix = tokenizer.decode(token_ids[:end])
            if "�" not in prefix:
                return prefix
            rollback += 1
