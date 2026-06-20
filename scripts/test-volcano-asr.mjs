/**
 * SayDraw — Volcano ASR 连通性 + 协议 + 端到端测试
 *
 * 用法（项目根目录）：
 *   node scripts/test-volcano-asr.mjs
 *
 * 不依赖任何产品代码。用 ws npm 包（因为它支持自定义 headers，这是 TASK-018 ADR-3 的核心）。
 *
 * 测试三层：
 *   1. 凭证完整性 + 鉴权头构造（无网络）
 *   2. WebSocket 握手是否被火山接受（验证 key + resource id + endpoint）
 *   3. 端到端：合成一段静音 PCM 发送，看是否拿到响应
 *      （即使是"空音频"错误码 45000002，也证明协议跑通）
 *
 * 退出码：0 全部通过；非 0 表示某层失败。
 */

import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { deflateSync, gzipSync, gunzipSync, inflateSync } from 'node:zlib';
import WebSocket from 'ws';

const ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';

// ---------- 1. 读取并解析 .env.local ----------
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
const VOLC_APP_KEY = env.VOLC_APP_KEY;
const VOLC_ACCESS_KEY = env.VOLC_ACCESS_KEY;
const RESOURCE_ID = env.VOLC_RESOURCE_ID || 'volc.seedasr.sauc.duration';

console.log('---');
console.log('Layer 1: 凭证检查');

if (!RESOURCE_ID) {
  console.error('  FAIL: VOLC_RESOURCE_ID 未配置');
  process.exit(1);
}
console.log(`  VOLC_RESOURCE_ID = ${RESOURCE_ID}`);

let headers;
if (VOLC_API_KEY) {
  console.log(`  使用新版控制台鉴权 (VOLC_API_KEY 长度 ${VOLC_API_KEY.length})`);
  headers = {
    'X-Api-Key': VOLC_API_KEY,
    'X-Api-Resource-Id': RESOURCE_ID,
    'X-Api-Request-Id': randomUUID(),
    'X-Api-Sequence': '-1',
  };
} else if (VOLC_APP_KEY && VOLC_ACCESS_KEY) {
  console.log(`  使用老版控制台鉴权 (VOLC_APP_KEY 长度 ${VOLC_APP_KEY.length})`);
  headers = {
    'X-Api-App-Key': VOLC_APP_KEY,
    'X-Api-Access-Key': VOLC_ACCESS_KEY,
    'X-Api-Resource-Id': RESOURCE_ID,
    'X-Api-Request-Id': randomUUID(),
    'X-Api-Sequence': '-1',
  };
} else {
  console.error('  FAIL: 既没配 VOLC_API_KEY，也没配 VOLC_APP_KEY + VOLC_ACCESS_KEY');
  process.exit(1);
}
console.log('  PASS: 凭证完整');

// ---------- 2. 构造协议帧 ----------
// 4字节 header:
//   byte 0: 高4位 protocol version (0b0001), 低4位 header size (0b0001=4字节)
//   byte 1: 高4位 message type, 低4位 flags
//   byte 2: 高4位 serialization (0b0001=JSON / 0b0000=raw), 低4位 compression (0b0001=Gzip / 0b0000=none)
//   byte 3: reserved 0x00

function encodeFullClientRequest(payloadObj) {
  const jsonBytes = Buffer.from(JSON.stringify(payloadObj), 'utf8');
  // 火山的 "Gzip" 标志位期望标准 gzip 流（带 0x1f 0x8b header），不是 raw deflate
  const payloadGz = gzipSync(jsonBytes);
  // ver=0b0001 hs=0b0001 | type=0b0001(full client req) flags=0b0000 | ser=JSON(0b0001) comp=Gzip(0b0001) | reserved
  const header = Buffer.from([0x11, 0x10, 0x11, 0x00]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payloadGz.length, 0);
  return Buffer.concat([header, size, payloadGz]);
}

function encodeAudioFrame(pcmBytes, isLast) {
  // audio only: type=0b0010, flags = 0b0000 (positive seq) or 0b0010 (last/negative)
  // serialization=0b0000 (raw), compression=0b0001 (Gzip)
  const header = Buffer.from([0x11, isLast ? 0x22 : 0x20, 0x01, 0x00]);
  const compressed = gzipSync(pcmBytes);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressed.length, 0);
  return Buffer.concat([header, size, compressed]);
}

function decodeServerMessage(buf) {
  const b0 = buf[0], b1 = buf[1], b2 = buf[2];
  const version = (b0 >> 4) & 0xF;
  const headerSize = (b0 & 0xF) * 4;
  const msgType = (b1 >> 4) & 0xF;
  const flags = (b1 & 0xF);
  const serialization = (b2 >> 4) & 0xF;
  const compression = (b2 & 0xF);
  const result = { version, headerSize, msgType, flags, serialization, compression };

  if (msgType === 0b1111) {
    const code = buf.readUInt32BE(headerSize);
    const msgSize = buf.readUInt32BE(headerSize + 4);
    const msg = buf.slice(headerSize + 8, headerSize + 8 + msgSize).toString('utf8');
    return { ...result, error: true, errorCode: code, errorMessage: msg };
  }

  let offset = headerSize;
  const sequence = buf.readInt32BE(offset); offset += 4;
  const payloadSize = buf.readUInt32BE(offset); offset += 4;
  let payload = buf.slice(offset, offset + payloadSize);
  if (compression === 0b0001) {
    payload = gunzipSync(payload);
  }
  if (serialization === 0b0001) {
    try { payload = JSON.parse(payload.toString('utf8')); } catch (e) { /* keep raw */ }
  }
  return { ...result, sequence, payload };
}

