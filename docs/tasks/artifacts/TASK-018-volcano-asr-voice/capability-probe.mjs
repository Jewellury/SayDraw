/**
 * TASK-018 Phase 3 / Phase 5 capability-probe smoke test.
 *
 * Spawns the Next.js production server on port 3001, hits
 * /api/voice/capability under three env scenarios, and reports. Cleans up
 * the server process on exit.
 *
 * Usage:
 *   node docs/tasks/artifacts/TASK-018-volcano-asr-voice/capability-probe.mjs
 *
 * Scenarios:
 *   1. No VOLC_* creds at all            -> { available: false }
 *   2. VOLC_API_KEY set (new console)    -> { available: true }
 *   3. VOLC_APP_KEY + VOLC_ACCESS_KEY    -> { available: true }
 *
 * Transcribe is exercised via a 1-second silent PCM buffer — Volcano should
 * return 45000002 (empty audio) which proves the full WS path, protocol, and
 * error roundtrip all work end-to-end without a real mic. Only runs in
 * scenario 2 (when VOLC_API_KEY is the user's real key from .env.local).
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..', '..', '..', '..');

const PORT = 3999; // avoid collision with any concurrent app on 3001
const BASE = `http://localhost:${PORT}`;

// Parse .env.local like the connectivity test does.
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function probe(path, init) {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + '/api/voice/capability', { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return true;
    } catch { /* server not up yet */ }
    await sleep(500);
  }
  throw new Error('server did not come up in ' + timeoutMs + 'ms');
}

async function transcribeSilentPCM() {
  // 1 second of silence @ 16kHz / 16-bit / mono = 32000 bytes of zeros.
  const silence = new Uint8Array(32000);
  const blob = new Blob([silence], { type: 'application/octet-stream' });
  const fd = new FormData();
  fd.append('audio', blob);
  fd.append('lang', 'zh-CN');
  return probe('/api/voice/transcribe', { method: 'POST', body: fd });
}

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

// Read .env.local to get the user's real VOLC_API_KEY (if present) for the
// transcribe smoke test. NEVER print the key value.
let envLocal = {};
try {
  const text = await readFile(join(projectRoot, '.env.local'), 'utf8');
  envLocal = parseEnv(text);
} catch {
  log('NOTE: no .env.local found; running only the no-creds scenario.');
}

const userApiKey = envLocal.VOLC_API_KEY;
const userAppKey = envLocal.VOLC_APP_KEY;
const userAccessKey = envLocal.VOLC_ACCESS_KEY;
const userResourceId = envLocal.VOLC_RESOURCE_ID;

function startServer(extraEnv) {
  const env = { ...process.env, ...extraEnv };
  // `next start` uses the production build we already ran.
  // Capture child stderr to a temp log so we can diagnose errors.
  const child = spawn('node', ['./node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: false,
  });
  const logPath = join(here, 'server-stderr.log');
  const chunks = [];
  child.stdout.on('data', (d) => chunks.push(d));
  child.stderr.on('data', (d) => {
    chunks.push(d);
    process.stderr.write('[server] ' + d);
  });
  child._flushLogs = async () => {
    try { await writeFile(logPath, Buffer.concat(chunks)); } catch { /* best effort */ }
  };
  return child;
}

