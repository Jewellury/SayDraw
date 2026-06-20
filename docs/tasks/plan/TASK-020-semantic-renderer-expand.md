# TASK-020: Semantic Renderer Scene Expansion

Owner Flow: plan-agent → execute-agent → audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

TASK-019 built the semantic renderer MVP: 12 Rough.js components, 1 scene type ("角色坐在支撑物上"), role-based auto-layout, and `?strategy=semantic` bypass. External review confirmed the architecture works — LLM outputs only `{id, role, drawOrder}`, renderer handles all coordinates. The core principle proved out: **LLM never outputs coordinates**.

But a single scene type can't cover the range of a 4-year-old's imagination. A child's story naturally moves through standing, walking, falling, fainting, hugging, flying — the renderer needs to grow with it.

## Goal

Expand the semantic renderer from 1 scene type to **6 scene types** covering the full range of common children's story scenarios, keeping the architecture unchanged: LLM outputs pure semantic description, renderer auto-lays out by scene type + role rules.

## Non-goals

- Replacing direct SVG as the default path
- Adding Paper.js or any new rendering dependency
- Building 30+ components — keep under 20 total
- Modeling complex multi-character scenes (battle scenes, crowds, etc.)
- Changing the existing "sitting" layout behavior (backward compatible)
- Adding PNG or color output

## Design Source

- TASK-019 external review feedback: "LLM 不输出任何坐标。渲染器负责坐标和间距。"
- Existing `lib/svg/semanticRenderer.ts` — current role-based auto-layout algorithm
- Existing `lib/svg/componentLib.ts` — 12 components already built
- Existing `lib/ai/prompts.ts` — SEMANTIC_SYS prompt (single-scene-type only)
- `docs/00_design/HuaHuaBen.jsx` — hi-fi proxy for visual alignment
- AGENTS.md Sacred Decision #3: "Core animation is SVG stroke-dashoffset self-drawing"

## Files In Scope

| File | Action | Purpose |
|------|--------|---------|
| `lib/svg/componentLib.ts` | MODIFY | Add new component functions + register in `componentRegistry` |
| `lib/svg/semanticRenderer.ts` | MODIFY | Add `sceneType` parameter + 5 new layout algorithms |
| `lib/ai/prompts.ts` | MODIFY | Expand `SEMANTIC_SYS` with all component IDs, sceneType field, per-type few-shot examples |
| `app/api/story/generate/route.ts` | MODIFY | Pass `sceneType` from LLM response through to renderer |
| `lib/svg/sanitizeSvg.ts` | READ-ONLY | Reference existing sanitizer (no changes needed) |

## Forbidden Changes

- LLM must NOT output any coordinates (x, y, cx, cy, bbox, transform, translate)
- Must NOT change the existing "sitting" layout behavior
- Must NOT break direct SVG path (`?strategy=semantic` remains opt-in bypass)
- Must NOT change the component interface — each component still returns raw SVG string relative to (0,0)
- Must NOT add more than 8 new component functions (cap total at 20)
- Must NOT add any new npm dependencies
- Must NOT change the `ComponentSpec` interface shape for existing fields (additive only)
- Must NOT modify `docs/00_design/`, `docs/_archive/`, or any user-provided source documents

## Acceptance Criteria

### AC1: Scene Type Expansion
- [ ] Semantic renderer supports 6 scene types: `sitting`, `standing`, `flying`, `fainted`, `interaction`, `sky`
- [ ] Each scene type produces visually distinct, correct layouts for that scenario
- [ ] All layouts use only black-and-white hand-drawn Rough.js strokes

### AC2: LLM Contract
- [ ] LLM outputs `sceneType` field in its JSON response
- [ ] LLM outputs `components` array with only `{id, role, drawOrder}` — no coordinates
- [ ] LLM correctly selects sceneType for the given narration, matching scene types: standing, sitting, flying, fainted, interaction, sky
- [ ] When sceneType is missing or invalid, renderer falls back to sitting layout

### AC3: Component Integrity
- [ ] All new components registered in `componentRegistry`
- [ ] Total component count ≤ 20 (12 existing + up to 8 new)
- [ ] All new components drawn relative to (0,0), no absolute positioning baked in
- [ ] Rough.js seeding produces varied hand-drawn look across frames

### AC4: Backward Compatibility
- [ ] `?strategy=semantic` still activates semantic renderer
- [ ] Direct SVG path (no `?strategy=semantic`) untouched
- [ ] Existing "sitting" scenes produce identical SVGs (deterministic, same seed behavior)
- [ ] Build passes (`npm run build` no errors)
- [ ] Typecheck passes (`npx tsc --noEmit` no errors)
- [ ] Lint clean (`npx next lint` no errors)

