/**
 * ブラウザーのマイクを 16kHz・モノラル・16bit の PCM にして、100ms ずつ渡す（端末と同じ形）。
 * 変換は AudioContext の sampleRate（16000）と AudioWorklet（public/pcm16-recorder.worklet.js）が行う。
 */
import { DICTATION_SAMPLE_RATE } from "@kikitori/protocol";

export interface MicrophoneStream {
  stop(): void;
}

/** 話し声の RMS はおよそ 0.02〜0.2。画面の印が動いて見えるように広げる（Windows・Android と同じ） */
function levelOf(pcm: Int16Array): number {
  let sumOfSquares = 0;
  for (const sample of pcm) {
    const value = sample / 32768;
    sumOfSquares += value * value;
  }
  return Math.min(1, Math.sqrt(sumOfSquares / pcm.length) * 6);
}

export async function openMicrophone(onFrame: (pcm: ArrayBuffer, level: number) => void): Promise<MicrophoneStream> {
  const media = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext({ sampleRate: DICTATION_SAMPLE_RATE });
  await context.audioWorklet.addModule("/pcm16-recorder.worklet.js");
  const source = context.createMediaStreamSource(media);
  const recorder = new AudioWorkletNode(context, "pcm16-recorder");
  recorder.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onFrame(event.data, levelOf(new Int16Array(event.data)));
  source.connect(recorder);
  return {
    stop() {
      recorder.port.onmessage = null;
      source.disconnect();
      media.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
}
