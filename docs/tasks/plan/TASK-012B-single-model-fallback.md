# TASK-012B: SVG Model Fallback to DeepSeek V4 Flash Single-Model

Plan authored: 2026-06-07
Owner Flow: plan-agent → execute-agent → audit-agent
Lane: Fast Lane

---

## 1. Background

TASK-012 built a dual-model pipeline (DeepSeek V4 Flash for text + Claude Sonnet for SVG). The Anthropic account cannot be recharged right now — Claude is unavailable. We need to temporarily switch to a single `deepseek-v4-flash` call that returns all four fields (`narration`, `followUpQuestion`, `storySummary`, `svg`) in one JSON response. The code structure must remain **swappable** — when Anthropic is recharged, we switch back to dual-model by reverting the route. (The model is `deepseek-v4-flash`, a DeepSeek V4 variant, **not** `deepseek-chat`/DeepSeek V3.)

## 2. Goal

Replace dual-model pipeline with a single DeepSeek call using a combined prompt. All 4 fields come from one API response. The app remains playable without Anthropic key.

## 3. Architecture

```
POST /api/story/generate
  │
  ├─ Step 0: Validate newLine non-empty → 400 if not
  │
  ├─ Step 1: Build system prompt = COMBINED_SYS + optional textPrompt (appended)
  │           drawingPrompt received but NOT sent (reserved for dual-model switch-back)
  │
  ├─ Step 2: SINGLE DeepSeek call (model: deepseek-v4-flash)
  │           response_format: json_object (already set in deepseek.ts)
  │           max_tokens: 2000 (changed from 1000, in deepseek.ts)
  │           timeout: 30s (changed from 25s, in deepseek.ts)
  │
  ├─ Step 3: Parse JSON → { narration, followUpQuestion, storySummary, svg }
  │           │
  │           ├─ Success: extractSvg(svg field) → validate → sanitize
  │           │   └─ Invalid SVG → FALLBACK_SVG
  │           │
  │           └─ Failure chain:
  │               No DEEPSEEK_API_KEY → getMockText() + FALLBACK_SVG → 200 OK
  │               API error / timeout → getMockText() + FALLBACK_SVG → 200 OK  
  │               JSON parse failure → narration=newLine + FALLBACK_SVG → 200 OK
  │
  └─ Step 4: Response → { narration, svg, followUpQuestion?, storySummary? }
             Outer catch → 500 { error: "画板打了个小盹，再说一次试试" }
```

### Key Architecture Decision

The `generateSvg()` function from `svg-model.ts` is NOT called. The `extractSvg()` utility is kept because DeepSeek may wrap the SVG string in markdown fences inside the JSON field. `extractSvg` strips those fences and extracts the raw `<svg>...</svg>`.

### drawingPrompt Fate

`drawingPrompt` is received from the client (page.tsx sends it) but **ignored** in the route. In single-model mode, all drawing instructions are in `COMBINED_SYS`. When switching back to dual-model, the route reverts and `drawingPrompt` is passed to `generateSvg()` again.

## 4. Files In Scope

| File | Action | Details |
|------|--------|--------|
| `lib/ai/prompts.ts` | Modify | Add `COMBINED_SYS` export. Add `/* 备用 — 切回双模型时使用 */` comment above `TEXT_SYS` and `SVG_SYS`. Keep `INK` and `SCENE_SYS` unchanged. |
| `lib/ai/deepseek.ts` | Modify | `max_tokens`: 1000 → 2000. `FETCH_TIMEOUT_MS`: 25000 → 30000. No other changes. |
| `lib/ai/svg-model.ts` | **No change** | File preserved as-is. Not imported by route in single-model mode. |
| `lib/ai/mock.ts` | **No change** | `getMockText()` already returns all text fields. |
| `app/api/story/generate/route.ts` | Modify | Switch to single-model flow. Remove `generateSvg`/`NoAnthropicKeyError` imports. Keep `extractSvg` import. Use `COMBINED_SYS` instead of `TEXT_SYS`. SVG extracted from JSON response `svg` field. |
| `lib/story/types.ts` | **No change** | All needed fields already present. |
| `app/page.tsx` | Modify | drawingPrompt field: update label to `画风规则（暂未启用）`, placeholder to `切回双模型后生效，目前仅保存留用`, add `opacity-50` to label. Minimal UI-only change — field stays visible, user data preserved, just clearly marked dormant. |
| `app/globals.css` | **No change** | Prefer Tailwind inline `opacity-50` on the label element; no CSS file changes needed. |
| `.env.local` / `.env.example` | **No change** | ANTHROPIC_API_KEY stays (not used, not causing errors). |
| `AGENTS.md` | Modify | Update AI section: single-model DeepSeek V4 Flash, Claude reserved for future dual-model switch-back. |
| `docs/reference/dev-server-runbook.md` | Modify | Update env vars table: note ANTHROPIC_API_KEY is optional/reserved (unused in single-model mode). |

