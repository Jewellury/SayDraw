# Audit Report — TASK-012B: Single-Model Fallback

**Auditor:** audit-agent
**Task:** TASK-012B — SVG Model Fallback to DeepSeek V4 Flash Single-Model
**Plan:** `docs/tasks/plan/TASK-012B-single-model-fallback.md`
**Execution Log:** `docs/tasks/execution-log/TASK-012B-single-model-fallback.md`
**Audit Date:** 2026-06-07
**Status:** TASK-012B in `audit`

---

## Summary

**Overall: PASS** — Zero findings. All 12 acceptance criteria are met. Build, typecheck, and lint all pass with zero errors/warnings. Key safety is intact. Error chain is complete. No forbidden changes detected.

---

## Automated Checks

| Check | Command | Result |
|-------|---------|--------|
| Build | `npx next build` | ✅ Compiled successfully |
| TypeScript | `npx tsc --noEmit` | ✅ Zero errors |
| Lint | `npm run lint` | ✅ Zero warnings |
| Key exposure (DEEPSEEK_API_KEY) | grep across codebase | ✅ Server-side only |
| Key exposure (NEXT_PUBLIC_*) | grep across app/ | ✅ Zero matches |
| Client Claude imports | grep for `generateSvg\|NoAnthropicKeyError` in `app/` | ✅ Zero matches |
| No new deps | Compare package.json | ✅ Unchanged |
| docs/00_design/ modification | git status | ✅ Untracked only (no modifications) |

---

## Acceptance Criteria Audit

### AC1 — Single DeepSeek call returns 4 fields

**Verdict: PASS**

Route at `app/api/story/generate/route.ts:82` calls `generateStoryFrame()` exactly once. No Claude/second-model call exists. The single call uses `COMBINED_SYS` prompt and `response_format: { type: 'json_object' }`. The response is parsed by `parseCombinedResponse()` at line 83 which extracts all 4 fields (`narration`, `followUpQuestion`, `storySummary`, `svg`).

### AC2 — Page shows narration text and animated SVG

**Verdict: PASS**

No changes to rendering paths. `DrawnSvg` (line 92-100), `FilmSvg` (line 102-109), and narration display (line 450-459) are preserved unchanged in `app/page.tsx`. The `GenerateResponse` type still carries `narration` and `svg` fields. Animation via CSS stroke-dashoffset self-drawing in `globals.css` is untouched.

### AC3 — Without DEEPSEEK_API_KEY: mock + FALLBACK_SVG

**Verdict: PASS**

Code path: `deepseek.ts:17-18` throws `NoApiKeyError` when no key → route catch block `route.ts:91-100` catches it → `getMockText(mockCounter++)` returns mock text → `svg = FALLBACK_SVG` → response 200 OK. The `mockCounter` increment pattern is preserved from prior implementation.

### AC4 — max_tokens=2000 in deepseek.ts

**Verdict: PASS**

`lib/ai/deepseek.ts:37`: `max_tokens: 2000` (was 1000, changed per plan).

### AC5 — FETCH_TIMEOUT_MS=30000 (30s)

**Verdict: PASS**

`lib/ai/deepseek.ts:3`: `const FETCH_TIMEOUT_MS = 30_000;` (was 25_000, changed per plan).

### AC6 — ANTHROPIC_API_KEY absence does NOT cause errors

**Verdict: PASS**

Route imports from `svg-model.ts` only `extractSvg` (utility function, no API call). `generateSvg` and `NoAnthropicKeyError` are NOT imported in the route. Grep confirms zero occurrences of `generateSvg` or `NoAnthropicKeyError` anywhere in `app/`. `ANTHROPIC_API_KEY` env var is never read by any code path in single-model mode.

### AC7 — svg-model.ts file preserved unmodified

**Verdict: PASS**

`lib/ai/svg-model.ts` exists with its original content (78 lines). Contains `extractSvg` utility (used by route), `generateSvg` function (dormant, preserved for switch-back), and `NoAnthropicKeyError` class. File is untracked in git (same as rest of repo — no commits exist yet). No modifications made.

