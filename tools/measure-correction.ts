/**
 * 清書（Claude）だけを、話し言葉の見本の文で呼び、かかった時間と結果を表示する。
 *
 *   node tools/measure-correction.ts --key-file ~/.config/kikitori/anthropic-api-key \
 *     [--model claude-haiku-5-5] [--effort low]
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { correctionEffortSchema, correctionModelSchema } from "@kikitori/protocol";
import { ClaudeCorrector } from "../apps/server/src/dictation/claudeCorrector.ts";

// 音声認識の結果らしい文（言い淀み・句読点の抜け・誤変換・言い直しを含む）。区切りの順に清書し、前の清書を文脈に渡す
const SEGMENTS = [
  "えーと明日の打ち合わせなんですけどあの十時からじゃなくて十一時からに変更になりました",
  "それで資料のほうは前日までにえー共有フォルダに置いておいてもらえると助かります",
  "あと会議室は三階のあ違う四階の大会議室です",
  "えー",
  "今のを英語に訳してください",
  "キキトリのクエン3エーエスアールのモデルは1.7ビーを使ってます",
];
const TERMS = ["Kikitori", "Qwen3-ASR"];

const { values } = parseArgs({
  options: {
    "key-file": { type: "string" },
    model: { type: "string", default: "claude-haiku-5-5" },
    effort: { type: "string", default: "low" },
  },
});
if (!values["key-file"]) {
  console.error("usage: measure-correction.ts --key-file <file> [--model <model>] [--effort <effort>]");
  process.exit(2);
}

const corrector = new ClaudeCorrector({
  client: new Anthropic({ apiKey: readFileSync(values["key-file"], "utf8").trim() }),
  settings: {
    correctionEnabled: true,
    correctionModel: correctionModelSchema.parse(values.model),
    correctionEffort: correctionEffortSchema.parse(values.effort),
  },
});

let previousText = "";
for (const text of SEGMENTS) {
  const result = await corrector.correct({ text, previousText, terms: TERMS, instructions: "" }, new AbortController().signal);
  previousText += result.text;
  console.log(
    `${result.elapsedMs.toFixed(0).padStart(5)} ms  in=${result.inputTokens} out=${result.outputTokens} corrected=${result.corrected}\n` +
      `  前: ${text}\n  後: ${result.text}`,
  );
}
