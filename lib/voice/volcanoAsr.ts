/**
 * Volcano ASR server-only client.
 *
 * Speaks the bigmodel_nostream binary WebSocket protocol to Volcano Engine.
 * All `VOLC_*` env reads happen here, server-side. Never imported by client
 * components (the `import 'server-only'` guard makes any client import fail
 * at build time, satisfying AC14).
 *
 * Auth shape resolved at call time (AC1):
 *   - New console  : VOLC_API_KEY                       -> X-Api-Key
 *   - Old console  : VOLC_APP_KEY + VOLC_ACCESS_KEY     -> X-Api-App-Key + X-Api-Access-Key
 *
 * Never log any X-Api-* request header value. On error, only X-Tt-Logid and
 * numeric error codes may be logged.
 */

import 'server-only';
import { randomUUID } from 'crypto';
import {
  encodeFullClientRequest,
  encodeAudioFrame,
  decodeServerMessage,
  DecodedServerMessage,
} from './volcanoProtocol';
import type { VoiceLang } from './types';

// IMPORTANT: load `ws` via runtime require, not a static import. Next.js
// bundles the static `import WebSocket from 'ws'` and the bundled version
// has a known bug: webpack's module resolver turns `ws`'s optional
// `require('bufferutil')` (inside a try/catch) into a stub module, so the
// bundled ws's overridden `module.exports.mask` later calls
// `b.mask(...)` at send time and throws "b.mask is not a function".
// Going through `eval('require')` defeats webpack's static analysis so
// Node loads the real `ws` module, where the optional-require try/catch
// works correctly (bufferutil not installed → silent catch → JS fallback).
//
// `eval('require')` is the canonical webpack-bypass pattern; it is safe
// here because this module is server-only (`import 'server-only'` above)
// and the `ws` package is a runtime dependency.
// eslint-disable-next-line no-eval
const dynamicRequire = eval('require') as NodeRequire;
import type WebSocketType from 'ws';
const VolcanoWebSocket: typeof WebSocketType = dynamicRequire('ws');

export type VolcanoAsrErrorKind =
  | 'auth'
  | 'network'
  | 'timeout'
  | 'protocol'
  | 'server'
  | 'empty';

export class VolcanoAsrError extends Error {
  readonly kind: VolcanoAsrErrorKind;
  readonly code?: number;
  constructor(kind: VolcanoAsrErrorKind, message: string, code?: number) {
    super(message);
    this.name = 'VolcanoAsrError';
    this.kind = kind;
    this.code = code;
  }
}

const DEFAULT_BASE_URL = 'wss://openspeech.bytedance.com';
const DEFAULT_ENDPOINT_PATH = '/api/v3/sauc/bigmodel_nostream';
const DEFAULT_RESOURCE_ID = 'volc.seedasr.sauc.duration';
const DEFAULT_MODEL_NAME = 'bigmodel';

/** Per AC1: capability is determined purely by credential presence. */
export function hasVolcanoCredentials(): boolean {
  const { VOLC_API_KEY, VOLC_APP_KEY, VOLC_ACCESS_KEY } = process.env;
  return Boolean(VOLC_API_KEY) || Boolean(VOLC_APP_KEY && VOLC_ACCESS_KEY);
}

function buildAuthHeaders(): Record<string, string> {
  const requestId = randomUUID();
  const resourceId = process.env.VOLC_RESOURCE_ID || DEFAULT_RESOURCE_ID;
  const sequence = '-1';

  if (process.env.VOLC_API_KEY) {
    return {
      'X-Api-Key': process.env.VOLC_API_KEY,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': sequence,
    };
  }

  // Old console shape — guaranteed by hasVolcanoCredentials() caller check.
  const appKey = process.env.VOLC_APP_KEY;
  const accessKey = process.env.VOLC_ACCESS_KEY;
  if (!appKey || !accessKey) {
    // Defensive: never throw a string with the secret. This branch is unreachable
    // when called via the route handler (it gates on hasVolcanoCredentials).
    throw new VolcanoAsrError('auth', 'missing-volc-credentials');
  }
  return {
    'X-Api-App-Key': appKey,
    'X-Api-Access-Key': accessKey,
    'X-Api-Resource-Id': resourceId,
    'X-Api-Request-Id': requestId,
    'X-Api-Sequence': sequence,
  };
}