### AC8 — COMBINED_SYS has "json" keyword + complete example; TEXT_SYS/SVG_SYS preserved

**Verdict: PASS**

- **COMBINED_SYS** (`prompts.ts:3-37`): Contains the word "json" / "JSON" 5+ times (lines 6, 7, 13, 15, 37). Includes complete JSON output example with all 4 fields (lines 7-12). Satisfies DeepSeek `json_object` mode requirement.
- **TEXT_SYS** (`prompts.ts:40-53`): Preceded by `// 备用 — 切回双模型时使用` comment at line 39. Full content preserved.
- **SVG_SYS** (`prompts.ts:56-73`): Preceded by `// 备用 — 切回双模型时使用` comment at line 55. Full content preserved.
- **INK** and **SCENE_SYS**: Unchanged. SCENE_SYS still `= TEXT_SYS` (line 75).

### AC9 — typecheck + build + lint pass

**Verdict: PASS**

All three commands succeed with zero errors and zero warnings. The `@next/swc-win32-x64-msvc` warning during build is a known non-blocking environment issue documented in `docs/reference/dev-server-runbook.md` (lines 76-77) — it falls back to WASM and compilation succeeds.

### AC10 — storySummary compression chain

**Verdict: PASS**

The compression chain is unchanged from TASK-012: `page.tsx:172-181` → `storyText()` maps scenes with `s.summary || s.text` → route receives `storySoFar` → constructs `userMessage` at `route.ts:68-74`. Subsequent API calls get compressed story text (summaries for prior scenes, full text for seed scene), reducing token usage.

### AC11 — SVG truncation → FALLBACK_SVG

**Verdict: PASS**

Three layers of protection:
1. `parseCombinedResponse` (route.ts:28-34): JSON parse success → extracts `svg` field. Parse failure (likely truncation) → returns empty `svg` string.
2. `extractSvg` (svg-model.ts:13-17): Strips markdown fences, extracts `<svg>...</svg>` via regex. No match → returns `''`.
3. `validateSvg` (route.ts:46-52): Checks for `<svg` and `</svg>`. Missing → returns `''`.
4. Route line 90: `if (!svg) svg = FALLBACK_SVG;` — final safety net.

Any truncation that causes invalid SVG or broken JSON falls through to `FALLBACK_SVG`. Path is correct.

### AC12 — drawingPrompt dormancy (label, opacity, placeholder, "恢复默认")

**Verdict: PASS**

- `page.tsx:706`: `<label className="hb-settings-label opacity-50">画风规则（暂未启用）</label>` — `opacity-50` on label, dormancy text correct.
- `page.tsx:707`: `<p className="hb-settings-hint">切回双模型后生效，目前仅保存留用</p>` — hint/placeholder text correct.
- `page.tsx:708-717`: `<input>` field remains editable, value bound to `settingsDrawingPrompt`, saves to localStorage via `saveSettings()`.
- `page.tsx:721-729`: "恢复默认" button clears both `textPrompt` and `drawingPrompt` → `saveSettings('', '')`.
- Route `route.ts:57`: `drawingPrompt` is NOT destructured from body (`storySoFar, newLine, speaker, textPrompt` only) — received in POST body but silently ignored by server. Page still sends it (`page.tsx:216`), so it persists across sessions, but the route ignores it in single-model mode.

---

## Error Chain Verification

Full error chain from plan Section 7 verified in code:

