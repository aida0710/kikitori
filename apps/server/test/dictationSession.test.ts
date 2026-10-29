import { describe, expect, it } from "vitest";
import type { DictationServerEvent } from "@kikitori/protocol";
import type { AsrStreamHandlers, AsrWorker } from "../src/dictation/asrWorkerClient.ts";
import { DictationSession } from "../src/dictation/dictationSession.ts";
import type { DictationOutcome } from "../src/repositories/dictationRepository.ts";
import type { CorrectionRequest, TextCorrector } from "../src/dictation/textCorrector.ts";

class FakeAsrWorker implements AsrWorker {
  handlers: AsrStreamHandlers | null = null;
  receivedBytes = 0;
  stopped = false;
  context = "";

  async openStream(input: { context: string }, handlers: AsrStreamHandlers) {
    this.context = input.context;
    this.handlers = handlers;
    return {
      sendAudio: (pcm16: Buffer) => {
        this.receivedBytes += pcm16.length;
      },
      stop: () => {
        this.stopped = true;
      },
      close: () => {},
    };
  }

  async checkHealth() {
    return { reachable: true, model: "fake" };
  }

  emitSegment(segment: number, text: string) {
    this.handlers!.onEvent({ type: "segment", segment, text, audioMs: 1000, decodeMs: 50 });
  }

  emitEnd(segments: number) {
    this.handlers!.onEvent({ type: "end", segments });
    this.handlers!.onClosed(null);
  }
}

/** 区切りごとに決めた時間だけ待ってから、印を付けた文を返す。 */
class DelayedCorrector implements TextCorrector {
  readonly model = "fake-model";
  readonly requests: CorrectionRequest[] = [];
  private readonly delays: number[];
  failOnText: string | null = null;

  constructor(delays: number[]) {
    this.delays = delays;
  }

  async correct(request: CorrectionRequest) {
    const delay = this.delays[this.requests.length] ?? 0;
    this.requests.push(request);
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (request.text === this.failOnText) {
      throw new Error("correction failed");
    }
    return { text: `「${request.text}」`, corrected: true, inputTokens: 10, outputTokens: 5, elapsedMs: delay };
  }
}

function createSession(asrWorker: FakeAsrWorker, corrector: TextCorrector) {
  const events: DictationServerEvent[] = [];
  let outcome: DictationOutcome | null = null;
  const session = new DictationSession({
    asrWorker,
    corrector,
    terms: ["kikitori", "Qwen"],
    instructions: "",
    emit: (event) => events.push(event),
    onFinished: (finished) => {
      outcome = finished;
    },
  });
  return { session, events, outcome: () => outcome };
}

async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(condition()).toBe(true);
}

describe("DictationSession", () => {
  it("区切りは文字起こしの結果のまま届いた順に返し、話し終えたら全文を 1 回で清書して end で返す", async () => {
    const asr = new FakeAsrWorker();
    const corrector = new DelayedCorrector([20]);
    const { session, events, outcome } = createSession(asr, corrector);
    await session.start();

    asr.emitSegment(0, "一つ目");
    asr.emitSegment(1, "二つ目");
    asr.emitEnd(2);
    await waitFor(() => events.some((event) => event.type === "end"));

    expect(events.filter((event) => event.type === "segment")).toEqual([
      { type: "segment", segment: 0, text: "一つ目" },
      { type: "segment", segment: 1, text: "二つ目" },
    ]);
    expect(corrector.requests.map((request) => request.text)).toEqual(["一つ目二つ目"]);
    expect(events.at(-1)).toEqual({ type: "end", text: "「一つ目二つ目」", corrected: true, cancelled: false });
    expect(outcome()).toMatchObject({ rawText: "一つ目二つ目", correctedText: "「一つ目二つ目」", segmentCount: 2, error: null });
  });

  it("清書に失敗したら、文字起こしの全文を end で返し、理由を履歴に残す", async () => {
    const asr = new FakeAsrWorker();
    const corrector = new DelayedCorrector([]);
    corrector.failOnText = "失敗する文";
    const { session, events, outcome } = createSession(asr, corrector);
    await session.start();

    asr.emitSegment(0, "失敗する文");
    asr.emitEnd(1);
    await waitFor(() => outcome() !== null);

    expect(events.at(-1)).toEqual({ type: "end", text: "失敗する文", corrected: false, cancelled: false });
    expect(outcome()?.error).toBe("correction failed");
  });

  it("文字起こしの接続ができる前に届いた音声と停止の指示も、接続後に渡す", async () => {
    const asr = new FakeAsrWorker();
    const { session } = createSession(asr, new DelayedCorrector([]));
    session.pushAudio(Buffer.alloc(3200));
    session.stop();
    await session.start();

    expect(asr.receivedBytes).toBe(3200);
    expect(asr.stopped).toBe(true);
    expect(asr.context).toBe("kikitori Qwen");
  });

  it("文字起こしが end の前に切れたら、端末にエラーと、それまでの文字起こしの end を送る", async () => {
    const asr = new FakeAsrWorker();
    const { session, events } = createSession(asr, new DelayedCorrector([]));
    await session.start();

    asr.emitSegment(0, "途中まで");
    asr.handlers!.onClosed("gone");

    expect(events.map((event) => event.type)).toEqual(["segment", "error", "end"]);
    expect(events.at(-1)).toEqual({ type: "end", text: "途中まで", corrected: false, cancelled: false });
  });

  it("清書を待っている間に取り消すと、清書を待たずに end（cancelled）を送る", async () => {
    const asr = new FakeAsrWorker();
    const { session, events } = createSession(asr, new DelayedCorrector([1000]));
    await session.start();

    asr.emitSegment(0, "長い清書");
    asr.emitEnd(1);
    session.cancel();

    expect(events.at(-1)).toEqual({ type: "end", text: "長い清書", corrected: false, cancelled: true });
  });
});

describe("isFillerOnly", () => {
  it("言い淀みだけの区切りは清書に回さない", async () => {
    const { isFillerOnly } = await import("../src/dictation/fillerWords.ts");
    expect(isFillerOnly("えー")).toBe(true);
    expect(isFillerOnly("えーと、あのー。")).toBe(true);
    expect(isFillerOnly("うーん")).toBe(true);
    expect(isFillerOnly("えー明日")).toBe(false);
    expect(isFillerOnly("はい、お願いします")).toBe(false);
  });
});
