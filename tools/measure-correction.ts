/**
 * 清書（Claude）だけを、区切りの文で順に呼び、かかった時間と結果を表示する。前の清書を文脈に渡すのは
 * 音声入力のときと同じ。--segments-file を渡すと、見本の代わりにそのファイルの 1 行を 1 区切りとして使う
 * （履歴の文字起こしの結果を、区切りの順に並べたもの）。
 *
 *   node tools/measure-correction.ts --key-file ~/.config/kikitori/anthropic-api-key \
 *     [--model claude-haiku-5-5] [--effort low] [--segments-file segments.txt] [--terms "Kikitori,Qwen3-ASR"]
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { correctionEffortSchema, correctionModelSchema } from "@kikitori/protocol";
import { ClaudeCorrector } from "../apps/server/src/dictation/claudeCorrector.ts";

// 音声認識の結果らしい文（言い淀み・句読点の抜け・誤変換・言い直しを含む）。区切りの順に清書し、前の清書を文脈に渡す
const SAMPLE_SEGMENTS = [
  "えーと明日の打ち合わせなんですけどあの十時からじゃなくて十一時からに変更になりました",
  "それで資料のほうは前日までにえー共有フォルダに置いておいてもらえると助かります",
  "あと会議室は三階のあ違う四階の大会議室です",
  "えー",
  "今のを英語に訳してください",
  "キキトリのクエン3エーエスアールのモデルは1.7ビーを使ってます",
];
const SAMPLE_TERMS = ["Kikitori", "Qwen3-ASR"];

const { values } = parseArgs({
  options: {
    "key-file": { type: "string" },
    model: { type: "string", default: "claude-haiku-5-5" },
    effort: { type: "string", default: "low" },
    "segments-file": { type: "string" },
    terms: { type: "string" },
  },
});
if (!values["key-file"]) {
  console.error(
    "usage: measure-correction.ts --key-file <file> [--model <model>] [--effort <effort>] [--segments-file <file>] [--terms <a,b>]",
  );
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

const segments = values["segments-file"]
  ? readFileSync(values["segments-file"], "utf8").split("\n").filter((line) => line.trim())
  : SAMPLE_SEGMENTS;
const terms = values.terms !== undefined ? values.terms.split(",").filter(Boolean) : values["segments-file"] ? [] : SAMPLE_TERMS;

let previousText = "";
for (const text of segments) {
  let result;
  try {
    result = await corrector.correct({ text, previousText, terms, instructions: "" }, new AbortController().signal);
  } catch (error) {
    // 音声入力のときと同じく、清書に失敗した区切りは文字起こしの結果のまま続ける
    console.log(`  失敗: ${error instanceof Error ? error.message : String(error)}\n  前: ${text}`);
    previousText += text;
    continue;
  }
  previousText += result.text;
  console.log(
    `${result.elapsedMs.toFixed(0).padStart(5)} ms  in=${result.inputTokens} out=${result.outputTokens} corrected=${result.corrected}\n` +
      `  前: ${text}\n  後: ${result.text}`,
  );
}
