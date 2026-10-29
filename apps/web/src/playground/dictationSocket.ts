/** ブラウザーからの音声入力の WebSocket（/v1/dictation）。ログインの cookie で入る。手順は docs/dictation-protocol.md。 */
import type { DictationServerEvent } from "@kikitori/protocol";

export interface DictationSocket {
  sendAudio(pcm: ArrayBuffer): void;
  stop(): void;
  cancel(): void;
}

export function openDictationSocket(input: {
  correction: boolean;
  onEvent: (event: DictationServerEvent) => void;
  onClosed: () => void;
}): DictationSocket {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${window.location.host}/v1/dictation`);
  socket.binaryType = "arraybuffer";
  // 接続ができるまでに録音した音声は貯めておき、start のあとに順に送る
  const pending: (string | ArrayBuffer)[] = [JSON.stringify({ type: "start", client: "web", correction: input.correction })];
  const send = (message: string | ArrayBuffer) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
    else if (socket.readyState === WebSocket.CONNECTING) pending.push(message);
  };
  socket.onopen = () => pending.splice(0).forEach((message) => socket.send(message));
  socket.onmessage = (event) => input.onEvent(JSON.parse(event.data as string) as DictationServerEvent);
  socket.onclose = () => input.onClosed();
  return {
    sendAudio: (pcm) => send(pcm),
    stop: () => send(JSON.stringify({ type: "stop" })),
    cancel: () => send(JSON.stringify({ type: "cancel" })),
  };
}
