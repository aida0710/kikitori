/**
 * 1 回の音声入力。端末から届いた音声を文字起こしへ流し、確定した区切りをそのまま端末へ返す。
 * 話し終えたら（文字起こしの end のあと）、全文を 1 回で清書して end で返す。
 *
 * 区切りごとに清書しないのは、後ろの文まで見えた方が誤認識（同じ読みの言葉など）を直せるため。
 * 清書に失敗したときは、文字起こしの全文を返す（入力が止まらないことを優先する）。
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

interface WholeTextCorrection {
  text: string;
  corrected: boolean;
  error: string | null;
}

export class DictationSession {
  private readonly options: DictationSessionOptions;
  private readonly abortController = new AbortController();
  private asrStream: AsrStream | null = null;
  // 端末は接続してすぐ録音を始める。文字起こしの接続ができるまでに届いた音声はここに貯める
  private pendingAudio: Buffer[] = [];
  private stopRequested = false;
  // 確定した区切りの文字起こしの結果（区切りの順）
  private readonly segmentTexts: string[] = [];
  private receivedAudioBytes = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private correctionMs: number | null = null;
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
    this.finishUncorrected({ cancelled: true, error: null });
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
        this.segmentTexts.push(event.text);
        this.options.emit({ type: "segment", segment: event.segment, text: event.text });
        return;
      case "end":
        this.asrEnded = true;
        if (event.cancelled) {
          this.finishUncorrected({ cancelled: true, error: null });
          return;
        }
        void this.correctAndFinish();
        return;
      case "error":
        this.fail("asr_failed", event.message);
        return;
      case "ready":
        return;
    }
  }

  private async correctAndFinish(): Promise<void> {
    const correction = await this.correctWholeText(this.rawText());
    // 清書を待っている間に取り消された
    if (this.finished) {
      return;
    }
    this.finish({ cancelled: false, ...correction });
  }

  private async correctWholeText(rawText: string): Promise<WholeTextCorrection> {
    if (!rawText.trim()) {
      return { text: rawText, corrected: false, error: null };
    }
    try {
      const result = await this.options.corrector.correct(
        { text: rawText, terms: this.options.terms, instructions: this.options.instructions },
        this.abortController.signal,
      );
      this.inputTokens += result.inputTokens;
      this.outputTokens += result.outputTokens;
      if (result.corrected) {
        this.correctionMs = result.elapsedMs;
      }
      return { text: result.text, corrected: result.corrected, error: null };
    } catch (error) {
      return { text: rawText, corrected: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private rawText(): string {
    return this.segmentTexts.join("");
  }

  private fail(code: "asr_failed", message: string): void {
    if (this.finished) {
      return;
    }
    this.options.emit({ type: "error", code, message });
    this.abortController.abort();
    this.asrStream?.close();
    this.finishUncorrected({ cancelled: false, error: message });
  }

  /** 清書せずに終える（取り消し・失敗）。端末は入れた文字起こしの結果をそのまま残す。 */
  private finishUncorrected(input: { cancelled: boolean; error: string | null }): void {
    this.finish({ cancelled: input.cancelled, text: this.rawText(), corrected: false, error: input.error });
  }

  private finish(input: { cancelled: boolean } & WholeTextCorrection): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.options.emit({ type: "end", text: input.text, corrected: input.corrected, cancelled: input.cancelled });
    this.asrStream?.close();
    this.options.onFinished({
      endedAt: new Date(),
      audioMs: Math.round(this.receivedAudioBytes / PCM16_BYTES_PER_MS),
      segmentCount: this.segmentTexts.length,
      rawText: this.rawText(),
      correctedText: input.text,
      correctionModel: this.options.corrector.model,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      correctionMs: this.correctionMs,
      error: input.error,
    });
  }
}
