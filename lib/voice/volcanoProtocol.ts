/**
 * Volcano bigmodel_nostream binary protocol codec — pure functions, isomorphic.
 *
 * Every byte position is documented in
 * docs/tasks/plan/TASK-018-volcano-asr-voice.md ("Volcano bigmodel_nostream
 * Contract"). This module is the single source of truth for the on-wire format.
 *
 * IMPORTANT — proven against the live Volcano endpoint:
 *  - Connectivity test on 2026-06-20 (scripts/test-volcano-asr.mjs) confirmed
 *    Volcano's "Gzip" flag expects STANDARD gzip format (0x1f 0x8b magic header),
 *    NOT raw deflate. We use Node's gzipSync / gunzipSync.
 *  - Audio frames MUST also carry the Gzip compression nibble (byte 2 = 0x01)
 *    and a gzipped payload. The plan's pseudocode (byte 2 = 0x00 raw) was
 *    superseded by the live test script, which the active_spec explicitly
 *    names as the source of truth.
 *
 * All multi-byte integer header fields are BIG-endian (network order).
 * The PCM *samples* themselves are little-endian (pcm convention) and are
 * not interpreted here — they are opaque bytes the codec compresses as-is.
 */

import { gzipSync, gunzipSync } from 'node:zlib';

// ---- Byte 0: protocol version | header size ----
const VERSION_HEADER_BYTE = 0x11; // high nibble 0b0001 = v1; low nibble 0b0001 = 1 × 4-byte header

// ---- Byte 1: message type (high nibble) | type-specific flags (low nibble) ----
const MSG_FULL_CLIENT_REQUEST = 0x10; // type 0b0001 (full client request), flags 0b0000
const MSG_AUDIO_MORE = 0x20; // type 0b0010 (audio only), flags 0b0000 (more coming)
const MSG_AUDIO_LAST = 0x22; // type 0b0010 (audio only), flags 0b0010 (last / end-of-stream)
const MSG_TYPE_MASK = 0xf0;
const MSG_TYPE_SERVER_ERROR = 0xf0; // type 0b1111 (server error)

// ---- Byte 2: serialization (high nibble) | compression (low nibble) ----
const SER_JSON_GZIP = 0x11; // JSON + Gzip
const SER_RAW_GZIP = 0x01; // no serialization (raw) + Gzip  ← proven correct for audio frames
const COMPRESSION_GZIP = 0x01;
const COMPRESSION_MASK = 0x0f;

// ---- Byte 3: reserved ----
const RESERVED_BYTE = 0x00;

const HEADER_SIZE_BYTES = 4; // bytes 0..3

/**
 * Client → Server: full client request (initial JSON metadata frame).
 * Layout: [4B header = 0x11 0x10 0x11 0x00][4B BE payload size][Gzipped JSON]
 */
export function encodeFullClientRequest(payload: object): Buffer {
  const jsonBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const payloadGz = gzipSync(jsonBytes);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payloadGz.length, 0);
  return Buffer.concat([
    Buffer.from([VERSION_HEADER_BYTE, MSG_FULL_CLIENT_REQUEST, SER_JSON_GZIP, RESERVED_BYTE]),
    size,
    payloadGz,
  ]);
}

/**
 * Client → Server: audio-only frame.
 * Layout: [4B header = 0x11 (0x20 | 0x22) 0x01 0x00][4B BE payload size][Gzipped PCM]
 *
 * Note: the Gzip flag on audio frames is required by the live endpoint (verified
 * 2026-06-20). `isLast = true` flips the type nibble's flags bit to mark
 * end-of-stream.
 */
export function encodeAudioFrame(pcm: Buffer, isLast: boolean): Buffer {
  const compressed = gzipSync(pcm);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressed.length, 0);
  return Buffer.concat([
    Buffer.from([
      VERSION_HEADER_BYTE,
      isLast ? MSG_AUDIO_LAST : MSG_AUDIO_MORE,
      SER_RAW_GZIP,
      RESERVED_BYTE,
    ]),
    size,
    compressed,
  ]);
}

export type DecodedServerMessage =
  | { type: 'response'; sequence: number; payload: unknown }
  | { type: 'error'; code: number; message: string };

/**
 * Server → Client: full server response OR server error.
 *
 * Response layout: [4B header = 0x11 0x9Y 0x?1 0x00][4B BE sequence (signed int32)]
 *                  [4B BE payload size][optional Gzipped JSON]
 * Error    layout: [4B header = 0x11 0xF0 0x00 0x00][4B BE error code]
 *                  [4B BE msg size][N bytes UTF-8 message]
 *
 * Discriminator: byte 1 high nibble (0xF0 = error, anything else = response).
 */
export function decodeServerMessage(buf: Buffer): DecodedServerMessage {
  const msgType = buf[1] & MSG_TYPE_MASK;

  if (msgType === MSG_TYPE_SERVER_ERROR) {
    const code = buf.readUInt32BE(HEADER_SIZE_BYTES);
    const msgSize = buf.readUInt32BE(HEADER_SIZE_BYTES + 4);
    const message = buf
      .subarray(HEADER_SIZE_BYTES + 8, HEADER_SIZE_BYTES + 8 + msgSize)
      .toString('utf8');
    return { type: 'error', code, message };
  }

  // Full server response
  const sequence = buf.readInt32BE(HEADER_SIZE_BYTES);
  const payloadSize = buf.readUInt32BE(HEADER_SIZE_BYTES + 4);
  const compression = buf[2] & COMPRESSION_MASK;
  let payload: Buffer = buf.subarray(
    HEADER_SIZE_BYTES + 8,
    HEADER_SIZE_BYTES + 8 + payloadSize
  );
  if (compression === COMPRESSION_GZIP) {
    payload = gunzipSync(payload);
  }
  let parsed: unknown = payload.toString('utf8');
  try {
    parsed = JSON.parse(parsed as string);
  } catch {
    // Keep raw string if JSON parse fails (defensive — Volcano always sends JSON).
  }
  return { type: 'response', sequence, payload: parsed };
}
