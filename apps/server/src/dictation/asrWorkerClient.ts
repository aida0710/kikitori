/**
 * 文字起こしの常駐プロセス（asr-worker）への WebSocket。手順は docs/asr-worker-protocol.md。
 */
import WebSocket from "ws";

export type AsrWorkerEvent =
  | { type: "ready"; model: string }
  | { type: "partial"; segment: number; text: string; audioMs: number; decodeMs: number }
  | { type: "segment"; segment: number; text: string; audioMs: number; decodeMs: number }
  | { type: "end"; segments: number; cancelled?: boolean }
  | { type: "error"; message: string };

export interface AsrStream {
  sendAudio(pcm16: Buffer): void;
  stop(): void;
  close(): void;
}

export interface AsrStreamHandlers {
  onEvent(event: AsrWorkerEvent): void;
  onClosed(reason: string | null): void;
}

export interface AsrWorker {
  openStream(input: { context: string }, handlers: AsrStreamHandlers): Promise<AsrStream>;
  checkHealth(): Promise<{ reachable: boolean; model: string | null }>;
}

// 常駐プロセスが動いていれば接続は数 ms で済む。止まっているときに端末を長く待たせない
const CONNECT_TIMEOUT_MS = 5000;

export class WebSocketAsrWorker implements AsrWorker {
  private readonly url: string;
  private readonly token: string | null;

  constructor(input: { url: string; token: string | null }) {
    this.url = input.url;
    this.token = input.token;
  }

  openStream(input: { context: string }, handlers: AsrStreamHandlers): Promise<AsrStream> {
    const headers = this.token ? { Authorization: `Bearer ${this.token}` } : undefined;
    const socket = new WebSocket(this.url, { headers, handshakeTimeout: CONNECT_TIMEOUT_MS });
    return new Promise((resolve, reject) => {
      let ready = false;
      socket.on("open", () => {
        socket.send(JSON.stringify({ type: "start", context: input.context }));
      });
      socket.on("message", (data, isBinary) => {
        if (isBinary) {
          return;
        }
        const event = JSON.parse(data.toString()) as AsrWorkerEvent;
        if (!ready && event.type === "ready") {
          ready = true;
          resolve({
            sendAudio: (pcm16) => socket.send(pcm16),
            stop: () => socket.send(JSON.stringify({ type: "stop" })),
            close: () => socket.close(),
          });
        }
        handlers.onEvent(event);
      });
      socket.on("error", (error) => {
        if (!ready) {
          reject(error);
        }
      });
      socket.on("close", (_code, reason) => {
        if (!ready) {
          reject(new Error(`ASR worker closed before ready: ${reason.toString()}`));
          return;
        }
        handlers.onClosed(reason.toString() || null);
      });
    });
  }

  async checkHealth(): Promise<{ reachable: boolean; model: string | null }> {
    const healthUrl = new URL("/healthz", this.url.replace(/^ws/, "http"));
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS) });
      const body = (await response.json()) as { ready: boolean; model: string };
      return { reachable: body.ready, model: body.model };
    } catch {
      return { reachable: false, model: null };
    }
  }
}