### AC5: SVG Safety
- [ ] All rendered SVGs pass through `sanitizeSvg` before returning to client
- [ ] No `<script>`, `<foreignObject>`, `on*` attributes, external `href` in output

### AC6: Visual Verification
- [ ] Side-by-side test: "小恐龙站起来了" produces a standing dinosaur on ground (not sitting on a support)
- [ ] Side-by-side test: "陨石从天上掉下来" produces a meteor with motion lines descending
- [ ] Side-by-side test: "小恐龙被砸晕了" produces tilted dinosaur with X-eyes and dazed stars
- [ ] Side-by-side test: "恐龙和猫抱在一起" produces two characters facing each other with heart

## Implementation Strategy

### Phase 0: Scene Type Detection (Recommendation: Explicit + Inference)

**Method (c): LLM outputs explicit `sceneType`, renderer has role inference as fallback.**

```
LLM output JSON gains one new field:
{
  "sceneType": "standing",   // NEW
  "narration": "...",
  "followUpQuestion": "...",
  "storySummary": "...",
  "components": [...]
}
```

**Why explicit:** Scene types like "sitting" vs "standing" can use the same components (cat_body, ground) in different layouts. Role inference alone can't disambiguate — both scenes have a "character" role on ground. LLM context has the narration text and can trivially pick the right type.

**Fallback rules** (when sceneType is missing):
- Two distinct character sets present → `interaction`
- No "support" role present but "ground" present → `standing`
- "support" role present → `sitting`
- Catch-all → `sitting` (safe default, already proven)

| sceneType | Trigger keywords (for LLM prompt guidance) | Trigger roles (fallback inference) |
|-----------|-------------------------------------------|-------------------------------------|
| `sitting` | 坐、坐在、蹲在、趴在 | support role present OR default |
| `standing` | 站、走、跑、跳、在草地上 | character + ground, no support |
| `flying` | 飞、掉、落、陨石、从天上 | character + trajectory marks |
| `fainted` | 晕、倒、摔、砸、眼冒金星 | character + x_eyes or dizzy marks |
| `interaction` | 和、一起、抱、拉手、遇见 | two character sets present |
| `sky` | 天、云、飞(蝴蝶)、星星 | no ground, cloud/sun present |

### Phase 1: New Components (8 new, total 20)

Ordered by frequency in children's stories. Each component is a pure function returning Rough.js SVG strings relative to (0,0), matching the existing pattern.

| # | Component ID | Rough.js shapes | Scene types using it | Priority |
|---|-------------|-----------------|---------------------|----------|
| 1 | `cloud` | 3-4 overlapping ellipses clustered horizontally, stroke-width=2 | sky, flying, standing | Highest — sky filler |
| 2 | `sun` | circle + 8 radial lines, stroke-width=2.5 | sky, nature, standing | High — frequent in stories |
| 3 | `meteor` | tilted ellipse body + short tail triangle, stroke-width=3 | flying | High — story driver |
| 4 | `x_eyes` | two X marks (crossing lines), stroke-width=2 | fainted | High — expression variant |
| 5 | `heart` | two arcs + point, roughPath, stroke-width=2 | interaction | Med — embrace/affection |
| 6 | `motion_lines` | 2-3 short parallel lines behind object, stroke-width=1.5 | flying | Med — trajectory |
| 7 | `grass` | 3-4 curved upward strokes, stroke-width=1.5 | standing, nature | Med — ground detail |
| 8 | `dazed_stars` | 2-3 small stars circling a point, stroke-width=1.5 | fainted | Low — polish element |

**Component drawing design (conceptual, execute-agent will implement):**

```typescript
// cloud: 3-4 overlapping ellipses forming a fluffy shape
export function cloud(): string {
  // roughEllipse(0,0, 22,10), roughEllipse(-16,4, 18,9), roughEllipse(16,4, 20,9)
}

// sun: circle with radiating lines
export function sun(): string {
  // roughCircle(0,0,16) + 8 roughLines radiating outward
}

// meteor: tilted oval with flame tail
export function meteor(): string {
  // roughEllipse(0,0, 16,10) rotated + roughPath tail triangle
}

// x_eyes: two X marks where regular eyes sit
export function xEyes(): string {
  // roughLine(-5,-3, -1,1) + roughLine(-5,1, -1,-3) for left X
  // roughLine(1,-3, 5,1) + roughLine(1,1, 5,-3) for right X
}

// heart: classic heart shape
export function heart(): string {
  // roughPath heart curve: two arcs meeting at bottom point
}

// motion_lines: trailing speed marks
export function motionLines(): string {
  // 3 short parallel lines behind the meteor
}

// grass: small upward strokes
export function grass(): string {
  // 3-5 curved lines starting from a point and arching upward
}

// dazed_stars: orbit of small stars
export function dazedStars(): string {
  // 3 small stars placed in orbit around center
}
```