function buildFullClientPayload(lang: VoiceLang): object {
  const modelName = process.env.VOLC_MODEL_NAME || DEFAULT_MODEL_NAME;
  return {
    user: { uid: 'saydraw-session-' + randomUUID() },
    audio: {
      format: 'pcm',
      rate: 16000,
      bits: 16,
      channel: 1,
      language: lang,
    },
    request: {
      model_name: modelName,
      enable_itn: true,
      enable_punc: true,
      enable_ddc: false,
      result_type: 'full',
    },
  };
}

/** Map a Volcano numeric error code to a typed kind (AC15). */
function classifyErrorCode(code: number): VolcanoAsrErrorKind {
  if (code === 45000002) return 'empty';
  if (code === 45000081) return 'timeout';
  if (code === 45000001 || code === 45000151) return 'protocol';
  if (code >= 55000000) return 'server';
  return 'protocol';
}

const CHILD_SAFE_KIND_MESSAGE: Record<VolcanoAsrErrorKind, string> = {
  auth: 'voice-error-auth',
  network: 'voice-error-network',
  timeout: 'voice-error-timeout',
  protocol: 'voice-error-protocol',
  server: 'voice-error-server',
  empty: 'voice-error-empty',
};

/** A non-secret token the route handler can map to child-safe copy itself. */
export function childSafeTokenFor(kind: VolcanoAsrErrorKind): string {
  return CHILD_SAFE_KIND_MESSAGE[kind];
}

/**
 * Run a one-shot transcription against Volcano bigmodel_nostream.
 *
 * Send sequence (one-shot):
 *   1. open WS with X-Api-* auth headers
 *   2. send full client request (Gzipped JSON metadata)
 *   3. stream audio chunks (~3200 bytes = 100ms) as audio-only frames
 *   4. send final empty frame with the "last" flag
 *   5. collect response frames; the live endpoint emits one response per chunk
 *      with a partial `result.text`; the LAST frame has the complete transcript
 *      — we accumulate and use the final `result.text` as the canonical result
 *      (per active_spec.md connectivity test discovery, 2026-06-20).
 *   6. close
 *
 * @param pcm 16 kHz / 16-bit / mono PCM (pcm_s16le). Forwarded unchanged.
 * @param lang BCP-47 lang code passed through as `audio.language`.
 */
