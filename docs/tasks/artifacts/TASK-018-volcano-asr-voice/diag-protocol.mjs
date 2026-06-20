/**
 * TASK-018 diagnostic — compares live protocol behavior between
 * scripts/test-volcano-asr.mjs (known-working) and the new
 * lib/voice/volcanoAsr.ts code path. Runs directly (no Next server),
 * loads .env.local the same way the test script does.
 *
 * Run: node docs/tasks/artifacts/TASK-018-volcano-asr-voice/diag-protocol.mjs
 */

import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import WebSocket from 'ws';

// Parse .env.local
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const envText = await readFile('.env.local', 'utf8');
const env = parseEnv(envText);
const VOLC_API_KEY = env.VOLC_API_KEY;
const RESOURCE_ID = env.VOLC_RESOURCE_ID || 'volc.seedasr.sauc.duration';
const ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';

if (!VOLC_API_KEY) {
  console.error('No VOLC_API_KEY in .env.local — aborting diagnostic.');
  process.exit(1);
}

const headers = {
  'X-Api-Key': VOLC_API_KEY,
  'X-Api-Resource-Id': RESOURCE_ID,
  'X-Api-Request-Id': randomUUID(),
  'X-Api-Sequence': '-1',
};

// SAME encoding as scripts/test-volcano-asr.mjs (proven working).
function encodeFullClientRequest(payloadObj) {
  const jsonBytes = Buffer.from(JSON.stringify(payloadObj), 'utf8');
  const payloadGz = gzipSync(jsonBytes);
  const header = Buffer.from([0x11, 0x10, 0x11, 0x00]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payloadGz.length, 0);
  return Buffer.concat([header, size, payloadGz]);
}
function encodeAudioFrame(pcmBytes, isLast) {
  const header = Buffer.from([0x11, isLast ? 0x22 : 0x20, 0x01, 0x00]);
  const compressed = gzipSync(pcmBytes);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressed.length, 0);
  return Buffer.concat([header, size, compressed]);
}

console.log('--- DIAG A: 3200-byte chunks (same as new volcanoAsr.ts CHUNK_BYTES) ---');
await runOnce(3200);

console.log('');
console.log('--- DIAG B: 6400-byte chunks (same as test-volcano-asr.mjs — proven working) ---');
await runOnce(6400);

async function runOnce(chunkBytes) {
  const metadata = {
    user: { uid: 'saydraw-diag-' + Date.now() },
    audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1, language: 'zh-CN' },
    request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true, enable_ddc: false, result_type: 'full' },
  };

  const silence = Buffer.alloc(16000 * 2); // 1 second of silence

  return new Promise((resolve) => {
    const ws = new WebSocket(ENDPOINT, { headers });
    let settled = false;
    let msgCount = 0;
    const done = () => { if (!settled) { settled = true; try { ws.close(); } catch {} resolve(); } };
    const to = setTimeout(() => { console.error('  TIMEOUT'); done(); }, 15000);

    ws.on('upgrade', (res) => {
      const logid = res.headers['x-tt-logid'];
      console.log('  upgrade: logid=' + logid);
    });

    ws.on('open', () => {
      console.log('  open: sending metadata + ' + Math.ceil(silence.length / chunkBytes) + ' chunks of ' + chunkBytes + 'B');
      ws.send(encodeFullClientRequest(metadata));
      for (let off = 0; off < silence.length; off += chunkBytes) {
        const chunk = silence.subarray(off, Math.min(off + chunkBytes, silence.length));
        const isLast = off + chunkBytes >= silence.length;
        ws.send(encodeAudioFrame(chunk, isLast));
      }
    });

    ws.on('message', (data) => {
      msgCount++;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const b0 = buf[0], b1 = buf[1], b2 = buf[2];
      const msgType = (b1 >> 4) & 0xF;
      const headerSize = (b0 & 0xF) * 4;
      console.log('  msg #' + msgCount + ': type=0b' + msgType.toString(2).padStart(4, '0') + ' bytes=' + buf.length + ' b0=0x' + b0.toString(16) + ' b1=0x' + b1.toString(16) + ' b2=0x' + b2.toString(16));

      if (msgType === 0b1111) {
        const code = buf.readUInt32BE(headerSize);
        const msgSize = buf.readUInt32BE(headerSize + 4);
        const msg = buf.subarray(headerSize + 8, headerSize + 8 + msgSize).toString('utf8');
        console.log('    ERROR code=' + code + ' msg="' + msg + '"');
      } else if (msgType === 0b1001) {
        const sequence = buf.readInt32BE(headerSize);
        const payloadSize = buf.readUInt32BE(headerSize + 4);
        let payload = buf.subarray(headerSize + 8, headerSize + 8 + payloadSize);
        if ((b2 & 0x0F) === 0b0001) {
          try { payload = gunzipSync(payload); } catch (e) { console.log('    gunzip failed: ' + e.message); }
        }
        let parsed;
        try { parsed = JSON.parse(payload.toString('utf8')); } catch { parsed = payload.toString('utf8'); }
        console.log('    RESPONSE seq=' + sequence + ' payloadSize=' + payloadSize);
        if (parsed?.result?.text !== undefined) console.log('    result.text="' + parsed.result.text + '"');
      } else {
        console.log('    UNKNOWN TYPE — full hex first 32 bytes: ' + buf.subarray(0, 32).toString('hex'));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(to);
      console.error('  WS ERROR: ' + err.message);
      done();
    });

    ws.on('close', (code, reason) => {
      clearTimeout(to);
      console.log('  close code=' + code + ' reason="' + (reason?.toString() || '') + '" totalMsgs=' + msgCount);
      done();
    });
  });
}
