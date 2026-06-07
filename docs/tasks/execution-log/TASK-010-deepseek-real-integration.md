# TASK-010 Execution Log

## Metadata
- **Task**: TASK-010-deepseek-real-integration
- **Agent**: execute-agent
- **Started**: 2026-06-07
- **Lane**: Full

## Summary
Implemented DeepSeek API real integration with dual-model fallback, JSON mode, SVG sanitization chain, and upgraded response types across 4 files.

## Phase 0: Baseline
| Check | Result |
|-------|--------|
| `tsc --noEmit` | Pass (clean) |
| Pre-edit backups | Created at `docs/tasks/artifacts/TASK-010-deepseek-real-integration/pre-edit/` |

## Files Changed

### 1. `lib/story/types.ts`
- Added `followUpQuestion?: string` to `GenerateResponse`
- Added `storySummary?: string` to `GenerateResponse`
- Backward compatible — existing consumers only destructure `narration` and `svg`

### 2. `lib/ai/prompts.ts`
- Changed ink color from `#1f1c18` to `#211e18`
- Element count range: 10–24 (was 10–22)
- Added `followUpQuestion` and `storySummary` to JSON output description
- Added JSON format example: `{ "narration": "...", "svg": "...", "followUpQuestion": "...", "storySummary": "..." }`
- DeepSeek JSON mode compliance: prompt includes word "json" and JSON example
- Added explicit rules: no fill (except `fill="none"`), no text elements, no color attributes
- Described `followUpQuestion` as open-ended question (≤15 chars)
- Described `storySummary` as 2-3 sentence story summary

### 3. `lib/ai/deepseek.ts`
- Replaced `chatCompletion()` with `generateStoryFrame(systemPrompt, userMessage) => Promise<string>`
- Added `NoApiKeyError` class for clean key-missing detection
- Internal `callDeepSeek()` helper: handles single model call with fetch + error handling
- `generateStoryFrame()`: primary model → catch error → fallback model → catch error → throw
- Environment constants: `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`), `DEEPSEEK_MODEL` (default `deepseek-v4-flash`), `DEEPSEEK_FALLBACK_MODEL` (default `deepseek-v4-pro`)
- Added `response_format: { type: "json_object" }` to request body
- Temperature changed from 0.7 to 0.75
- Server-side `console.error` logging for both primary and fallback failures
- All env reads are `process.env.*` — never `NEXT_PUBLIC_*`

### 4. `app/api/story/generate/route.ts`
- Import changed: `chatCompletion` → `generateStoryFrame`
- Added `FALLBACK_SVG` constant (hardcoded safe SVG with `#211e18` ink)
- Added `ParsedScene` interface with `followUpQuestion?` and `storySummary?`
- Replaced `parseScene()` with `parseResponse()`: extracts all 4 fields from JSON, falls back to regex SVG extraction
- Added `validateSvg()`: checks non-empty, contains `<svg`, contains `</svg>` → returns `FALLBACK_SVG` on failure
- Real path: `generateStoryFrame` → `parseResponse` → `sanitizeSvg` → `validateSvg`
- Error chain: primary fail → fallback model fail → mock fallback (200 OK)
- Unhandled exceptions return 500 with child-safe message

## Error Chain Verification
| Layer | Trigger | Behavior |
|-------|---------|----------|
| 1 | Key missing | Mock fallback immediately |
| 2 | Primary model fails | Console.error + retry with fallback model |
| 3 | Both models fail | Console.error + mock fallback (200 OK) |
| 4 | JSON parse fails | Regex extract SVG; if no SVG → `FALLBACK_SVG` for narration, `''` for svg |
| 5 | Post-sanitize SVG empty/missing tags | `validateSvg()` returns `FALLBACK_SVG` |
| 6 | Unhandled exception | 500 with "画板打了个小盹，再说一次试试" |

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | Pass (0 errors) |
| `npm run build` | Pass (clean) |
| `npm run lint` | Pass (0 warnings, 0 errors) |

## Implementation Notes
- Pre-edit backup files renamed to `.txt` extension to avoid TypeScript build errors from artifacts directory
- `lib/ai/mock.ts` unchanged — mock data uses `#1f1c18` ink (from TASK-007); difference from `#211e18` is visually imperceptible, as noted in plan risks
- `lib/svg/sanitizeSvg.ts` unchanged — existing sanitizer is sufficient
- `app/page.tsx` unchanged — existing loop continues to work (destructures `narration` and `svg`, ignores extra fields)
- No new dependencies, no config changes, no environment variable exposure to client

## Handoff
Task ready for audit-agent review.
