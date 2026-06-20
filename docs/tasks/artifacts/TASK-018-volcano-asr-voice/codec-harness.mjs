/**
 * TASK-018 Phase 2 codec harness — verifies lib/voice/volcanoProtocol.ts
 * emits and parses the exact bytes the Volcano bigmodel_nostream protocol
 * requires, with NO network involved.
 *
 * Run with:  node docs/tasks/artifacts/TASK-018-volcano-asr-voice/codec-harness.mjs
 *
 * Output is captured to codec-harness-output.txt next to this file.
 *
 * NOTE: imports from the compiled lib/voice/volcanoProtocol.ts via tsx-less
 * dynamic compile. We use Node's built-in transpile-less path: we re-implement
 * is NOT done here — instead we shell out to a tiny .mjs that hand-loads the
 * TS source via the TypeScript compiler API. Simpler: since the codec uses only
 * `node:zlib` and Buffer, we strip-types by hand for the harness only.
 *
 * Cleaner alternative chosen: this harness .mjs file imports a hand-mirror
 * copy of the codec is FORBIDDEN (single source of truth). Instead we use the
 * `typescript` transpileModule API to load the .ts file at runtime. The
 * project already has typescript as a devDependency.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { transpileModule } from 'typescript';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const here = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const tsPath = join(here, '..', '..', '..', '..', 'lib', 'voice', 'volcanoProtocol.ts');

const tsSource = readFileSync(tsPath, 'utf8');
const { outputText } = transpileModule(tsSource, {
  compilerOptions: {
    module: 'esnext',
    target: 'es2020',
    moduleResolution: 'bundler',
  },
  fileName: 'volcanoProtocol.mjs',
});

// Load the transpiled module from a data URL (Node's ESM loader supports data: scheme).
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64');
const mod = await import(dataUrl);
const { encodeFullClientRequest, encodeAudioFrame, decodeServerMessage } = mod;

const lines = [];
const log = (s) => lines.push(s);

log('# TASK-018 Phase 2 Codec Harness');
log('# Verifies lib/voice/volcanoProtocol.ts against the Volcano spec.');
log('# No network calls. Pure-byte assertions.');
log('');

// ---------- 1. encodeFullClientRequest ----------
log('## 1. encodeFullClientRequest');
const payload = {
  user: { uid: 'saydraw-test-fixed' },
  audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1, language: 'zh-CN' },
  request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true, enable_ddc: false, result_type: 'full' },
};
const frame = encodeFullClientRequest(payload);
const hex = [...frame].map((b) => '0x' + b.toString(16).padStart(2, '0')).join(' ');
log(`length: ${frame.length} bytes`);
log(`header bytes 0..3: ${hex.slice(0, 11 * 6 - 1)}`);
log(`byte 0 = 0x${frame[0].toString(16).padStart(2, '0')} (expect 0x11) ${frame[0] === 0x11 ? 'PASS' : 'FAIL'}`);
log(`byte 1 = 0x${frame[1].toString(16).padStart(2, '0')} (expect 0x10) ${frame[1] === 0x10 ? 'PASS' : 'FAIL'}`);
log(`byte 2 = 0x${frame[2].toString(16).padStart(2, '0')} (expect 0x11 = JSON+Gzip) ${frame[2] === 0x11 ? 'PASS' : 'FAIL'}`);
log(`byte 3 = 0x${frame[3].toString(16).padStart(2, '0')} (expect 0x00) ${frame[3] === 0x00 ? 'PASS' : 'FAIL'}`);
const payloadSize = frame.readUInt32BE(4);
log(`payload size (bytes 4..7 BE uint32) = ${payloadSize}`);
const payloadBytes = frame.subarray(8);
log(`actual payload bytes = ${payloadBytes.length}`);
log(`payload size matches: ${payloadSize === payloadBytes.length ? 'PASS' : 'FAIL'}`);
// Decompress payload and verify JSON round-trips
const { gunzipSync } = await import('node:zlib');
const decompressed = gunzipSync(payloadBytes).toString('utf8');
const roundtrip = JSON.parse(decompressed);
log(`payload gunzip + JSON.parse roundtrip: ${JSON.stringify(roundtrip) === JSON.stringify(payload) ? 'PASS' : 'FAIL'}`);
// Verify standard gzip magic header (0x1f 0x8b)
log(`payload[0..1] magic = 0x${payloadBytes[0].toString(16).padStart(2, '0')} 0x${payloadBytes[1].toString(16).padStart(2, '0')} (expect 0x1f 0x8b) ${payloadBytes[0] === 0x1f && payloadBytes[1] === 0x8b ? 'PASS' : 'FAIL'}`);
log('');

// ---------- 2. encodeAudioFrame — middle chunk ----------
log('## 2. encodeAudioFrame (middle chunk, isLast=false)');
const pcm = Buffer.alloc(3200, 0x42); // 200ms of arbitrary bytes
const midFrame = encodeAudioFrame(pcm, false);
log(`byte 0 = 0x${midFrame[0].toString(16).padStart(2, '0')} (expect 0x11) ${midFrame[0] === 0x11 ? 'PASS' : 'FAIL'}`);
log(`byte 1 = 0x${midFrame[1].toString(16).padStart(2, '0')} (expect 0x20 = audio more) ${midFrame[1] === 0x20 ? 'PASS' : 'FAIL'}`);
log(`byte 2 = 0x${midFrame[2].toString(16).padStart(2, '0')} (expect 0x01 = raw + Gzip) ${midFrame[2] === 0x01 ? 'PASS' : 'FAIL'}`);
log(`byte 3 = 0x${midFrame[3].toString(16).padStart(2, '0')} (expect 0x00) ${midFrame[3] === 0x00 ? 'PASS' : 'FAIL'}`);
const midPayloadSize = midFrame.readUInt32BE(4);
const midPayload = midFrame.subarray(8);
log(`payload size: ${midPayloadSize}, actual: ${midPayload.length}, match: ${midPayloadSize === midPayload.length ? 'PASS' : 'FAIL'}`);
const midDecompressed = gunzipSync(midPayload);
log(`pcm roundtrip via gunzip: ${midDecompressed.equals(pcm) ? 'PASS' : 'FAIL'}`);
log('');

// ---------- 3. encodeAudioFrame — last chunk ----------
log('## 3. encodeAudioFrame (last chunk, isLast=true)');
const lastFrame = encodeAudioFrame(Buffer.alloc(0), true);
log(`byte 1 = 0x${lastFrame[1].toString(16).padStart(2, '0')} (expect 0x22 = audio last / end-of-stream) ${lastFrame[1] === 0x22 ? 'PASS' : 'FAIL'}`);
log(`byte 2 = 0x${lastFrame[2].toString(16).padStart(2, '0')} (expect 0x01) ${lastFrame[2] === 0x01 ? 'PASS' : 'FAIL'}`);
const lastPayloadSize = lastFrame.readUInt32BE(4);
log(`empty PCM payload size = ${lastPayloadSize} (expect > 0 because gzip header overhead)`);
log('');

// ---------- 4. decodeServerMessage — error frame ----------
log('## 4. decodeServerMessage (error frame: code 45000002 empty audio)');
const errMsg = Buffer.from('empty audio', 'utf8');
const errFrame = Buffer.concat([
  Buffer.from([0x11, 0xf0, 0x00, 0x00]),
  (() => { const b = Buffer.alloc(4); b.writeUInt32BE(45000002, 0); return b; })(),
  (() => { const b = Buffer.alloc(4); b.writeUInt32BE(errMsg.length, 0); return b; })(),
  errMsg,
]);
const errDecoded = decodeServerMessage(errFrame);
log(`type = ${errDecoded.type} (expect 'error') ${errDecoded.type === 'error' ? 'PASS' : 'FAIL'}`);
log(`code = ${errDecoded.code} (expect 45000002) ${errDecoded.code === 45000002 ? 'PASS' : 'FAIL'}`);
log(`message = "${errDecoded.message}" (expect "empty audio") ${errDecoded.message === 'empty audio' ? 'PASS' : 'FAIL'}`);
log('');

// ---------- 5. decodeServerMessage — response frame (gzip) ----------
log('## 5. decodeServerMessage (response frame, JSON+Gzip, sequence=1)');
const { gzipSync } = await import('node:zlib');
const respPayload = gzipSync(Buffer.from(JSON.stringify({ result: { text: '你好世界' } }), 'utf8'));
const respFrame = Buffer.concat([
  Buffer.from([0x11, 0x90, 0x11, 0x00]),
  (() => { const b = Buffer.alloc(4); b.writeInt32BE(1, 0); return b; })(),
  (() => { const b = Buffer.alloc(4); b.writeUInt32BE(respPayload.length, 0); return b; })(),
  respPayload,
]);
const respDecoded = decodeServerMessage(respFrame);
log(`type = ${respDecoded.type} (expect 'response') ${respDecoded.type === 'response' ? 'PASS' : 'FAIL'}`);
log(`sequence = ${respDecoded.sequence} (expect 1) ${respDecoded.sequence === 1 ? 'PASS' : 'FAIL'}`);
log(`payload.result.text = "${respDecoded.payload?.result?.text}" (expect "你好世界") ${respDecoded.payload?.result?.text === '你好世界' ? 'PASS' : 'FAIL'}`);
log('');

// ---------- 6. decodeServerMessage — response frame (no compression) ----------
log('## 6. decodeServerMessage (response frame, raw JSON, sequence=2)');
const rawResp = Buffer.from(JSON.stringify({ result: { text: 'hello' } }), 'utf8');
const rawFrame = Buffer.concat([
  Buffer.from([0x11, 0x90, 0x10, 0x00]),
  (() => { const b = Buffer.alloc(4); b.writeInt32BE(2, 0); return b; })(),
  (() => { const b = Buffer.alloc(4); b.writeUInt32BE(rawResp.length, 0); return b; })(),
  rawResp,
]);
const rawDecoded = decodeServerMessage(rawFrame);
log(`type = ${rawDecoded.type} (expect 'response') ${rawDecoded.type === 'response' ? 'PASS' : 'FAIL'}`);
log(`sequence = ${rawDecoded.sequence} (expect 2) ${rawDecoded.sequence === 2 ? 'PASS' : 'FAIL'}`);
log(`payload.result.text = "${rawDecoded.payload?.result?.text}" (expect "hello") ${rawDecoded.payload?.result?.text === 'hello' ? 'PASS' : 'FAIL'}`);
log('');

// ---------- summary ----------
const fails = lines.filter((l) => l.includes('FAIL')).length;
log(`## Summary: ${fails === 0 ? 'ALL PASS' : `${fails} FAILURES`}`);
log('');
log(`Captured: ${new Date().toISOString()}`);

const outPath = join(here, 'codec-harness-output.txt');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log(`\nWrote output to ${outPath}`);
process.exit(fails === 0 ? 0 : 1);