## 5. Prompt Design — COMBINED_SYS

```typescript
export const COMBINED_SYS =
  '你是一个儿童绘本「故事引擎」兼「插画师」，陪一个4岁孩子和爸爸一起编故事，并为每一句话画一幅黑白线稿插画。' +
  '你会收到目前为止的故事，以及最新的一句话。\n\n' +
  '请严格只输出一个 JSON 对象（不要 markdown，不要代码块，不要任何解释）：\n\n' +
  '{\n' +
  '  "narration": "直接保留用户原话，可去掉语气词，不超过30字，不加说话人前缀",\n' +
  '  "followUpQuestion": "引导孩子说下一句的开放式问题，不超过15字",\n' +
  '  "storySummary": "用2~3句话总结当前故事进展",\n' +
  '  "svg": "<svg viewBox=\\"0 0 400 300\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"\n' +
  '}\n\n' +
  '字段规则：\n' +
  '1. narration：保留用户原话，适当精简，不改变意思，不超过30字。\n' +
  '2. followUpQuestion：口语化，像爸爸在问孩子，不超过15字。\n' +
  '3. storySummary：说清楚谁、在哪、发生了什么，2~3句。\n' +
  '4. svg：这一格的黑白线稿插画，必须是合法的 SVG 字符串，不要用 markdown 代码块包裹。\n\n' +
  'SVG 规则（严格遵守）：\n' +
  '- 格式：<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">...</svg>\n' +
  '- 所有元素：stroke="' + INK + '"，fill="none"，stroke-linecap="round"，stroke-linejoin="round"\n' +
  '- 主角轮廓 stroke-width="3"，细节 stroke-width="2"，背景元素 stroke-width="1.5"\n' +
  '- 禁止：任何 fill 颜色（除 fill="none"）、文字/text 元素、style 属性里的颜色\n' +
  '- 元素数量：12~22 个 SVG 元素\n' +
  '- 画面必须为纯黑白线稿，无彩色。\n\n' +
  '构图要求：\n' +
  '- 先画背景（地面线、场景道具1~2样）\n' +
  '- 再画主角：头部、眼睛、嘴巴、身体、四肢（完整轮廓）\n' +
  '- 主角占画高 40%~60%，水平居中\n' +
  '- 动作要明确，一眼读出在做什么\n' +
  '- 画面有层次：背景（简笔）+ 主角（主体）\n\n' +
  '角色指南：\n' +
  '- 恐龙：圆润的头部，短小前肢，粗壮后腿和尾巴，背上有小背鳍，体形憨厚可爱。\n' +
  '- 月球：圆形天体，表面有几个陨石坑小圆圈，可挂在画面左上角或右上角。\n' +
  '- 陨石：带尾巴的不规则椭圆或三角，从画面顶部斜向下飞过。\n' +
  '- 晕倒：角色身体倾斜或倒下，眼睛画成 X 或螺旋线，旁边可加小星星表示晕眩。\n' +
  '- 蝴蝶：左右对称双翅，触角，停在花朵或空中飞舞。\n\n' +
  '只输出 JSON，不要任何其他内容。';
```

**Design notes:**
- Contains the word "json" and "JSON" multiple times (DeepSeek `json_object` mode requirement)
- Includes complete JSON output example with all 4 fields
- SVG rules are embedded inline (no separate SVG model)
- Character-specific guidelines for all seed story elements (恐龙, 月球, 陨石, 晕倒, 蝴蝶)
- Uses `INK` constant for stroke color consistency

## 6. Implementation Strategy