**Why not more:** 8 new components push to 20 total, well under the 30 cap. These cover all 6 scene types. Rarer elements (rainbow, tree, house, boat) are deferred — the direct SVG path handles them.

### Phase 2: Layout Algorithms Per Scene Type

All layouts use the same `ViewBox: { w: 400, h: 300 }`. The renderer dispatch function:

```typescript
export function renderScene(components: ComponentSpec[], sceneType?: string): string {
  const type = sceneType && layoutRules[sceneType] ? sceneType : inferSceneType(components);
  switch (type) {
    case 'sitting':  return renderSitting(components);
    case 'standing': return renderStanding(components);
    case 'flying':   return renderFlying(components);
    case 'fainted':  return renderFainted(components);
    case 'interaction': return renderInteraction(components);
    case 'sky':      return renderSky(components);
    default:         return renderSitting(components);
  }
}
```

#### 2a. Standing (existing components, new layout)

**Role rules:**

| Role | Layout |
|------|--------|
| `background` | Scatter in upper half (y: 20-120) |
| `ground` | Always present, at y=270, spans full width |
| `character` (body) | Positioned at y≈235, x=200, standing on ground |
| `character` (head) | Above body, y≈200, x=200 |
| `character` (tail) | Behind body, offset x-35 |
| `detail` (eyes) | On head position |
| `support` | Ignored (no support in standing scene) |
| `grass` | Along ground line, 2-3 clusters spread horizontally |

**Algorithm:**
```
1. ground → y=270, x=0
2. support → skip (not used in standing)
3. character body → x=200, y=235 (base on ground)
4. character head → x=200, y=200 (above body, ~35px gap)
5. detail (eyes) → follow head position
6. character tail → x=165, y=237 (behind body)
7. background (cloud/sun/star/flower) → scatter upper half, seed-based random
8. grass → 2-3 instances along ground at x=60, 200, 340
```

**Difference from sitting:** Ground y=270 (vs support y=220 in sitting). Body at y=235 (vs supportY-35=185 in sitting). Head at y=200 (vs supportY-67=153). No support component.

#### 2b. Flying (new: meteor, cloud, motion_lines — existing: dino_body, star)

**Role rules:**

| Role | Layout |
|------|--------|
| `background` (cloud, sun) | Top-left or top-right, y: 30-100 |
| `background` (star) | Scatter upper third, y: 20-80 |
| `character` (meteor) | Diagonal path: starts at (80,40), ends near (280,200) |
| `character` (butterfly) | Mid-canvas, y≈130, x≈200 |
| `character` (dino, flying) | Tilted mid-canvas, y≈120, x≈200 |
| `detail` (motion_lines) | Behind meteor/flyer, parallel to trajectory |
| `ground` | Optional (omit for pure sky scenes) |

**Algorithm:**
```
1. If ground present → y=270, x=0
2. If meteor present:
   - body: x=240, y=120, rotated -45°
   - motion_lines: x=210, y=140, parallel lines trailing left-up
3. If flying character (butterfly, dino):
   - body: x=200, y=130, tilted slightly (5-10°)
   - wings/head: follow body
4. background (cloud, sun) → scatter top half
```

**Meteor trajectory:** The meteor component is positioned at (240, 120) with rotation, and motion_lines trail behind it to (170, 180), simulating top-right to bottom-left path.

#### 2c. Fainted (new: x_eyes, dazed_stars — existing: dino_head, dino_body, star, ground, meteor)

**Role rules:**

| Role | Layout |
|------|--------|
| `ground` | y=270, full width |
| `character` (body) | y=230, x=240, rotated 45-60° (tipped over) |
| `character` (head) | Following body, offset relative to tilted body |
| `detail` (x_eyes) | On head, replacing normal eyes |
| `background` (dazed_stars) | Orbiting above head, 3 positions at radius 25 |
| `background` (meteor) | Nearby impact point, optional |
| `background` (star) | Scatter |