export async function transcribeWithVolcano(
  pcm: Buffer,
  lang: VoiceLang
): Promise<string> {
  if (!hasVolcanoCredentials()) {
    throw new VolcanoAsrError('auth', 'missing-volc-credentials');
  }

  const baseUrl = process.env.VOLC_BASE_URL || DEFAULT_BASE_URL;
  const endpointPath = process.env.VOLC_ENDPOINT_PATH || DEFAULT_ENDPOINT_PATH;
  const url = baseUrl + endpointPath;
  const headers = buildAuthHeaders();

  // 25 s overall timeout (Vercel fn cap is 30 s; leave 5 s of headroom).
  const TIMEOUT_MS = 25_000;
  // 100 ms audio chunks @ 16 kHz / 16-bit / mono = 3200 bytes per chunk.
  const CHUNK_BYTES = 3200;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let lastText = '';
    let lastLogId: string | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finishOk = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(lastText);
    };
    const finishErr = (err: VolcanoAsrError) => {
      if (settled) return;
      settled = true;
      cleanup();
      // On error, log only X-Tt-Logid (if we got it) and the numeric kind/code.
      // NEVER log X-Api-* request header values, the secret, or the audio.
      console.error('[volcano-asr] kind=' + err.kind + (err.code ? ' code=' + err.code : '') + (lastLogId ? ' logid=' + lastLogId : ''));
      reject(err);
    };
    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      try {
        if (ws.readyState === VolcanoWebSocket.OPEN || ws.readyState === VolcanoWebSocket.CONNECTING) {
          ws.terminate();
        }
      } catch {
        /* best effort */
      }
    };

    timeoutHandle = setTimeout(() => {
      finishErr(new VolcanoAsrError('timeout', 'volcano-timeout'));
    }, TIMEOUT_MS);

    let ws: InstanceType<typeof VolcanoWebSocket>;
    try {
      ws = new VolcanoWebSocket(url, { headers });
    } catch (e) {
      finishErr(new VolcanoAsrError('network', 'ws-construct-failed'));
      return;
    }

    ws.on('upgrade', (res) => {
      const logid = res.headers['x-tt-logid'] || res.headers['X-Tt-Logid'];
      if (typeof logid === 'string') lastLogId = logid;
    });

    ws.on('open', () => {
      try {
        ws.send(encodeFullClientRequest(buildFullClientPayload(lang)));
      } catch (e) {
        finishErr(new VolcanoAsrError('protocol', 'send-metadata-failed'));
        return;
      }

      try {
        if (pcm.length === 0) {
          ws.send(encodeAudioFrame(Buffer.alloc(0), true));
          return;
        }
        for (let off = 0; off < pcm.length; off += CHUNK_BYTES) {
          const chunk = pcm.subarray(off, Math.min(off + CHUNK_BYTES, pcm.length));
          const isLast = off + CHUNK_BYTES >= pcm.length;
          ws.send(encodeAudioFrame(chunk, isLast));
        }
      } catch (e) {
        finishErr(new VolcanoAsrError('protocol', 'send-audio-failed'));
      }
    });

    ws.on('message', (data) => {
      let buf: Buffer;
      if (Buffer.isBuffer(data)) {
        buf = data;
      } else if (data instanceof ArrayBuffer) {
        buf = Buffer.from(data);
      } else if (Array.isArray(data)) {
        buf = Buffer.concat(data.map((d) => (Buffer.isBuffer(d) ? d : Buffer.from(d))));
      } else {
        buf = Buffer.from(data as Uint8Array);
      }
      let decoded: DecodedServerMessage;
      try {
        decoded = decodeServerMessage(buf);
      } catch (e) {
        finishErr(new VolcanoAsrError('protocol', 'decode-failed'));
        return;
      }

      if (decoded.type === 'error') {
        const kind = classifyErrorCode(decoded.code);
        finishErr(new VolcanoAsrError(kind, 'volcano-error-' + decoded.code, decoded.code));
        return;
      }

      // Response: accumulate the latest `result.text` — the live endpoint
      // streams intermediate partials (one response per audio chunk); the
      // final response carries the complete transcript. We keep the most
      // recent non-empty text and resolve when the connection closes OR when
      // we receive a response whose payload indicates a fully-final result.
      const payload = decoded.payload as { result?: { text?: string } } | null;
      const text = payload?.result?.text;
      if (typeof text === 'string' && text.length > 0) {
        lastText = text;
      }
    });

    ws.on('error', (err) => {
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('403') || /unexpected response/i.test(msg)) {
        finishErr(new VolcanoAsrError('auth', 'volcano-auth-rejected'));
      } else {
        finishErr(new VolcanoAsrError('network', 'volcano-network: ' + msg));
      }
    });

    ws.on('close', () => {
      // The close signals end-of-stream. Whatever text we accumulated last
      // is the canonical final transcript.
      finishOk();
    });
    ws.on('unexpected-response', (_req, res) => {
      finishErr(new VolcanoAsrError('auth', 'volcano-http-' + res.statusCode));
    });
  });
}