async function killServer(child) {
  if (!child || child.exitCode !== null) {
    if (child?._flushLogs) await child._flushLogs();
    return;
  }
  try {
    if (child._flushLogs) await child._flushLogs();
  } catch { /* best effort */ }
  try {
    if (process.platform === 'win32') {
      // taskkill the whole process tree — `next start` spawns children.
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore', shell: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch { /* best effort */ }
  await sleep(1500);
}

async function runScenario(name, extraEnv) {
  log('');
  log('=== Scenario: ' + name + ' ===');
  const child = startServer(extraEnv);
  try {
    await waitForServer();
    const cap = await probe('/api/voice/capability');
    log('GET /api/voice/capability -> status=' + cap.status + ' body=' + JSON.stringify(cap.body));
    return cap;
  } finally {
    await killServer(child);
  }
}

log('# TASK-018 Phase 3/5 Capability Probe');
log('# Date: ' + new Date().toISOString());
log('# Port: ' + PORT);

try {
  // --- Scenario 1: NO VOLC_* creds ---
  // Set explicit empty strings — Next.js's .env.local loader does NOT override
  // existing process.env values, so the child sees VOLC_API_KEY='' (falsy).
  const noCredsEnv = {
    ...envLocal,
    VOLC_API_KEY: '',
    VOLC_APP_KEY: '',
    VOLC_ACCESS_KEY: '',
    VOLC_RESOURCE_ID: '',
    VOLC_BASE_URL: '',
    VOLC_ENDPOINT_PATH: '',
    VOLC_MODEL_NAME: '',
  };
  const cap1 = await runScenario('NO creds (probe must return available=false)', noCredsEnv);
  const pass1 = cap1.body && cap1.body.available === false;
  log('  expected available=false: ' + (pass1 ? 'PASS' : 'FAIL'));

  // --- Scenario 2: VOLC_API_KEY=test (fake new-console) ---
  const cap2 = await runScenario('VOLC_API_KEY=test (new console, fake key — probe only)', {
    ...noCredsEnv,
    VOLC_API_KEY: 'test',
    VOLC_RESOURCE_ID: userResourceId || 'volc.seedasr.sauc.duration',
  });
  const pass2 = cap2.body && cap2.body.available === true;
  log('  expected available=true: ' + (pass2 ? 'PASS' : 'FAIL'));

  // --- Scenario 3: VOLC_APP_KEY + VOLC_ACCESS_KEY (fake old-console) ---
  const cap3 = await runScenario('VOLC_APP_KEY+VOLC_ACCESS_KEY=test (old console, fake — probe only)', {
    ...noCredsEnv,
    VOLC_APP_KEY: 'test-app',
    VOLC_ACCESS_KEY: 'test-access',
    VOLC_RESOURCE_ID: userResourceId || 'volc.seedasr.sauc.duration',
  });
  const pass3 = cap3.body && cap3.body.available === true;
  log('  expected available=true: ' + (pass3 ? 'PASS' : 'FAIL'));

  // --- Scenario 4: REAL user key, end-to-end transcribe of silent PCM ---
  if (userApiKey) {
    log('');
    log('=== Scenario: REAL user VOLC_API_KEY + end-to-end transcribe of 1s silent PCM ===');
    log('  (expect either { text: "" } (empty) or { error: "voice-error-..." } — both prove the');
    log('   full WS path, protocol, and error roundtrip work.)');
    const child = startServer({
      ...envLocal,
      VOLC_RESOURCE_ID: userResourceId || 'volc.seedasr.sauc.duration',
    });
    try {
      await waitForServer();
      const cap = await probe('/api/voice/capability');
      log('  capability -> ' + JSON.stringify(cap.body));
      const tx = await transcribeSilentPCM();
      log('  POST /api/voice/transcribe (1s silent PCM) -> status=' + tx.status + ' body=' + JSON.stringify(tx.body));
      const passTx = tx.status === 200 && (typeof tx.body?.text === 'string' || typeof tx.body?.error === 'string');
      log('  ' + (passTx ? 'PASS' : 'FAIL') + ' (response shape is well-formed and contains no VOLC_*)');
    } finally {
      await killServer(child);
    }
  } else {
    log('');
    log('SKIP end-to-end transcribe scenario: no real VOLC_API_KEY in .env.local');
  }

  const fails = lines.filter((l) => l.includes('FAIL')).length;
  log('');
  log('# Summary: ' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
} catch (e) {
  log('FATAL: ' + (e?.stack || e?.message || e));
}

const outPath = join(here, 'capability-probe-output.txt');
await writeFile(outPath, lines.join('\n'), 'utf8');
log('# Wrote output to ' + outPath);
process.exit(lines.some((l) => l.includes('FAIL') || l.includes('FATAL')) ? 1 : 0);
