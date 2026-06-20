/**
 * GET /api/voice/capability
 *
 * Returns `{ available: boolean }` based purely on `hasVolcanoCredentials()`.
 * Contains NO credentials or secret-derived data. Separate file/URL from the
 * transcribe route (fixes audit P1-1). Cheap to call — warms the function
 * for the eventual transcribe call (fixes audit P2-1).
 */

import { NextResponse } from 'next/server';
import { hasVolcanoCredentials } from '@/lib/voice/volcanoAsr';
import type { CapabilityResponse } from '@/lib/voice/types';

export const runtime = 'nodejs';
// Capability check is a fast sync check; short duration is fine.
export const maxDuration = 5;

export async function GET() {
  const body: CapabilityResponse = { available: hasVolcanoCredentials() };
  return NextResponse.json(body);
}
