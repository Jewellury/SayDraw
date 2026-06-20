/**
 * POST /api/voice/transcribe
 *
 * Multipart/form-data with fields:
 *   - audio : raw PCM bytes (pcm_s16le @ 16 kHz / mono) — required, ≤ 4 MB
 *   - lang  : 'zh-CN' | 'en-US' — optional, default 'zh-CN'
 *
 * Response (always HTTP 200 on a completed transcribe attempt, so the client
 * can distinguish "transcribe ran" from a network failure):
 *   - success            : { text: "..." }
 *   - empty transcript   : { text: "" }
 *   - transcribe failure : { error: "child-safe message token" }
 *   - unexpected error   : HTTP 500 { error: ... }
 *
 * Never logs VOLC_* values, audio content, or transcripts. On Volcano error
 * only `X-Tt-Logid`, the error `kind`, and the numeric `code` are logged
 * (handled inside volcanoAsr.ts).
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import {
  transcribeWithVolcano,
  hasVolcanoCredentials,
  VolcanoAsrError,
  childSafeTokenFor,
} from '@/lib/voice/volcanoAsr';
import type {
  TranscribeResponse,
  TranscribeSuccess,
  TranscribeFailure,
  VoiceLang,
} from '@/lib/voice/types';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // 4 MB hard cap (AC4)
const TRANSCRIBE_TIMEOUT_MS = 25_000; // 25 s — Vercel cap is 30 s; leave headroom

function isVoiceLang(v: unknown): v is VoiceLang {
  return v === 'zh-CN' || v === 'en-US';
}

export async function POST(req: NextRequest) {
  // 1. Fast 404-style guard if no creds at all — route still exists for shape.
  if (!hasVolcanoCredentials()) {
    const body: TranscribeFailure = { error: 'voice-error-no-credentials' };
    return NextResponse.json(body);
  }

  // 2. Parse multipart form.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    const body: TranscribeFailure = { error: 'voice-error-bad-request' };
    return NextResponse.json(body, { status: 400 });
  }

  const audioBlob = form.get('audio');
  if (!(audioBlob instanceof Blob)) {
    const body: TranscribeFailure = { error: 'voice-error-no-audio' };
    return NextResponse.json(body, { status: 400 });
  }
  if (audioBlob.size === 0) {
    const body: TranscribeFailure = { error: 'voice-error-empty-audio' };
    return NextResponse.json(body);
  }
  if (audioBlob.size > MAX_AUDIO_BYTES) {
    const body: TranscribeFailure = { error: 'voice-error-audio-too-large' };
    return NextResponse.json(body, { status: 413 });
  }

  const rawLang = form.get('lang');
  const lang: VoiceLang = typeof rawLang === 'string' && isVoiceLang(rawLang) ? rawLang : 'zh-CN';

  // 3. PCM bytes (uint8 array view → Node Buffer).
  const arrayBuf = await audioBlob.arrayBuffer();
  const pcm = Buffer.from(arrayBuf);

  // 4. Run transcribe under a hard 25 s budget (race against timeout).
  const transcribePromise = transcribeWithVolcano(pcm, lang);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new VolcanoAsrError('timeout', 'route-timeout')), TRANSCRIBE_TIMEOUT_MS);
  });

  let text: string;
  try {
    text = await Promise.race([transcribePromise, timeoutPromise]);
  } catch (e) {
    if (e instanceof VolcanoAsrError) {
      // 'empty' (45000002) maps to an empty-text success per AC4.
      if (e.kind === 'empty') {
        const body: TranscribeSuccess = { text: '' };
        return NextResponse.json(body);
      }
      const body: TranscribeFailure = { error: childSafeTokenFor(e.kind) };
      return NextResponse.json(body);
    }
    // Unexpected exception — never expose internal message verbatim.
    console.error('[api/voice/transcribe] unexpected error kind=' + (e as Error).name);
    const body: TranscribeFailure = { error: 'voice-error-unexpected' };
    return NextResponse.json(body, { status: 500 });
  }

  const body: TranscribeResponse = { text };
  return NextResponse.json(body);
}
