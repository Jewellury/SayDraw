'use client';

/**
 * VoiceRecorder — TASK-018 strategy-aware voice capture component.
 *
 * Encapsulates the full three-tier fallback chain (Volcano → Web Speech → typing
 * always usable) on top of the existing press-and-hold mic-button JSX. The
 * parent renders the mic button itself and forwards the six press/release
 * handlers; this component owns all the strategy logic so the parent stays
 * declarative.
 *
 * Strategy decision is made at PRESS TIME from a cached capability probe
 * (fixes audit P1-3 — no post-release fallback problem). Post-release Volcano
 * failure shows a gentle message; it does NOT attempt to start Web Speech
 * (which would be listening to silence).
 *
 * Analytics:
 *   - voice_input_started fires exactly once per press, on press, regardless
 *     of strategy (committedRef guards against double-fire).
 *   - voice_input_completed fires exactly once per SUCCESSFUL press, on first
 *     non-empty transcript landing.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { track } from '@/lib/analytics/track';
import { EVENTS } from '@/lib/analytics/events';
import type { VoiceLang, VoiceStrategy } from '@/lib/voice/types';

/* ------------------------------------------------------------------ */
/* Inline Web Speech API types (preserved verbatim from app/page.tsx).  */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/* ------------------------------------------------------------------ */
/* Props                                                                */
/* ------------------------------------------------------------------ */

export interface VoiceRecorderHandle {
  /** Imperatively stop the active capture (used by parent's `toggleLang`). */
  stop: () => void;
}

export interface VoiceRecorderProps {
  /** Active language ('zh' | 'en'). The recorder maps to BCP-47 internally. */
  lang: 'zh' | 'en';
  /** Current speaker — passed through to analytics payloads. */
  speaker: 'dad' | 'kid';
  /** Live transcript fills this setter (parent owns the input box). */
  onTranscript: (text: string) => void;
  /** Live "listening" flag. Recorder flips true on press, false on settle. */
  onListeningChange: (listening: boolean) => void;
  /**
   * Live "transcribing" flag — true while the released audio is POSTing to
   * the transcription endpoint (Volcano path only; Web Speech returns inline).
   * Lets the parent show a "recognizing…" hint during the ~1-2s round-trip.
   */
  onTranscribingChange?: (transcribing: boolean) => void;
  /** Surfaces a child-safe UI message (typed tokens or raw string). */
  onError: (message: string) => void;
  /** Clears any prior error message (called at press time). */
  onClearError: () => void;
  /** Pre-merged localized strings for child-safe UI messages. */
  strings: {
    voiceUnsupported: string;
    retry: string;
  };
  /** Renders the mic button; receives the six press/release handlers. */
  renderButton: (handlers: {
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => void;
    onTouchEnd: (e: React.TouchEvent<HTMLButtonElement>) => void;
    onTouchCancel: (e: React.TouchEvent<HTMLButtonElement>) => void;
  }) => ReactNode;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function audioWorkletSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.AudioContext !== 'undefined' &&
    'audioWorklet' in AudioContext.prototype
  );
}

function getSpeechRecognitionCtor():
  | SpeechRecognitionConstructor
  | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Maps a route error token to a child-safe localized string. */
function mapErrorToken(token: string, strings: VoiceRecorderProps['strings']): string {
  // Tokens are stable identifiers from /api/voice/transcribe. Map known
  // ones to localized copy; unknown tokens fall back to the generic retry.
  switch (token) {
    case 'voice-error-empty':
    case 'voice-error-empty-audio':
    case 'voice-error-no-credentials':
    case 'voice-error-network':
    case 'voice-error-timeout':
    case 'voice-error-protocol':
    case 'voice-error-server':
    case 'voice-error-auth':
    case 'voice-error-bad-request':
    case 'voice-error-no-audio':
    case 'voice-error-audio-too-large':
    case 'voice-error-unexpected':
      return strings.retry;
    default:
      return strings.retry;
  }
}