| Level | Trigger | Code Location | Response | Status |
|-------|---------|---------------|----------|--------|
| 0 | `newLine` empty | `route.ts:59-62` | 400 `{ error: "请说一句话再来画" }` | ✅ |
| 1 | No `DEEPSEEK_API_KEY` | `deepseek.ts:17-18` → `route.ts:91-100` | 200 with mock + FALLBACK_SVG | ✅ |
| 1 | API error (non-2xx) | `deepseek.ts:46-49` → `route.ts:91-100` | 200 with mock + FALLBACK_SVG | ✅ |
| 1 | Timeout (30s AbortController) | `deepseek.ts:60-62` → `route.ts:91-100` | 200 with mock + FALLBACK_SVG | ✅ |
| 1 | Empty content | `deepseek.ts:53-55` → `route.ts:91-100` | 200 with mock + FALLBACK_SVG | ✅ |
| 2 | JSON parse failure | `route.ts:35-43` | `narration = newLine`, empty `svg` → `validateSvg` → `''` → `FALLBACK_SVG` | ✅ |
| 2 | JSON parse logging | `route.ts:36` | `console.error('[parseCombined] JSON parse failed, raw length:', ...)` | ✅ |
| 3 | SVG field empty/invalid | `route.ts:88-90` | `extractSvg` → `validateSvg` → `FALLBACK_SVG` | ✅ |
| 4 | SVG sanitization | `route.ts:102` | `sanitizeSvg(svg)` called before response | ✅ |
| 5 | Response assembly | `route.ts:104-110` | 200 with all 4 fields (optional ones coerced to undefined) | ✅ |
| 6 | Outer catch-all | `route.ts:111-116` | 500 `{ error: "画板打了个小盹，再说一次试试" }` — no raw error/stack/key leaked | ✅ |

---

## Individual AC Checklist

| # | Criterion | Verdict |
|---|-----------|---------|
| AC1 | Single DeepSeek call returns 4 fields | ✅ PASS |
| AC2 | Page shows narration + animated SVG | ✅ PASS |
| AC3 | Without key: mock + FALLBACK_SVG | ✅ PASS |
| AC4 | max_tokens=2000 | ✅ PASS |
| AC5 | FETCH_TIMEOUT_MS=30000 | ✅ PASS |
| AC6 | ANTHROPIC_API_KEY absence → no errors | ✅ PASS |
| AC7 | svg-model.ts unmodified | ✅ PASS |
| AC8 | COMBINED_SYS has "json" + example; TEXT/SVG preserved | ✅ PASS |
| AC9 | Build + typecheck + lint pass | ✅ PASS |
| AC10 | storySummary compression chain | ✅ PASS |
| AC11 | SVG truncation → FALLBACK_SVG | ✅ PASS |
| AC12 | drawingPrompt dormancy (label, opacity, placeholder, reset) | ✅ PASS |

---

## Key Exposure Scan Detail

`DEEPSEEK_API_KEY` occurrences in product code:
- `lib/ai/deepseek.ts:7` — error message string (safe)
- `lib/ai/deepseek.ts:16` — `process.env.DEEPSEEK_API_KEY` (server-side module)
- `.env.example:2` — placeholder documentation (safe)

Zero occurrences in:
- `app/page.tsx` (client component)
- Any `NEXT_PUBLIC_*` variable (zero `NEXT_PUBLIC` matches in entire codebase)
- Any client component, prop, or serialized state

---

## Forbidden Change Detection

| Check | Status |
|-------|--------|
| `docs/00_design/` modified? | No — directory is untracked (original state) |
| Client key exposure? | No — zero `NEXT_PUBLIC_*` matches |
| New npm dependencies? | No — `package.json` unchanged |
| Color in story SVGs? | No — `COMBINED_SYS` enforces `fill="none"`, B&W only |
| Database added? | No |
| User accounts added? | No |
| PNG pipeline? | No — SVG remains primary |

---

## Pending Follow-Up Notes (Future Switch-Back)

These are informational, not findings:

- When Anthropic is recharged, `svg-model.ts` `generateSvg()` is ready to use (preserved as-is with `ANTHROPIC_API_KEY` check).
- `TEXT_SYS`, `SVG_SYS` are preserved with `// 备用` comments — ready for dual-model restore.
- `drawingPrompt` is persisted in localStorage and sent in POST body, ready for dual-model restore.
- Route `maxDuration = 30` (line 1) matches the 30s fetch timeout.

---

## Recommendation

**Approve and mark `done`.** The task satisfies all 12 acceptance criteria. Build, typecheck, and lint are clean. Error chain is fully implemented with defensive fallbacks at every level. Key safety is intact. No forbidden changes detected. Zero P0/P1/P2/P3 findings.

Task can be cleared from `active_spec.md` and marked `done` in `progress.md`.