### Phase 1: `lib/ai/prompts.ts`
- Add `COMBINED_SYS` export (as designed above)
- Add comment `/* 备用 — 切回双模型时使用 */` above TEXT_SYS and SVG_SYS
- Keep INK and SCENE_SYS unchanged

### Phase 2: `lib/ai/deepseek.ts`
- `max_tokens`: 1000 → 2000
- `FETCH_TIMEOUT_MS`: 25000 → 30000

### Phase 3: `app/api/story/generate/route.ts`
- Remove imports: `generateSvg`, `NoAnthropicKeyError` from `@/lib/ai/svg-model`
- Keep import: `extractSvg` from `@/lib/ai/svg-model`
- Change import: `TEXT_SYS` → `COMBINED_SYS` from `@/lib/ai/prompts`
- Rewrite POST handler to single-model flow (see pseudocode below)
- `drawingPrompt` destructured from body but NOT passed to any model call

**Route pseudocode:**
```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. Parse + validate
    const body: GenerateRequest = await req.json();
    const { storySoFar, newLine, speaker, textPrompt } = body;
    // drawingPrompt not destructured — received but ignored

    if (!newLine || !newLine.trim()) {
      return NextResponse.json({ error: '请说一句话再来画' }, { status: 400 });
    }

    // 2. Build prompts
    const systemPrompt = textPrompt?.trim()
      ? `${COMBINED_SYS}\n\n${textPrompt.trim()}`
      : COMBINED_SYS;

    const userMessage =
      '目前的故事：\n' + (storySoFar || '') +
      '\n\n最新这一句是' + (speaker === 'dad' ? '爸爸' : '宝宝') + '说的：' + newLine;

    // 3. Single DeepSeek call
    let narration: string;
    let followUpQuestion: string;
    let storySummary: string;
    let svg: string;

    try {
      const raw = await generateStoryFrame(systemPrompt, userMessage);
      const parsed = parseCombinedResponse(raw, newLine);
      narration = parsed.narration;
      followUpQuestion = parsed.followUpQuestion;
      storySummary = parsed.storySummary;

      // 4. Extract + validate SVG from JSON field
      const extracted = extractSvg(parsed.svg);
      svg = validateSvg(extracted);
      if (!svg) svg = FALLBACK_SVG;
    } catch (textError) {
      if (!(textError instanceof NoApiKeyError)) {
        console.error('[api/story/generate]', (textError as Error).message);
      }
      const mock = getMockText(mockCounter++);
      narration = mock.narration;
      followUpQuestion = mock.followUpQuestion;
      storySummary = mock.storySummary;
      svg = FALLBACK_SVG;
    }

    // 5. Sanitize
    svg = sanitizeSvg(svg);

    // 6. Respond
    return NextResponse.json({
      narration,
      svg,
      followUpQuestion: followUpQuestion || undefined,
      storySummary: storySummary || undefined,
    });
  } catch (e) {
    console.error('[api/story/generate]', e instanceof Error ? e.message : 'Unknown');
    return NextResponse.json(
      { error: '画板打了个小盹，再说一次试试' },
      { status: 500 }
    );
  }
}
```

**New `parseCombinedResponse` (local helper in route.ts):**
```typescript
function parseCombinedResponse(raw: string, fallbackNarration: string): {
  narration: string;
  followUpQuestion: string;
  storySummary: string;
  svg: string;
} {
  try {
    const o = JSON.parse(raw);
    return {
      narration: (typeof o.narration === 'string' && o.narration) || fallbackNarration,
      followUpQuestion: (typeof o.followUpQuestion === 'string' && o.followUpQuestion) || '',
      storySummary: (typeof o.storySummary === 'string' && o.storySummary) || '',
      svg: (typeof o.svg === 'string' && o.svg) || '',
    };
  } catch {
    console.error('[parseCombined] JSON parse failed, raw length:', raw.length, raw.slice(0, 200));
    return {
      narration: fallbackNarration,
      followUpQuestion: '',
      storySummary: '',
      svg: '',
    };
  }
}
```

**Functions to keep as-is:**
- `validateSvg(svg)`: Already exists at `route.ts:38` — a local helper that checks `svg.includes('<svg') && svg.includes('</svg>')`. Returns the string if valid, `''` otherwise. No changes needed.
- `let mockCounter = 0`: Already declared at module level in `route.ts:11`. Keep existing declaration — no new state management. Same pattern as current dual-model code.

