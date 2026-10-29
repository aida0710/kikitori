// マイクの音（AudioContext の 16kHz）を 100ms ずつの 16bit PCM にして、主の糸へ送る。
// AudioWorklet は 128 サンプルずつ呼ばれるので、1600 サンプル（100ms）たまるまで貯める。
const FRAME_SAMPLES = 1600;

class Pcm16Recorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(FRAME_SAMPLES);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, FRAME_SAMPLES - this.filled);
      this.buffer.set(channel.subarray(offset, offset + count), this.filled);
      this.filled += count;
      offset += count;
      if (this.filled === FRAME_SAMPLES) {
        const pcm = new Int16Array(FRAME_SAMPLES);
        for (let index = 0; index < FRAME_SAMPLES; index++) {
          const sample = Math.max(-1, Math.min(1, this.buffer[index]));
          pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm16-recorder", Pcm16Recorder);
