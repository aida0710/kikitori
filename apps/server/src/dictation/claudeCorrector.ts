/** Claude（Messages API）で区切りの文を清書する。 */
import Anthropic from "@anthropic-ai/sdk";
import type { CorrectionModel, ServerSettings } from "@kikitori/protocol";
import { buildCorrectionUserMessage, CORRECTION_SYSTEM_PROMPT, EMPTY_SEGMENT_MARK } from "./correctionPrompt.ts";
import { isFillerOnly } from "./fillerWords.ts";
import type { CorrectionRequest, CorrectionResult, TextCorrector } from "./textCorrector.ts";

// 清書した文は元の文とほぼ同じ長さ。区切りは最大 30 秒ほどなので、これで足りる
const MAX_OUTPUT_TOKENS = 2048;

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
    const message = await this.client.messages.create(
      {
        model: this.settings.correctionModel,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: CORRECTION_SYSTEM_PROMPT,
        ...(thinking ? { thinking } : {}),
        output_config: { effort: this.settings.correctionEffort },
        messages: [{ role: "user", content: buildCorrectionUserMessage(request) }],
      },
      { signal },
    );
    const elapsedMs = performance.now() - started;
    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
    // 断られたとき（安全の判定）や途中で切れたときは、文字起こしの結果をそのまま使う
    if (message.stop_reason !== "end_turn") {
      return { text: request.text, corrected: false, elapsedMs, ...usage };
    }
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .replace(/\r?\n/g, "")
      .trim();
    return { text: text === EMPTY_SEGMENT_MARK ? "" : text, corrected: true, elapsedMs, ...usage };
  }
}