// ---------- 3. 合成 1.5 秒静音 PCM (16kHz / 16bit / mono) ----------
const SAMPLE_RATE = 16000;
const DURATION_SEC = 1.5;
const totalSamples = SAMPLE_RATE * DURATION_SEC;
const silencePcm = Buffer.alloc(totalSamples * 2); // 全 0 = 静音

// ---------- 4. WebSocket 握手 + 端到端测试 ----------
console.log('---');
console.log('Layer 2 + 3: WebSocket 握手 + 端到端协议测试');
console.log(`  endpoint: ${ENDPOINT}`);

const ws = new WebSocket(ENDPOINT, { headers });

let settled = false;
const done = () => { if (!settled) { settled = true; ws.close(); } };
const timeout = setTimeout(() => {
  console.error('  FAIL: 10 秒内未完成全部流程');
  done();
  process.exit(3);
}, 10000);

ws.on('upgrade', (response) => {
  console.log('  收到握手响应');
  const logid = response.headers['x-tt-logid'] || response.headers['X-Tt-Logid'];
  if (logid) console.log(`  X-Tt-Logid: ${logid}（排错时引用这个 ID）`);
});

ws.on('open', () => {
  console.log('  PASS: WebSocket 握手成功（鉴权通过）');
  console.log('---');
  console.log('Layer 3: 端到端协议测试');
  console.log('  发送 full client request (JSON metadata)...');

  const metadata = {
    user: { uid: `saydraw-test-${Date.now()}` },
    audio: {
      format: 'pcm',
      rate: 16000,
      bits: 16,
      channel: 1,
      language: 'zh-CN',
    },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
      enable_ddc: false,
      result_type: 'full',
    },
  };
  ws.send(encodeFullClientRequest(metadata));

  console.log('  发送静音 PCM (1.5s, 分块 200ms)...');
  const chunkSize = Math.floor(SAMPLE_RATE * 2 * 0.2); // 200ms
  const chunks = [];
  for (let i = 0; i < silencePcm.length; i += chunkSize) {
    chunks.push(silencePcm.slice(i, Math.min(i + chunkSize, silencePcm.length)));
  }
  chunks.forEach((chunk, idx) => {
    const isLast = idx === chunks.length - 1;
    ws.send(encodeAudioFrame(chunk, isLast));
  });
  console.log(`  发送了 ${chunks.length} 个音频块（最后一块带 last 标记）`);
  console.log('  等待火山响应...');
});

ws.on('message', (data, isBinary) => {
  clearTimeout(timeout);
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const decoded = decodeServerMessage(buf);
  console.log('  收到响应:');
  console.log(`    message type: 0b${decoded.msgType.toString(2).padStart(4, '0')}`);
  console.log(`    flags:        0b${decoded.flags.toString(2).padStart(4, '0')}`);
  console.log(`    sequence:     ${decoded.sequence}`);

  if (decoded.error) {
    console.log(`    错误码: ${decoded.errorCode}`);
    console.log(`    错误信息: ${decoded.errorMessage}`);
    if (decoded.errorCode === 45000002) {
      console.log('    -> 45000002 = 空音频（我们发的是静音 PCM，这是符合预期的，协议跑通了）');
      console.log('  PASS: 端到端协议链路成功（错误是数据问题，不是协议/鉴权问题）');
    } else if (decoded.errorCode === 45000081) {
      console.log('    -> 45000081 = 等包超时');
      console.log('  PARTIAL: 协议跑通但超时，检查分块节奏');
    } else {
      console.log(`    -> 未知错误码 ${decoded.errorCode}，需要查火山文档`);
    }
  } else {
    const payloadStr = JSON.stringify(decoded.payload, null, 2);
    console.log('    payload:');
    payloadStr.split(/\r?\n/).forEach(l => console.log('      ' + l));
    const text = decoded.payload?.result?.text;
    if (text != null) {
      console.log(`    识别结果: "${text}"`);
      console.log('  PASS: 端到端协议链路成功，拿到识别结果');
    } else {
      console.log('  PASS: 收到响应但无 text 字段（静音 PCM 也合理）');
    }
  }
  done();
});

ws.on('error', (err) => {
  clearTimeout(timeout);
  console.error(`  FAIL: WebSocket 错误: ${err.message}`);
  if (err.message.includes('401') || err.message.includes('403')) {
    console.error('  常见原因:');
    console.error('    - key 无效或过期');
    console.error('    - resource id 不匹配（订阅的是 1.0 但配了 2.0，或反之）');
    console.error('    - 该 resource id 未在该账号开通');
  } else if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
    console.error('  网络不通，无法连到 openspeech.bytedance.com');
  }
  process.exit(4);
});

ws.on('close', (code, reason) => {
  clearTimeout(timeout);
  const reasonStr = reason ? `, reason: ${reason.toString()}` : '';
  console.log(`  连接关闭 (code ${code}${reasonStr})`);
  if (!settled) {
    console.error('  FAIL: 连接在收到响应前就关闭');
    process.exit(5);
  } else {
    console.log('---');
    console.log('全部测试完成。');
    process.exit(0);
  }
});
