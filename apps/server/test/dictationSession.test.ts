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
  it("清書に時間がかかっても、区切りは話した順に届き、前の清書を文脈として渡す", async () => {
    const asr = new FakeAsrWorker();
    const corrector = new DelayedCorrector([40, 0]);
    const { session, events } = createSession(asr, corrector);
    await session.start();

    asr.emitSegment(0, "一つ目");
    asr.emitSegment(1, "二つ目");
    asr.emitEnd(2);
    await waitFor(() => events.some((event) => event.type === "end"));

    const segments = events.filter((event) => event.type === "segment");
    expect(segments.map((event) => event.text)).toEqual(["「一つ目」", "「二つ目」"]);
    expect(corrector.requests[1]?.previousText).toBe("「一つ目」");
    expect(events.at(-1)).toEqual({ type: "end", text: "「一つ目」「二つ目」", cancelled: false });
  });

  it("清書に失敗した区切りは、文字起こしの結果をそのまま返して続ける", async () => {
    const asr = new FakeAsrWorker();
    const corrector = new DelayedCorrector([]);
    corrector.failOnText = "失敗する文";
    const { session, events, outcome } = createSession(asr, corrector);
    await session.start();

    asr.emitSegment(0, "失敗する文");
    asr.emitSegment(1, "次の文");
    asr.emitEnd(2);
    await waitFor(() => outcome() !== null);

    const segments = events.filter((event) => event.type === "segment");
    expect(segments.map((event) => [event.text, event.corrected])).toEqual([
      ["失敗する文", false],
      ["「次の文」", true],
    ]);
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

  it("文字起こしが end の前に切れたら、端末にエラーと end を送る", async () => {
    const asr = new FakeAsrWorker();
    const { session, events } = createSession(asr, new DelayedCorrector([]));
    await session.start();

    asr.handlers!.onClosed("gone");

    expect(events.map((event) => event.type)).toEqual(["error", "end"]);
  });

  it("取り消すと、清書を待たずに end（cancelled）を送る", async () => {
    const asr = new FakeAsrWorker();
    const { session, events } = createSession(asr, new DelayedCorrector([1000]));
    await session.start();

    asr.emitSegment(0, "長い清書");
    session.cancel();

    expect(events.at(-1)).toEqual({ type: "end", text: "", cancelled: true });
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
