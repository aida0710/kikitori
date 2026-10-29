/** Claude（Messages API）で区切りの文を清書する。 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CorrectionModel, ServerSettings } from "@kikitori/protocol";
import { buildCorrectionUserMessage, CORRECTION_SYSTEM_PROMPT } from "./correctionPrompt.ts";
import { isFillerOnly } from "./fillerWords.ts";
import type { CorrectionRequest, CorrectionResult, TextCorrector } from "./textCorrector.ts";

// 清書した文は元の文とほぼ同じ長さ。区切りは最大 30 秒ほどなので、これで足りる
const MAX_OUTPUT_TOKENS = 2048;
// 清書は言葉を足さないので、元の文より長くなるのは句読点と、<terms> の英字の表記への置き換えの分だけ。
// これを超えたら、清書の文ではなく説明を返したとみなして使わない（迷ったときに考えを本文に書くことがあった）
const MAX_LENGTH_RATIO = 1.5;
const MAX_LENGTH_MARGIN_CHARS = 10;
// 指示の中の印。清書の文に出てきたら、指示を写したとみなして使わない
const PROMPT_TAG_PATTERN = /<\/?(current|previous|terms|user_instructions)>/;

// 返す形を決めて、清書の文の外に説明や前置きを書けないようにする
const correctionOutputSchema = z.object({ text: z.string() });

/**
 * 思考はモデルごとに切り方が違う。Haiku 5.5 は disabled（effort が high 以下のとき）、
 * Sonnet 5.5 は between_tools、Opus 5.5 は切れないので effort だけで抑える。
 */
function thinkingFor(model: CorrectionModel): Anthropic.MessageCreateParams["thinking"] | undefined {
  switch (model) {
    case "claude-haiku-5-5":
      return { type: "disabled" };
    case "claude-sonnet-5-5":
      return { type: "between_tools" };
    case "claude-opus-5-5":
      return undefined;
  }
}

export class ClaudeCorrector implements TextCorrector {
  private readonly client: Anthropic;
  private readonly settings: ServerSettings;

  constructor(input: { client: Anthropic; settings: ServerSettings }) {
    this.client = input.client;
    this.settings = input.settings;
  }

  get model(): string {
    return this.settings.correctionModel;
  }

  async correct(request: CorrectionRequest, signal: AbortSignal): Promise<CorrectionResult> {
    if (isFillerOnly(request.text)) {
      return { text: "", corrected: true, inputTokens: 0, outputTokens: 0, elapsedMs: 0 };
    }
    const started = performance.now();
    const thinking = thinkingFor(this.settings.correctionModel);
    const message = await this.client.messages.parse(
      {
        model: this.settings.correctionModel,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: CORRECTION_SYSTEM_PROMPT,
        ...(thinking ? { thinking } : {}),
        output_config: { effort: this.settings.correctionEffort, format: zodOutputFormat(correctionOutputSchema) },
        messages: [{ role: "user", content: buildCorrectionUserMessage(request) }],
      },
      { signal },
    );
    const elapsedMs = performance.now() - started;
    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
    // 断られたとき（安全の判定）や途中で切れたときは、文字起こしの結果をそのまま使う
    if (message.stop_reason !== "end_turn" || !message.parsed_output) {
      return { text: request.text, corrected: false, elapsedMs, ...usage };
    }
    const text = message.parsed_output.text.replace(/\r?\n/g, "").trim();
    assertLooksLikeCorrection({ original: request.text, corrected: text });
    return { text, corrected: true, elapsedMs, ...usage };
  }
}

/** 清書の文として使えない結果なら、理由を付けて投げる（区切りは文字起こしの結果のまま入り、履歴に理由が残る）。 */
function assertLooksLikeCorrection({ original, corrected }: { original: string; corrected: string }): void {
  const maxLength = Math.ceil(original.length * MAX_LENGTH_RATIO) + MAX_LENGTH_MARGIN_CHARS;
  if (corrected.length > maxLength) {
    throw new Error(`correction was ${corrected.length} chars for ${original.length} input chars, so it was not used`);
  }
  if (PROMPT_TAG_PATTERN.test(corrected)) {
    throw new Error("correction contained a prompt tag, so it was not used");
  }
}
