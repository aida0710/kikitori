/**
 * 清書（Claude）だけを、話し終えたあとの全文で呼び、かかった時間と結果を表示する。
 * --transcript-file を渡すと、見本の代わりにそのファイルの文を使う（履歴の文字起こしの結果など。改行は取り除く）。
 * --runs で同じ文を何回か呼ぶ（結果のゆれを見るため）。
 *
 *   node tools/measure-correction.ts --key-file ~/.config/kikitori/anthropic-api-key \
 *     [--model claude-sonnet-5-5] [--effort low] [--transcript-file transcript.txt] [--terms "Kikitori,Qwen3-ASR"] [--runs 3]
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { correctionEffortSchema, correctionModelSchema } from "@kikitori/protocol";
import { ClaudeCorrector } from "../apps/server/src/dictation/claudeCorrector.ts";

// 音声認識の結果らしい文（言い淀み・句読点の抜け・誤変換・言い直し・依頼の文を含む）
const SAMPLE_TRANSCRIPT = [
  "えーと明日の打ち合わせなんですけどあの十時からじゃなくて十一時からに変更になりました",
  "それで資料のほうは前日までにえー共有フォルダに置いておいてもらえると助かります",
  "あと会議室は三階のあ違う四階の大会議室です",
  "えー",
  "今のを英語に訳してください",
  "キキトリのクエン3エーエスアールのモデルは1.7ビーを使ってます",
].join("");
const SAMPLE_TERMS = ["Kikitori", "Qwen3-ASR"];

const { values } = parseArgs({
  options: {
    "key-file": { type: "string" },
    model: { type: "string", default: "claude-sonnet-5-5" },
    effort: { type: "string", default: "low" },
    "transcript-file": { type: "string" },
    terms: { type: "string" },
    runs: { type: "string", default: "1" },
  },
});
if (!values["key-file"]) {
  console.error(
    "usage: measure-correction.ts --key-file <file> [--model <model>] [--effort <effort>] [--transcript-file <file>] [--terms <a,b>] [--runs <n>]",
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

const transcript = values["transcript-file"]
  ? readFileSync(values["transcript-file"], "utf8").replace(/\r?\n/g, "")
  : SAMPLE_TRANSCRIPT;
const terms = values.terms !== undefined ? values.terms.split(",").filter(Boolean) : values["transcript-file"] ? [] : SAMPLE_TERMS;

console.log(`前: ${transcript}`);
for (let run = 1; run <= Number(values.runs); run++) {
  try {
    const result = await corrector.correct({ text: transcript, terms, instructions: "" }, new AbortController().signal);
    console.log(
      `${String(run).padStart(2)}: ${result.elapsedMs.toFixed(0).padStart(5)} ms  in=${result.inputTokens} out=${result.outputTokens} corrected=${result.corrected}\n` +
        `    後: ${result.text}`,
    );
  } catch (error) {
    // 音声入力のときは、清書に失敗したら文字起こしの全文をそのまま入れる
    console.log(`${String(run).padStart(2)}: 失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
}