**Functions to remove:** `parseTextResponse` (replaced by `parseCombinedResponse`)

**Imports after change:**
```typescript
import { generateStoryFrame, NoApiKeyError } from '@/lib/ai/deepseek';
import { extractSvg } from '@/lib/ai/svg-model';  // utility only, not Claude
import { COMBINED_SYS } from '@/lib/ai/prompts';
import { getMockText } from '@/lib/ai/mock';
import { sanitizeSvg } from '@/lib/svg/sanitizeSvg';
import type { GenerateRequest, GenerateResponse, GenerateError } from '@/lib/story/types';
```

### Phase 4: `app/page.tsx`
- Line ~706: Change label from `画风规则（Claude Sonnet）` to `画风规则（暂未启用）`
- Line ~707: Change placeholder from `额外的画风和角色规则，追加到默认画图提示词末尾` to `切回双模型后生效，目前仅保存留用`
- Add `opacity-50` class to the drawingPrompt `<label>` element to visually indicate dormancy
- No functional changes — field remains editable, data still saved to localStorage

### Phase 5: Docs
- `AGENTS.md`: Update AI section
- `docs/reference/dev-server-runbook.md`: Note ANTHROPIC_API_KEY is optional/reserved

### Phase 6: Verify
- `npm run typecheck`
- `npm run build`
- `npm run lint`

## 7. Error Chain (Complete)

```
Level 0: 请求校验
  newLine 空 → 400 { error: "请说一句话再来画" }

Level 1: 单模型调用（DeepSeek Flash with COMBINED_SYS）
  无 DEEPSEEK_API_KEY → NoApiKeyError → getMockText() + FALLBACK_SVG → 200 OK
  API 返回非 2xx → Error → getMockText() + FALLBACK_SVG → 200 OK
  AbortController 超时 (30s) → Error → getMockText() + FALLBACK_SVG → 200 OK
  content 为空 → Error → getMockText() + FALLBACK_SVG → 200 OK

Level 2: JSON 解析
  解析成功 → 提取 4 字段（缺失字段用默认值）
  解析失败 → narration = newLine, svg = FALLBACK_SVG → 200 OK

Level 3: SVG 提取与校验
  svg 字段为空 → FALLBACK_SVG
  extractSvg() 后不含 <svg> 标签 → FALLBACK_SVG
  validateSvg() 返回空 → FALLBACK_SVG

Level 4: SVG 安全
  sanitizeSvg() 处理（去除 script/foreignObject/on* 事件/外部 href）

Level 5: 响应组装 → 200 OK
  { narration, svg, followUpQuestion?, storySummary? }

Level 6: 外层兜底
  任何未捕获异常 → 500 { error: "画板打了个小盹，再说一次试试" }
  原始错误、堆栈、API key 片段禁止到达客户端
```

### Key Presence Matrix (Single-Model Mode)

| DEEPSEEK key | Text source | SVG source | Playable? |
|---|---|---|---|
| 有 | DeepSeek Flash (COMBINED_SYS) | DeepSeek Flash (svg field in JSON) | ✅ Full quality |
| 无 | getMockText() | FALLBACK_SVG | ✅ Mock mode |
| 有（API fails） | getMockText() | FALLBACK_SVG | ✅ |

ANTHROPIC_API_KEY is irrelevant in single-model mode — never read, never causes errors.

## 8. Acceptance Criteria

