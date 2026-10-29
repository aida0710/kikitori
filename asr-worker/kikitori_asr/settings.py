"""文字起こしの常駐プロセスの設定。すべて環境変数 KIKITORI_ASR_* から読む。"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _read_float(name: str, default: float) -> float:
    value = os.environ.get(name)
    return float(value) if value else default


def _read_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    return int(value) if value else default


@dataclass(frozen=True)
class WorkerSettings:
    model: str
    # 1.7B は重みが 3.9GiB、起動時の見積もりの計算用がおよそ 2.5GiB。3080Ti（12GB）で KV キャッシュを
    # 1GiB ほど残せる値を既定にする（0.55 では足りずに起動できなかった）
    gpu_memory_utilization: float
    # 1 区切りの音声（最大 30 秒）とプロンプトが収まる長さ。小さいほど KV キャッシュが少なくて済む
    max_model_len: int
    # 解き直しは 1 本ずつ順に行うので、同時に扱う要求は少なくてよい。多いと起動時の見積もりで
    # 計算用のメモリを大きく取られ、12GB では KV キャッシュの分が残らない
    max_num_seqs: int
    language: str
    # 途中結果を出し直す間隔。短いほど画面の追従がよいが、GPU の負荷が増える
    decode_interval_ms: int
    # これだけ無音が続いたら区切りを閉じる
    min_silence_ms: int
    # 1 区切りの音声の上限。解き直しは音声全体を入れ直すので、長いほど 1 回が重くなる
    max_segment_ms: int
    # 話し始めの取りこぼしを防ぐために、声を検出する前の音声も区切りに含める
    speech_pad_ms: int
    access_token: str | None

    @classmethod
    def from_environment(cls) -> WorkerSettings:
        return cls(
            model=os.environ.get("KIKITORI_ASR_MODEL", "Qwen/Qwen3-ASR-1.7B"),
            gpu_memory_utilization=_read_float("KIKITORI_ASR_GPU_MEMORY_UTILIZATION", 0.65),
            max_model_len=_read_int("KIKITORI_ASR_MAX_MODEL_LEN", 4096),
            max_num_seqs=_read_int("KIKITORI_ASR_MAX_NUM_SEQS", 4),
            language=os.environ.get("KIKITORI_ASR_LANGUAGE", "Japanese"),
            decode_interval_ms=_read_int("KIKITORI_ASR_DECODE_INTERVAL_MS", 500),
            min_silence_ms=_read_int("KIKITORI_ASR_MIN_SILENCE_MS", 600),
            max_segment_ms=_read_int("KIKITORI_ASR_MAX_SEGMENT_MS", 20000),
            speech_pad_ms=_read_int("KIKITORI_ASR_SPEECH_PAD_MS", 300),
            access_token=os.environ.get("KIKITORI_ASR_TOKEN") or None,
        )
