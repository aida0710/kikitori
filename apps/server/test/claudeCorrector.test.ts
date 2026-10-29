import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ClaudeCorrector } from "../src/dictation/claudeCorrector.ts";

/** messages.parse だけを持つ、決まった清書を返す Anthropic の代わり。 */
function correctorReturning(correctedText: string) {
  const client = {
    messages: {
      parse: async () => ({
        stop_reason: "end_turn",
        parsed_output: { text: correctedText },
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    },
  } as unknown as Anthropic;
  return new ClaudeCorrector({
    client,
    settings: { correctionEnabled: true, correctionModel: "claude-haiku-5-5", correctionEffort: "low" },
  });
}

const request = { text: "言わてては。", terms: [], instructions: "" };

describe("ClaudeCorrector", () => {
  it("清書が元の文よりずっと長いとき（説明を書いたとき）は使わない", async () => {
    const explanation = "言わてては、ではなく言い直しの途中なので、清書になります。誤認識の可能性があるため、言わなくてはの誤りと考えられます。";
    await expect(correctorReturning(explanation).correct(request, new AbortController().signal)).rejects.toThrow("not used");
  });

  it("清書に指示のタグが出てきたら使わない", async () => {
    await expect(correctorReturning("<transcript>言わてては。").correct(request, new AbortController().signal)).rejects.toThrow("prompt tag");
  });

  it("句読点を足した程度の清書はそのまま使う", async () => {
    const result = await correctorReturning("言わなくては。").correct(request, new AbortController().signal);
    expect(result).toMatchObject({ text: "言わなくては。", corrected: true });
  });
});

describe("removeSpacesAroundLatin", () => {
  it("日本語の文の中の英字・数字の前後の空白を取り除き、英字どうしの空白は残す", async () => {
    const { removeSpacesAroundLatin } = await import("../src/dictation/japaneseSpacing.ts");
    expect(removeSpacesAroundLatin("Kikitori の Qwen3-ASR のモデルは 1.7B を使ってます。")).toBe(
      "KikitoriのQwen3-ASRのモデルは1.7Bを使ってます。",
    );
    expect(removeSpacesAroundLatin("Claude Code で 3 回試した。")).toBe("Claude Codeで3回試した。");
    expect(removeSpacesAroundLatin("This is English.")).toBe("This is English.");
  });
});
