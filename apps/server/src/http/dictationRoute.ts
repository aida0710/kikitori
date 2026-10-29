/**
 * 音声入力の WebSocket（/v1/dictation）。最初の start を確かめて DictationSession を作り、
 * 音声と停止の指示を渡して、届いた知らせを端末へ送るだけにする。手順は docs/dictation-protocol.md。
 */
import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { type DictationServerEvent, dictationControlMessageSchema } from "@kikitori/protocol";
import { DictationSession } from "../dictation/dictationSession.ts";
import type { ServerServices } from "../services.ts";
import { type AppEnv, requirePrincipal } from "./requestContext.ts";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toBuffer(data: ArrayBuffer | Uint8Array | Blob): Buffer {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError("Blob audio frames are not supported");
}

function parseTerms(terms: string): string[] {
  return terms
    .split("\n")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

export function createDictationRoute(services: ServerServices): Hono<AppEnv> {
  const route = new Hono<AppEnv>();
  route.use("*", requirePrincipal(services));
  route.get(
    "/",
    upgradeWebSocket((c) => {
      const { user, accessKeyId } = c.get("principal");
      let session: DictationSession | null = null;
      let ended = false;

      const send = (socket: WSContext, event: DictationServerEvent) => {
        if (ended) return;
        socket.send(JSON.stringify(event));
        if (event.type === "end") {
          ended = true;
          socket.close(1000, "done");
        }
      };

      const begin = async (socket: WSContext, client: string | undefined, correction: boolean | undefined) => {
        const userSettings = services.settings.getUserSettings(user.id);
        const serverSettings = services.settings.getServerSettings();
        const corrector = services.correctorFor({
          ...serverSettings,
          correctionEnabled: serverSettings.correctionEnabled && correction !== false,
        });
        const dictationId = services.dictations.start({ userId: user.id, accessKeyId, client: client ?? null });
        session = new DictationSession({
          asrWorker: services.asrWorker,
          corrector,
          terms: parseTerms(userSettings.terms),
          instructions: userSettings.instructions,
          emit: (event) => send(socket, event),
          onFinished: (outcome) =>
            services.dictations.finish(dictationId, {
              ...outcome,
              rawText: userSettings.saveHistory ? outcome.rawText : null,
              correctedText: userSettings.saveHistory ? outcome.correctedText : null,
            }),
        });
        try {
          await session.start();
        } catch {
          send(socket, { type: "error", code: "asr_unavailable", message: "The ASR worker is not reachable" });
          session.cancel();
          return;
        }
        send(socket, { type: "ready", dictationId });
      };

      return {
        onMessage(event, socket) {
          if (typeof event.data !== "string") {
            session?.pushAudio(toBuffer(event.data));
            return;
          }
          const parsed = dictationControlMessageSchema.safeParse(parseJson(event.data));
          if (!parsed.success) {
            send(socket, { type: "error", code: "invalid_message", message: "Unknown control message" });
            return;
          }
          const message = parsed.data;
          if (message.type === "start") {
            if (session) {
              send(socket, { type: "error", code: "invalid_message", message: "start was already sent" });
              return;
            }
            void begin(socket, message.client, message.correction);
          } else if (message.type === "stop") {
            session?.stop();
          } else {
            session?.cancel();
          }
        },
        onClose() {
          ended = true;
          session?.cancel();
        },
      };
    }),
  );
  return route;
}
