/**
 * 1 回の音声入力。端末から届いた音声を文字起こしへ流し、確定した区切りを順に清書して端末へ返す。
 *
 * 清書は区切りの順に 1 つずつ行う。前の区切りの清書を、次の区切りの文脈として渡すため。
 * 清書に失敗した区切りは、文字起こしの結果をそのまま返す（入力が止まらないことを優先する）。
 */
import type { DictationServerEvent } from "@kikitori/protocol";
import type { AsrStream, AsrWorker, AsrWorkerEvent } from "./asrWorkerClient.ts";
import type { DictationOutcome } from "../repositories/dictationRepository.ts";
import type { TextCorrector } from "./textCorrector.ts";

// 16kHz・16bit・モノラルの 1 ms あたりのバイト数
const PCM16_BYTES_PER_MS = 32;

export interface DictationSessionOptions {
  asrWorker: AsrWorker;
  corrector: TextCorrector;
  terms: string[];
  instructions: string;
  emit(event: DictationServerEvent): void;
  onFinished(outcome: DictationOutcome): void;
}

interface FinishedSegment {
  raw: string;
  text: string;
}

export class DictationSession {
  private readonly options: DictationSessionOptions;
  private readonly abortController = new AbortController();
  private asrStream: AsrStream | null = null;
  // 端末は接続してすぐ録音を始める。文字起こしの接続ができるまでに届いた音声はここに貯める
  private pendingAudio: Buffer[] = [];
  private stopRequested = false;
  private correctionQueue: Promise<void> = Promise.resolve();
  private readonly segments: FinishedSegment[] = [];
  private receivedAudioBytes = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private maxCorrectionMs: number | null = null;
  private correctionError: string | null = null;
  // 常駐プロセスは end を送ったあと自分から接続を閉じる。そのあとの close は異常ではない
  private asrEnded = false;
  private finished = false;

  constructor(options: DictationSessionOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    // 登録した言葉は文字起こしの手がかりにも渡す（Qwen3-ASR は文脈の文で表記を寄せられる）
    this.asrStream = await this.options.asrWorker.openStream(
      { context: this.options.terms.join(" ") },
      {
        onEvent: (event) => this.handleAsrEvent(event),
        onClosed: () => {
          if (!this.finished && !this.asrEnded) {
            this.fail("asr_failed", "The ASR worker closed the stream unexpectedly");
          }
        },
      },
    );
    for (const pcm16 of this.pendingAudio) {
      this.asrStream.sendAudio(pcm16);
    }
    this.pendingAudio = [];
    if (this.stopRequested) {
      this.asrStream.stop();
    }
  }

  pushAudio(pcm16: Buffer): void {
    if (this.finished) {
      return;
    }
    this.receivedAudioBytes += pcm16.length;
    if (!this.asrStream) {
      this.pendingAudio.push(pcm16);
      return;
    }
    this.asrStream.sendAudio(pcm16);
  }

  stop(): void {
    this.stopRequested = true;
    this.asrStream?.stop();
  }

  cancel(): void {
    if (this.finished) {
      return;
    }
    this.abortController.abort();
    this.asrStream?.close();
    this.finish({ cancelled: true, error: null });
  }

  private handleAsrEvent(event: AsrWorkerEvent): void {
    if (this.finished) {
      return;
    }
    switch (event.type) {
      case "partial":
        this.options.emit({ type: "partial", segment: event.segment, text: event.text });
        return;
      case "segment":
        this.enqueueCorrection(event.segment, event.text);
        return;
      case "end":
        this.asrEnded = true;
        void this.correctionQueue.then(() => this.finish({ cancelled: event.cancelled ?? false, error: null }));
        return;
      case "error":
        this.fail("asr_failed", event.message);
        return;
      case "ready":
        return;
    }
  }

  private enqueueCorrection(segment: number, raw: string): void {
    this.correctionQueue = this.correctionQueue.then(async () => {
      if (this.finished) {
        return;
      }
      const text = await this.correctSegment(raw);
      if (this.finished) {
        return;
      }
      this.segments.push({ raw, text: text.text });
      this.options.emit({ type: "segment", segment, raw, text: text.text, corrected: text.corrected });
    });
  }

  private async correctSegment(raw: string): Promise<{ text: string; corrected: boolean }> {
    if (!raw.trim()) {
      return { text: "", corrected: false };
    }
    try {
      const result = await this.options.corrector.correct(
        {
          text: raw,
          previousText: this.segments.map((segment) => segment.text).join(""),
          terms: this.options.terms,
          instructions: this.options.instructions,
        },
        this.abortController.signal,
      );
      this.inputTokens += result.inputTokens;
      this.outputTokens += result.outputTokens;
      if (result.corrected) {
        this.maxCorrectionMs = Math.max(this.maxCorrectionMs ?? 0, result.elapsedMs);
      }
      return { text: result.text, corrected: result.corrected };
    } catch (error) {
      if (this.abortController.signal.aborted) {
        return { text: raw, corrected: false };
      }
      this.correctionError = error instanceof Error ? error.message : String(error);
      return { text: raw, corrected: false };
    }
  }

  private fail(code: "asr_failed", message: string): void {
    if (this.finished) {
      return;
    }
    this.options.emit({ type: "error", code, message });
    this.abortController.abort();
    this.asrStream?.close();
    this.finish({ cancelled: false, error: message });
  }

  private finish(input: { cancelled: boolean; error: string | null }): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    const correctedText = this.segments.map((segment) => segment.text).join("");
    this.options.emit({ type: "end", text: correctedText, cancelled: input.cancelled });
    this.asrStream?.close();
    this.options.onFinished({
      endedAt: new Date(),
      audioMs: Math.round(this.receivedAudioBytes / PCM16_BYTES_PER_MS),
      segmentCount: this.segments.length,
      rawText: this.segments.map((segment) => segment.raw).join(""),
      correctedText,
      correctionModel: this.options.corrector.model,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      maxCorrectionMs: this.maxCorrectionMs,
      error: input.error ?? this.correctionError,
    });
  }
}