**Algorithm:**
```
1. ground → y=270, x=0
2. character body → x=240, y=230, rotate 50° clockwise
   - transform="translate(240,230) rotate(50)"
3. character head → inside same rotated g, offset (0, -30)
4. x_eyes → inside same rotated g, offset (0, 0) on head center
5. dazed_stars → 3 stars at positions (230,170), (270,165), (255,145)
6. meteor (optional) → x=280, y=200, tilted like impact point
7. background → suppress most to keep focus on fainted character
```

**Key difference:** The rotation transform makes this unique. All character parts share a single `<g transform="translate(x,y) rotate(angle)">` parent so they tilt together.

#### 2d. Interaction / Dual Character (new: heart — existing: cat_body, cat_head, cat_eyes, dino_body, dino_head, ground)

**Role rules:**

| Role | Layout |
|------|--------|
| `ground` | y=270, full width |
| `character` set A (e.g. cat) | x=150, y=230, facing right |
| `character` set B (e.g. dino) | x=260, y=230, facing left (scale(-1,1) or just position) |
| `detail` (heart) | x=205, y=200, between the two characters |
| `background` | Suppressed (clutter distraction) |

**Algorithm:**
```
1. ground → y=270, x=0
2. Pick two character sets from components:
   - Character A (smaller, e.g., cat): placed left, x=150
   - Character B (larger, e.g., dino): placed right, x=260
3. Layout character A (cat):
   - body: x=150, y=235
   - head: x=150, y=200
   - eyes: follow head
   - tail: x=115, y=237
4. Layout character B (dino):
   - body: x=260, y=235
   - head: x=260, y=200
5. heart: x=205, y=195 (midpoint between heads)
6. background: skip or 1 item max
```

**How to identify two character sets:** Group components by prefix (cat_* vs dino_*). If both groups have body+head+detail, it's an interaction scene.

#### 2e. Sky (new: cloud, sun — existing: butterfly_wings, star, moon)

**Role rules:**

| Role | Layout |
|------|--------|
| `background` (cloud) | 2-3 clouds scattered across top half, y: 40-120 |
| `background` (sun) | Top corner, y≈50, x≈60 or x≈340 |
| `background` (star) | Scatter, y: 20-100 |
| `character` (butterfly) | Mid-canvas, y≈150, x≈200 |
| `support` (moon) | Top quadrant (reuse from sitting but positioned differently) |
| `ground` | Omit (all sky) |

**Algorithm:**
```
1. No ground line
2. cloud 1 → x=80, y=60
3. cloud 2 → x=320, y=80
4. cloud 3 → x=200, y=40
5. sun → x=340, y=50
6. moon → x=60, y=60
7. butterfly_wings → x=200, y=150
8. star → scatter 2-3 in sky
```

### Phase 3: Prompt Update (`SEMANTIC_SYS`)

The expanded prompt must:
1. List all 20 component IDs with brief descriptions
2. Define `sceneType` as a required field
3. Give sceneType selection rules with 1-2 few-shot examples per type
4. Maintain the rule: no coordinates ever
5. Keep all existing narration/followUpQuestion/storySummary rules

**Prompt structure:**

````
你是一个儿童绘本「分镜助手」。你会收到目前为止的故事，以及最新的一句话。
你的任务不是画图，而是列出画面中需要出现的部件，并选择画面类型。

请严格只输出一个 JSON 对象：

{
  "sceneType": "standing",
  "narration": "...",
  "followUpQuestion": "...",
  "storySummary": "...",
  "components": [
    { "id": "ground", "role": "background", "drawOrder": 0 },
    { "id": "dino_body", "role": "character", "drawOrder": 2 },
    { "id": "dino_head", "role": "character", "drawOrder": 3 },
    { "id": "cat_eyes", "role": "detail", "drawOrder": 4 },
    { "id": "grass", "role": "background", "drawOrder": 1 }
  ]
}

可用场景类型（sceneType）：
- standing: 角色站立、走路、跑步、跳跃
- sitting: 角色坐在物体上（月亮、石头等）
- flying: 角色/物体在空中飞、坠落、陨石划过
- fainted: 角色晕倒、摔倒、被砸
- interaction: 两个角色互动（拥抱、一起、遇见）
- sky: 纯天空场景（云、太阳、蝴蝶飞、星星）

可用部件 ID（20个）：
【角色-猫】cat_body, cat_head, cat_eyes, cat_tail, x_eyes
【角色-恐龙】dino_body, dino_head
【支撑物】moon, stone
【天空】cloud, sun, star
【地面/自然】ground, grass, flower
【动作/特效】meteor, motion_lines, butterfly_wings, heart, dazed_stars

