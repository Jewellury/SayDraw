/*
 * SayDraw PCM AudioWorklet processor — runtime build of lib/voice/pcmWorklet.ts.
 *
 * Captures mono PCM, downsamples to 16 kHz, converts float32 -> int16 (pcm_s16le),
 * posts ArrayBuffer to main thread. See lib/voice/pcmWorklet.ts for the
 * typed source of truth.
 *
 * Inside AudioWorkletGlobalScope: `sampleRate`, `AudioWorkletProcessor`,
 * and `registerProcessor` are globals. No module system — the file is loaded
 * via `audioContext.audioWorklet.addModule('/pcmWorklet.js')`.
 */
var TARGET_SAMPLE_RATE = 16000;

function downsample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  if (toRate <= 0 || fromRate <= 0) return input;
  var ratio = fromRate / toRate;
  var outLen = Math.max(1, Math.floor(input.length / ratio));
  var out = new Float32Array(outLen);
  if (ratio === Math.floor(ratio)) {
    var r = ratio | 0;
    for (var i = 0; i < outLen; i++) {
      var sum = 0;
      var start = i * r;
      for (var j = 0; j < r; j++) sum += input[start + j] || 0;
      out[i] = sum / r;
    }
    return out;
  }
  for (var i = 0; i < outLen; i++) {
    out[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))];
  }
  return out;
}

class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    var input = inputs[0];
    if (!input || !input[0]) return true;
    var channel = input[0];
    var downsampled = downsample(channel, sampleRate, TARGET_SAMPLE_RATE);
    var pcm = new Int16Array(downsampled.length);
    for (var i = 0; i < downsampled.length; i++) {
      var s = Math.max(-1, Math.min(1, downsampled[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