| # | Criterion | Verification |
|---|---|---|
| AC1 | Single DeepSeek call returns 4 fields (narration, followUpQuestion, storySummary, svg) in one JSON response | Check Network tab — only one API call to DeepSeek; response has all 4 fields |
| AC2 | Page shows narration text and animated SVG correctly | Visual check: type a line, see narration text + SVG drawing animation |
| AC3 | Without DEEPSEEK_API_KEY: getMockText() + FALLBACK_SVG returned; app playable | Remove key from .env.local, restart, submit a turn → see mock text + fallback SVG |
| AC4 | max_tokens=2000 in deepseek.ts; generated SVGs not truncated | Inspect `lib/ai/deepseek.ts` line with `max_tokens`; submit a complex scene, verify SVG is complete |
| AC5 | FETCH_TIMEOUT_MS=30000 (30s) in deepseek.ts | Inspect `lib/ai/deepseek.ts` |
| AC6 | ANTHROPIC_API_KEY absence does NOT cause errors | Remove ANTHROPIC_API_KEY from .env.local; app works normally with DeepSeek key only (or no keys) |
| AC7 | `lib/ai/svg-model.ts` file preserved unmodified | File exists, git status shows no changes |
| AC8 | `lib/ai/prompts.ts` keeps TEXT_SYS/SVG_SYS exports (commented as reserved); COMBINED_SYS contains "json" keyword + complete output example | Read `lib/ai/prompts.ts`, verify `grep -i json` finds "json" in COMBINED_SYS |
| AC9 | `npm run typecheck` && `npm run build` pass; `npm run lint` — zero warnings | Run all three commands |
| AC10 | storySummary compression chain still works (AC5.1 from TASK-012) | Network tab: 2nd request's `storySoFar` contains summary (not full text) for prior scene |
| AC11 | SVG truncation: complex scene produces complete `</svg>` end tag (not truncated mid-string). If max_tokens truncation causes JSON parse failure → FALLBACK_SVG, that's acceptable but must confirm the fallback path fires correctly | Submit a complex scene sentence like "陨石砸到小恐龙，恐龙飞到了月球上，看到了蝴蝶和花园", verify the returned SVG ends with `</svg>`. If truncation causes JSON parse failure, confirm FALLBACK_SVG is served — acceptable, path is correct |
| AC12 | Settings panel: textPrompt appended to COMBINED_SYS; drawingPrompt stored but unused (label reads `画风规则（暂未启用）` with `opacity-50`, placeholder reads `切回双模型后生效，目前仅保存留用`); "恢复默认" works | Visual: open settings, verify drawingPrompt field shows dormancy cues; type custom textPrompt, submit turn → check response reflects prompt; drawingPrompt field input still preserved in localStorage |

## 9. Future Switch-Back Notes

When Anthropic is recharged, revert to dual-model:

1. **Restore `lib/ai/prompts.ts`**: Remove COMBINED_SYS; uncomment TEXT_SYS/SVG_SYS as primary exports
2. **Restore `lib/ai/deepseek.ts`**: max_tokens back to 1000; timeout back to 25000 (optional — 2000/30000 still work for text-only)
3. **Restore route.ts**: Re-import `generateSvg`/`NoAnthropicKeyError`; use TEXT_SYS for text call, SVG_SYS for SVG call; pass `drawingPrompt` to `generateSvg()`
4. **Restore page.tsx**: Revert drawingPrompt label to `画风规则（Claude Sonnet）`, placeholder to `额外的画风和角色规则，追加到默认画图提示词末尾`, remove `opacity-50` from label
5. **Restore AGENTS.md**: Update AI section back to dual-model
6. **Restore runbook**: Note ANTHROPIC_API_KEY is required for SVG quality
7. **No migration needed**: localStorage, types, page.tsx already compatible with both modes

A clean switch-back could also be done via `git revert` of the TASK-012B commit.

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DeepSeek produces invalid SVG inside JSON | Medium | Low | `extractSvg` handles markdown fences; `validateSvg` catches missing `<svg>` tags; FALLBACK_SVG as final safety net |
| SVG quality lower than Claude | High | Medium | COMBINED_SYS includes full SVG rules inline; accepted trade-off for Claude unavailability |
| DeepSeek JSON `svg` field too large → truncation at 2000 tokens | Medium | Medium | max_tokens=2000 gives ~8000 chars output; SVG at 12-22 elements fits within budget; if truncated, JSON parse probably fails → FALLBACK_SVG |
| COMBINED_SYS missing "json" keyword → `json_object` mode rejected | Low | High | "json"/"JSON" appears 5+ times in prompt + full JSON example; AC8 verifies |
| Single call latency > 30s | Low | Medium | AbortController at 30s; timeout path → mock + FALLBACK_SVG |

## 11. Rollback

```bash
git checkout -- lib/ai/prompts.ts lib/ai/deepseek.ts app/api/story/generate/route.ts app/page.tsx AGENTS.md docs/reference/dev-server-runbook.md
npm run typecheck && npm run build
```

No npm dependency changes, no database changes, no config file changes.
