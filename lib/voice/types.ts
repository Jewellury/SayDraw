/**
 * Shared voice types — isomorphic (imported by both client and server).
 * No server-only code lives here. No env reads. No VOLC_* exposure.
 */

export type VoiceLang = 'zh-CN' | 'en-US';

/**
 * Strategy resolved at mic-press time from the cached capability probe.
 *  - 'volcano'   : Vercel WS-client → Volcano bigmodel_nostream (PCM, one-shot)
 *  - 'web-speech': browser-native SpeechRecognition fallback
 *  - 'none'      : unsupported — typing still usable
 */
export type VoiceStrategy = 'volcano' | 'web-speech' | 'none';

/** Multipart fields posted to /api/voice/transcribe. */
export interface TranscribeRequest {
  /** Raw PCM bytes (pcm_s16le @ 16 kHz / mono). Sent as multipart field 'audio'. */
  audio: Blob;
  /** BCP-47 lang code. Default 'zh-CN'. Sent as multipart field 'lang'. */
  lang?: VoiceLang;
}

/** Successful transcribe response — final transcript only (no live partials). */
export interface TranscribeSuccess {
  text: string;
}

/** Failed transcribe response. Always child-safe copy; never includes VOLC_*. */
export interface TranscribeFailure {
  error: string;
}

export type TranscribeResponse = TranscribeSuccess | TranscribeFailure;

/** GET /api/voice/capability response. */
export interface CapabilityResponse {
  available: boolean;
}
