import { useCallback, useEffect, useRef, useState } from "react";
import type { DictationServerEvent } from "@kikitori/protocol";
import { openDictationSocket, type DictationSocket } from "./dictationSocket.ts";
import { openMicrophone, type MicrophoneStream } from "./microphoneStream.ts";

export type PlaygroundState = "idle" | "connecting" | "listening" | "finishing";

export interface PlaygroundSegment {
  index: number;
  // 文字起こしの結果（清書の前）
  text: string;
  // 話し始めからこの区切りが届くまで（ミリ秒）
  arrivedAfterMs: number;
}

/** 話し終えたあとに届く、入力欄に残す全文。 */
export interface PlaygroundResult {
  text: string;
  corrected: boolean;
  // 止めてから届くまで（ミリ秒）。清書にかかった時間の目安
  arrivedAfterStopMs: number;
}

/**
 * プレイグラウンドの 1 回の音声入力。マイクの音を送り、途中結果と確定した区切りを受け取る。
 * 終わり方は端末と同じ（止める → 全文の清書を待つ → end で清書した全文が届く）。
 */
export function usePlaygroundSession() {
  const [state, setState] = useState<PlaygroundState>("idle");
  const [segments, setSegments] = useState<PlaygroundSegment[]>([]);
  // 確定した区切りより後の区切りの途中結果だけを出すため、区切りの番号と組で持つ
  const [partial, setPartial] = useState<{ segment: number; text: string } | null>(null);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const microphone = useRef<MicrophoneStream | null>(null);
  const socket = useRef<DictationSocket | null>(null);
  const startedAt = useRef(0);
  const stoppedAt = useRef(0);

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
            { index: event.segment, text: event.text, arrivedAfterMs: performance.now() - startedAt.current },
          ]);
          return;
        case "error":
          setError(event.message);
          return;
        case "end":
          releaseMicrophone();
          setPartial(null);
          if (!event.cancelled) {
            setResult({
              text: event.text,
              corrected: event.corrected,
              arrivedAfterStopMs: performance.now() - (stoppedAt.current || startedAt.current),
            });
          }
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
      setResult(null);
      setState("connecting");
      startedAt.current = performance.now();
      stoppedAt.current = 0;
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
    stoppedAt.current = performance.now();
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
    setResult(null);
    setError(null);
  }, []);

  // 画面を離れたら、マイクと接続を閉じる
  useEffect(() => () => {
    microphone.current?.stop();
    socket.current?.cancel();
  }, []);

  return { state, segments, partial: partial?.text ?? "", result, level, error, start, stop, cancel, clear };
}
