/**
 * AudioWorklet processor — captures mono PCM, downsamples to 16 kHz, converts
 * float32 → int16 (pcm_s16le), posts ArrayBuffer to main thread.
 *
 * This TypeScript source is the single source of truth. The .ts file is
 * imported by the client VoiceRecorder for type-checking purposes only.
 * At runtime the browser loads the pre-compiled `/public/pcmWorklet.js`
 * (a tiny ES5 build of this exact module — see docs/tasks/execution-log/
 * TASK-018-volcano-asr-voice.md for the build step). We use a static asset
 * rather than a route handler because (a) Next.js route handlers add
 * substantial per-request overhead for a fixed ~1 KB file, and (b) it lets
 * the browser cache the worklet across sessions.
 *
 * Global shape inside an AudioWorkletGlobalScope:
 *   - `sampleRate`        : native AudioContext sample rate (read-only)
 *   - `AudioWorkletProcessor` : base class
 *   - `registerProcessor` : registration function
 */

declare const sampleRate: number;

interface AudioWorkletProcessorImpl {
  readonly port: { postMessage(message: unknown, transfer: Transferable[]): void };
}

declare class AudioWorkletProcessor {
  readonly port: { postMessage(message: unknown, transfer: Transferable[]): void };
}

declare function registerProcessor(name: string, ctor: new () => unknown): void;

const TARGET_SAMPLE_RATE = 16000;

/**
 * Downsample from native sampleRate to 16 kHz.
 *
 * Most browsers honour `new AudioContext({ sampleRate: 16000 })` and the
 * worklet runs at 16 kHz directly. Safari historically ignores the option
 * and runs at 44100/48000; in that case we downsample here.
 *
 * Method: simple integer-ratio decimation when native is an exact integer
 * multiple of 16 kHz (e.g. 48000 → 3:1); otherwise nearest-sample pick.
 * For a child-voice ASR payload this is good enough — Volcano's bigmodel
 * does its own internal resampling defences. No anti-alias filter is
 * applied (intentional — minimal complexity for the MVP).
 */
function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  if (toRate <= 0 || fromRate <= 0) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  if (Number.isInteger(ratio)) {
    // Average each `ratio`-sized block (low-pass-ish via averaging).
    const r = ratio | 0;
    for (let i = 0; i < outLen; i++) {
      let sum = 0;
      const start = i * r;
      for (let j = 0; j < r; j++) sum += input[start + j] || 0;
      out[i] = sum / r;
    }
    return out;
  }
  // Non-integer ratio: nearest-neighbour pick.
  for (let i = 0; i < outLen; i++) {
    out[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))];
  }
  return out;
}

class PcmProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0]; // mono: take channel 0
    const downsampled = downsample(channel, sampleRate, TARGET_SAMPLE_RATE);
    const pcm = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      // Float32 → Int16 conversion (AC7)
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    // Transfer the buffer (zero-copy) — main thread owns it after this.
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);

// Export only for type-checking — never imported at runtime.
export type { AudioWorkletProcessorImpl };