可用角色（role）：
- support: 支撑物（月亮、石头）
- character: 角色身体部件（猫/恐龙的身体、头、尾巴、陨石、蝴蝶）
- detail: 表情细节（眼睛、X眼）
- background: 背景装饰（云、太阳、星星、地面、草、花、晕眩星、爱心、轨迹线）

规则：
1. sceneType 必须从上列6个中选择一个。
2. 每个 component 需要 id、role、drawOrder。
3. drawOrder: 0=最底层，数字越大越靠前。
4. 不要输出坐标！渲染器根据 sceneType + role 自动布局。
5. 永远添加 ground（除 sky 场景外），role=background, drawOrder=0。

示例（每类场景一个）：

【standing】"小恐龙在草地上走" → sceneType="standing"
components: ground, dino_body, dino_head, cat_eyes, grass, cloud

【sitting】"小猫坐在月亮上" → sceneType="sitting"  
components: ground, moon, cat_body, cat_head, cat_eyes, cat_tail, star

【flying】"陨石从天上掉下来" → sceneType="flying"
components: ground, meteor, motion_lines, star, cloud

【fainted】"小恐龙被陨石砸晕了" → sceneType="fainted"
components: ground, dino_body, dino_head, x_eyes, dazed_stars, meteor

【interaction】"恐龙和猫抱在一起" → sceneType="interaction"
components: ground, cat_body, cat_head, cat_eyes, cat_tail, dino_body, dino_head, heart

【sky】"蝴蝶在云里飞" → sceneType="sky"
components: cloud, sun, butterfly_wings, star

只输出 JSON，不要任何其他内容。
````

### Phase 4: Route Handler Update

In `app/api/story/generate/route.ts`, the semantic branch must:
1. Parse `sceneType` from the LLM JSON response
2. Pass it through to `renderScene(components, sceneType)`
3. If `sceneType` is missing/null, renderer runs fallback inference
4. Sanitize the resulting SVG

### Phase 5: Renderer Refactor

Current `semanticRenderer.ts` is one monolithic function. Refactor to:

```typescript
// Dispatch
export function renderScene(components: ComponentSpec[], sceneType?: string): string

// Layout functions (each 30-50 lines)
function renderSitting(components: ComponentSpec[]): string      // existing logic moved here
function renderStanding(components: ComponentSpec[]): string
function renderFlying(components: ComponentSpec[]): string
function renderFainted(components: ComponentSpec[]): string
function renderInteraction(components: ComponentSpec[]): string
function renderSky(components: ComponentSpec[]): string

// Shared helpers
function inferSceneType(components: ComponentSpec[]): string
function buildSvg(elements, orderMap): string                    // existing, unchanged
```

Each layout function follows the same pattern as the existing `renderScene`:
1. Filter components by role
2. Compute positions deterministically
3. Call `componentRegistry[id]()` to get SVG string
4. Pass to `buildSvg()`

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| LLM picks wrong sceneType | Medium | Layout looks nonsensical for the narration | Fallback role inference catches most cases; prompt has few-shot examples |
| New components look bad in certain layouts | Medium | Visual quality degrades | Execute-agent tests each component in its primary scene type before shipping |
| Rotation transforms (fainted, meteor) require SVG `<g>` nesting that breaks stroke-dasharray animation | Medium | Self-drawing animation breaks on fainted frames | Test animation on rotated elements; may need to apply stroke-dasharray to the `<g>` wrapper |
| Too many components make the prompt too long | Low | LLM gets confused or hits token limits | 20 components + 6 few-shots ≈ ~1500 tokens — well within limits for deepseek-v4-flash |
| Interaction layout can't handle 3+ characters | Low | Rare in simple children's stories | Fallback to direct SVG path for complex scenes |
| Standing layout looks too similar to sitting without visual differentiation | Low | Users might not notice the difference | Ground position and lack of support create clear visual distinction |
| Two character sets in interaction share same component IDs | Medium | Can't differentiate cat vs dino body/head | Rely on component id prefixes (cat_*, dino_*) for grouping; documented in prompt |

## Rollback

1. The old `renderScene(components)` signature is preserved — if `sceneType` is undefined, the renderer infers the type (with sitting as safe default).
2. Direct SVG path is completely untouched — no changes to `COMBINED_SYS` prompt or standard generation route.
3. `?strategy=semantic` behavior is additive — old scenes still produce identical output.
4. If interaction layout is broken, `sceneType` can be set to `sitting` server-side for `interaction` type until fix is deployed.
5. Git revert of `componentLib.ts`, `semanticRenderer.ts`, and `prompts.ts` restores the single-scene-type MVP.
