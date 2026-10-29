/**
 * 音声ファイルを話す速さで /v1/dictation へ流し、端末と同じ手順で届く知らせと時刻を表示する。
 *
 *   node tools/stream-dictation.ts ws://127.0.0.1:8780/v1/dictation input.wav \
 *     --key-file ~/.config/kikitori/access-key [--start 0] [--duration 30] [--no-correction]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import WebSocket from "ws";
import { DICTATION_SAMPLE_RATE, type DictationServerEvent } from "@kikitori/protocol";

// 端末と同じく 100ms ずつ送る
const FRAME_MS = 100;
const BYTES_PER_SECOND = DICTATION_SAMPLE_RATE * 2;
const FRAME_BYTES = (BYTES_PER_SECOND * FRAME_MS) / 1000;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "key-file": { type: "string" },
    start: { type: "string", default: "0" },
    duration: { type: "string" },
    "no-correction": { type: "boolean", default: false },
  },
});
const [url, inputPath] = positionals;
if (!url || !inputPath || !values["key-file"]) {
  console.error("usage: stream-dictation.ts <ws-url> <audio-file> --key-file <file>");
  process.exit(2);
}

const ffmpegArguments = ["-v", "error", "-ss", values.start];
if (values.duration) ffmpegArguments.push("-t", values.duration);
ffmpegArguments.push("-i", inputPath, "-ac", "1", "-ar", String(DICTATION_SAMPLE_RATE), "-f", "s16le", "-");
const pcm = execFileSync("ffmpeg", ffmpegArguments, { maxBuffer: 1024 * 1024 * 1024 });
const accessKey = readFileSync(values["key-file"], "utf8").trim();

const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${accessKey}` } });
const started = performance.now();
let stopSentAt = 0;
const elapsed = () => ((performance.now() - started) / 1000).toFixed(3);

socket.on("open", async () => {
  socket.send(JSON.stringify({ type: "start", client: "stream-dictation", correction: !values["no-correction"] }));
  for (let offset = 0; offset < pcm.length; offset += FRAME_BYTES) {
    socket.send(pcm.subarray(offset, offset + FRAME_BYTES));
    const target = started + ((offset + FRAME_BYTES) / BYTES_PER_SECOND) * 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, target - performance.now())));
  }
  stopSentAt = performance.now();
  socket.send(JSON.stringify({ type: "stop" }));
});

socket.on("message", (data) => {
  const event = JSON.parse(data.toString()) as DictationServerEvent;
  if (event.type === "partial") return;
  console.log(elapsed(), JSON.stringify(event));
  if (event.type === "end") {
    console.log(`stop → end: ${(performance.now() - stopSentAt).toFixed(0)} ms (audio ${pcm.length / BYTES_PER_SECOND} s)`);
  }
});
socket.on("close", (code, reason) => console.log(elapsed(), "closed", code, reason.toString()));
socket.on("error", (error) => console.error("error", error.message));
