import { useCallback, useEffect, useRef, useState } from "react";
import type { DictationServerEvent } from "@kikitori/protocol";
import { openDictationSocket, type DictationSocket } from "./dictationSocket.ts";
import { openMicrophone, type MicrophoneStream } from "./microphoneStream.ts";

export type PlaygroundState = "idle" | "connecting" | "listening" | "finishing";

export interface PlaygroundSegment {
  index: number;
  raw: string;
  text: string;
  corrected: boolean;
  // 話し始めからこの区切りが届くまで（ミリ秒）
  arrivedAfterMs: number;
}

/**
 * プレイグラウンドの 1 回の音声入力。マイクの音を送り、途中結果と確定した区切りを受け取る。
 * 終わり方は端末と同じ（止める → 残りの区切りの清書を待つ → end）。
 */
export function usePlaygroundSession() {
  const [state, setState] = useState<PlaygroundState>("idle");
  const [segments, setSegments] = useState<PlaygroundSegment[]>([]);
  // 清書を待っている区切りより先に、次の区切りの途中結果が届くことがあるので、区切りの番号と組で持つ
  const [partial, setPartial] = useState<{ segment: number; text: string } | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const microphone = useRef<MicrophoneStream | null>(null);
  const socket = useRef<DictationSocket | null>(null);
  const startedAt = useRef(0);

  const releaseMicrophone = useCallback(() => {
    microphone.current?.stop();
    microphone.current = null;
    setLevel(0);
  }, []);

  const handleEvent = useCallback(
    (event: DictationServerEvent) => {
      switch (event.type) {
        case "ready":
          setState((current) => (current === "connecting" ? "listening" : current));
          return;
        case "partial":
          setPartial({ segment: event.segment, text: event.text });
          return;
        case "segment":
          setPartial((current) => (current && current.segment > event.segment ? current : null));
          setSegments((current) => [
            ...current,
            { index: event.segment, raw: event.raw, text: event.text, corrected: event.corrected, arrivedAfterMs: performance.now() - startedAt.current },
          ]);
          return;
        case "error":
          setError(event.message);
          return;
        case "end":
          releaseMicrophone();
          setPartial(null);
          setState("idle");
          return;
      }
    },
    [releaseMicrophone],
  );

  const start = useCallback(
    async ({ correction }: { correction: boolean }) => {
      setError(null);
      setSegments([]);
      setPartial(null);
      setState("connecting");
      startedAt.current = performance.now();
      const current = openDictationSocket({
        correction,
        onEvent: handleEvent,
        onClosed: () => {
          releaseMicrophone();
          setState("idle");
        },
      });
      socket.current = current;
      try {
        microphone.current = await openMicrophone((pcm, frameLevel) => {
          current.sendAudio(pcm);
          setLevel(frameLevel);
        });
      } catch (failure) {
        current.cancel();
        setState("idle");
        throw failure;
      }
    },
    [handleEvent, releaseMicrophone],
  );

  const stop = useCallback(() => {
    releaseMicrophone();
    socket.current?.stop();
    setState("finishing");
  }, [releaseMicrophone]);

  const cancel = useCallback(() => {
    releaseMicrophone();
    socket.current?.cancel();
  }, [releaseMicrophone]);

  const clear = useCallback(() => {
    setSegments([]);
    setPartial(null);
    setError(null);
  }, []);

  // 画面を離れたら、マイクと接続を閉じる
  useEffect(() => () => {
    microphone.current?.stop();
    socket.current?.cancel();
  }, []);

  return { state, segments, partial: partial?.text ?? "", level, error, start, stop, cancel, clear };
}