const CAPABILITY_PROBE_TIMEOUT_MS = 2000;

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const VoiceRecorder = forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(function VoiceRecorder(props, ref) {
  const { lang, speaker, onTranscript, onListeningChange, onTranscribingChange, onError, onClearError, strings, renderButton } = props;

  // --- Cached strategy (set once on mount via capability probe) ---
  const [strategy, setStrategy] = useState<VoiceStrategy>('none');

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CAPABILITY_PROBE_TIMEOUT_MS);

    async function probe() {
      try {
        const res = await fetch('/api/voice/capability', {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('capability-non-2xx');
        const data = (await res.json()) as { available?: boolean };
        if (cancelled) return;
        if (data.available === true && audioWorkletSupported()) {
          setStrategy('volcano');
        } else if (getSpeechRecognitionCtor()) {
          setStrategy('web-speech');
        } else {
          setStrategy('none');
        }
      } catch {
        if (cancelled) return;
        // Fail-safe (AC3): fall through to web-speech or none.
        if (getSpeechRecognitionCtor()) setStrategy('web-speech');
        else setStrategy('none');
      } finally {
        clearTimeout(timer);
      }
    }
    probe();
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  // --- Live capture state ---
  const listeningRef = useRef(false);
  const committedRef = useRef(false); // analytics fire-once guard
  const sessionRef = useRef(0); // overlap guard: stale POST can't write after a fresh press

  // Web Speech fallback refs (preserved from TASK-013 logic)
  const recRef = useRef<SpeechRecognition | null>(null);

  // Volcano capture refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const pcmChunksRef = useRef<Uint8Array[]>([]);
  const workletReadyRef = useRef(false); // addModule is one-shot
  const inFlightPostRef = useRef(false);

  // Lang needs to be reachable inside event handlers without rebinding them.
  const langRef = useRef<'zh' | 'en'>(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const setListening = useCallback(
    (v: boolean) => {
      listeningRef.current = v;
      onListeningChange(v);
    },
    [onListeningChange]
  );

  /** Tear down any in-flight Volcano capture (overlap guard + lang switch). */
  const teardownVolcanoCapture = useCallback(() => {
    try {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      }
    } catch { /* best effort */ }
    workletNodeRef.current = null;
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch { /* best effort */ }
    micStreamRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch { /* best effort */ }
    audioCtxRef.current = null;
    pcmChunksRef.current = [];
  }, []);

  // ----------------------------------------------------------------
  // Web Speech fallback path (TASK-013 logic preserved)
  // ----------------------------------------------------------------
  const startWebSpeech = useCallback(() => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      onError(strings.voiceUnsupported);
      return;
    }
    const rec = new SR();
    rec.lang = langRef.current === 'zh' ? 'zh-CN' : 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (committedRef.current) return;
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0] ? r[0].transcript : '';
      }
      const t = finalText.trim();
      if (!t) return;
      committedRef.current = true;
      onTranscript(t);
      track(EVENTS.VOICE_INPUT_COMPLETED, { speaker });
    };
    rec.onend = () => {
      setListening(false);
    };
    rec.onerror = () => {
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    onClearError();
    try {
      rec.start();
    } catch {
      // Some browsers throw on double-start; degrade silently.
      setListening(false);
    }
  }, [onClearError, onError, onTranscript, setListening, speaker, strings.voiceUnsupported]);

  const stopWebSpeech = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch { /* best effort */ }
    recRef.current = null;
    setListening(false);
  }, [setListening]);

  // ----------------------------------------------------------------
  // Volcano capture path (PCM via AudioWorklet, POST on release)
  // ----------------------------------------------------------------
  const startVolcanoCapture = useCallback(async () => {
    try {
      // getUserMedia: any failure here is terminal — gentle message + typing
      // usable. We do NOT fall through to Web Speech (same mic would fail too).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      const ctx = new AudioCtor({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      if (!workletReadyRef.current) {
        await ctx.audioWorklet.addModule('/pcmWorklet.js');
        workletReadyRef.current = true;
      }

      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-processor');
      node.port.onmessage = (ev: MessageEvent) => {
        const buf = ev.data as ArrayBuffer;
        if (!buf || !(buf instanceof ArrayBuffer)) return;
        // Copy into a fresh Uint8Array — the transferred buffer is now ours.
        pcmChunksRef.current.push(new Uint8Array(buf.slice(0)));
      };
      source.connect(node);
      // The worklet must be in the graph downstream of the source AND connected
      // to ctx.destination for the browser to call process() — but we don't want
      // to actually play the mic back through the speakers. A zero-gain node in
      // between guarantees silence on the output while keeping the worklet live.
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      node.connect(silentGain);
      silentGain.connect(ctx.destination);

      workletNodeRef.current = node;
      setListening(true);
      onClearError();
      return true;
    } catch (e) {
      const name = (e as Error).name || '';
      if (name === 'NotAllowedError' || name === 'NotFoundError' || name === 'SecurityError') {
        // Permission denial or no mic — gentle message, typing usable.
        onError(strings.retry);
      } else {
        onError(strings.retry);
      }
      teardownVolcanoCapture();
      return false;
    }
  }, [onClearError, onError, setListening, strings.retry, teardownVolcanoCapture]);

  const stopVolcanoCaptureAndTranscribe = useCallback(async (session: number) => {
    // Stop the worklet + mic FIRST so the capture buffer is final, then POST.
    const captured = pcmChunksRef.current;
    pcmChunksRef.current = [];

    try {
      workletNodeRef.current?.port.postMessage({ kind: 'flush' });
    } catch { /* best effort, no flush handler in the worklet */ }

    try {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      }
    } catch { /* best effort */ }
    workletNodeRef.current = null;
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch { /* best effort */ }
    micStreamRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch { /* best effort */ }
    audioCtxRef.current = null;

    setListening(false);

    if (captured.length === 0) {
      // No audio captured (worklet never produced a frame). Treat as empty.
      onError(strings.retry);
      return;
    }

    if (inFlightPostRef.current) {
      // Previous POST still in flight — overlap guard skips this one.
      return;
    }

    inFlightPostRef.current = true;
    onTranscribingChange?.(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const blob = new Blob(captured as BlobPart[], { type: 'application/octet-stream' });
      const fd = new FormData();
      fd.append('audio', blob);
      fd.append('lang', langRef.current === 'zh' ? 'zh-CN' : 'en-US');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: fd,
        signal: ctrl.signal,
      });
      if (session !== sessionRef.current) return; // stale response guard
      const data = (await res.json()) as { text?: string; error?: string };
      if (typeof data.text === 'string' && data.text.length > 0) {
        if (!committedRef.current) {
          committedRef.current = true;
          onTranscript(data.text);
          track(EVENTS.VOICE_INPUT_COMPLETED, { speaker });
        }
        return;
      }
      // Empty transcript OR explicit error token -> gentle message.
      onError(mapErrorToken(typeof data.error === 'string' ? data.error : '', strings));
    } catch {
      if (session !== sessionRef.current) return;
      onError(strings.retry);
    } finally {
      clearTimeout(timer);
      inFlightPostRef.current = false;
      onTranscribingChange?.(false);
    }
  }, [onError, onTranscript, onTranscribingChange, setListening, speaker, strings]);

  // ----------------------------------------------------------------
  // Public dispatchers (mic button's six handlers)
  // ----------------------------------------------------------------
  const startVoice = useCallback(() => {
    onClearError(); // always clear stale errors, even on early-return
    if (listeningRef.current) return; // overlap guard (AC10)
    if (inFlightPostRef.current) return; // a previous POST is mid-flight
    sessionRef.current += 1;
    committedRef.current = false;
    track(EVENTS.VOICE_INPUT_STARTED, { speaker });

    if (strategy === 'volcano' && audioWorkletSupported()) {
      void startVolcanoCapture().then((ok) => {
        if (!ok) {
          // getUserMedia denied or worklet failure — gentle msg, typing usable.
          // Per AC6, do NOT fall through to Web Speech (same mic, would fail).
          setListening(false);
        }
      });
      return;
    }

    if (strategy === 'web-speech') {
      startWebSpeech();
      return;
    }

    // 'none' — browser supports neither Volcano (no creds / no worklet) nor Web Speech.
    onError(strings.voiceUnsupported);
  }, [
    onClearError,
    onError,
    speaker,
    startVolcanoCapture,
    startWebSpeech,
    setListening,
    strategy,
    strings.voiceUnsupported,
  ]);

  const stopVoice = useCallback(() => {
    const session = sessionRef.current;
    // If Volcano capture is active (mic stream open), tear down + POST.
    if (micStreamRef.current || workletNodeRef.current || audioCtxRef.current) {
      void stopVolcanoCaptureAndTranscribe(session);
      return;
    }
    // Otherwise Web Speech (if any).
    stopWebSpeech();
  }, [stopVolcanoCaptureAndTranscribe, stopWebSpeech]);

  // ----------------------------------------------------------------
  // Imperative stop (parent uses this from `toggleLang` etc.)
  // ----------------------------------------------------------------
  useImperativeHandle(
    ref,
    () => ({
      stop: () => {
        if (!listeningRef.current) return;
        stopVoice();
      },
    }),
    [stopVoice]
  );

  // ----------------------------------------------------------------
  // Cleanup on unmount
  // ----------------------------------------------------------------
  useEffect(() => {
    return () => {
      teardownVolcanoCapture();
      try {
        recRef.current?.abort();
      } catch { /* best effort */ }
      recRef.current = null;
    };
  }, [teardownVolcanoCapture]);

  // ----------------------------------------------------------------
  // Render — defer entirely to parent for JSX, only wire handlers
  // ----------------------------------------------------------------
  return (
    <>
      {renderButton({
        onMouseDown: (e) => { e.preventDefault(); startVoice(); },
        onMouseUp: () => { if (listeningRef.current) stopVoice(); },
        onMouseLeave: () => { if (listeningRef.current) stopVoice(); },
        onTouchStart: (e) => { e.preventDefault(); startVoice(); },
        onTouchEnd: (e) => { e.preventDefault(); if (listeningRef.current) stopVoice(); },
        onTouchCancel: () => { if (listeningRef.current) stopVoice(); },
      })}
    </>
  );
});

export default VoiceRecorder;
