# AGENTS.md - SayDraw / HuaHuaBen

## Project Goal

SayDraw is a voice-powered story sketchpad for parents and preschoolers to co-create stories. The parent says a line, the child says a line, and the system turns each spoken line into a black-and-white line-drawing SVG frame animated with stroke-dasharray so the lines appear to draw themselves. All frames chain together into a co-created animated storybook.

Built for **World Product Day "Everyone Ships Now" Hackathon**, deadline **2026-06-20 17:00 BST**.

## Sacred Product Decisions (Do Not Reverse)

1. **Black-and-white hand-drawn line style** - no color illustrations.
2. **SVG is the primary output format** - no PNG or raster image as the main result.
3. **Core animation is SVG stroke-dashoffset self-drawing** - lines draw themselves stroke by stroke.
4. **Voice-first, but text fallback required** - Web Speech API is the MVP voice layer.
5. **AI returns both narration and SVG in one call** - story continuity is paramount.
6. **MVP: no accounts, no color, no native app.**

## Tech Stack

- **Framework:** Next.js 15+ App Router with TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel serverless functions
- **AI:** Single-model pipeline (`deepseek-v4-flash`) returning text + SVG in one JSON response. Claude Sonnet reserved for future dual-model switch-back.
  - Model: `deepseek-v4-flash` (DeepSeek API, OpenAI-compatible, base URL `https://api.deepseek.com`)
  - No fallback models; DeepSeek failure → mock text + FALLBACK_SVG
- **Storage:** `localStorage` only for MVP
- **Voice:** Web Speech API (`SpeechRecognition` + `SpeechSynthesis`)

## Dev Server - Critical Rule

- **Port:** Always **3001**. Never 3000 or any other port.
- **Start method:** `start powershell -NoExit -Command "npm run dev -- -p 3001"` from project root.
- **Never** use `npm run dev` directly through the Bash tool — the tool timeout kills the server silently.
- **Never** use `.\start-dev.cmd` from bash (the `start` command behaves differently and won't launch the window).
- Full runbook: `docs/reference/dev-server-runbook.md`.
- When browser shows "connection refused", the dev server is not running. Don't investigate code, config, or API keys before verifying `netstat -ano | findstr :3001`.

## DeepSeek API Key - Critical Rule

- `DEEPSEEK_API_KEY` must only be read on the server side (Route Handlers / Vercel Functions).
- Never expose the key to the client via `NEXT_PUBLIC_*`, props, or serialized state.
- All DeepSeek calls go through `app/api/story/*` routes.
- When no key is set, API routes return mock data so the app remains playable.

## SVG Safety Rules

- All generated SVGs must be sanitized on the server before returning to the client.
- Strip: `<script>`, `<foreignObject>`, `on*` event attributes, external `href` / `xlink:href`.
- The sanitizer lives in `lib/svg/sanitizeSvg.ts`.
- Every SVG rendering component must pass generated/dynamic SVGs through sanitization.
- Static inline seed SVGs are allowed when authored in source and verified to contain no scripts, event handlers, foreign objects, or external links.

## Source Document Protection - Critical Rule

- User-provided original documents must never be overwritten, edited, or created by AI.
- Protected directories and files: `docs/00_design/`, `docs/_archive/`, original user briefs.
- AI may read these files and may copy them into `docs/_archive/` for reference, but must never modify originals.
- If a referenced source file doesn't exist, ask the user; do not create a placeholder.
- `SayDraw.txt` was the user's original long document. Its content was migrated to `docs/00_design/design_brief.md`. The original `SayDraw.txt` no longer exists at project root.

## Novus-Friendly Event Naming

Reserved analytics events are defined in `lib/analytics/events.ts`:

| Event Name | Trigger Point |
| --- | --- |
| `story_turn_submitted` | User submits a story turn |
| `story_frame_generated` | AI returns a frame (SVG + narration) |
| `story_hint_requested` | User taps "what next?" hint |
| `story_play_started` | Playback begins |
| `story_frame_revisited` | User taps a frame in the filmstrip |
| `story_generation_failed` | API returns error or fallback |
| `voice_input_started` | User starts voice recording |
| `voice_input_completed` | Voice recording completes successfully |

Call `track()` from `lib/analytics/track.ts` at each trigger point when that trigger exists in the implemented feature, even if Novus SDK is not yet installed.

## Task Management System - Lightweight Gate

All product work is managed through `docs/tasks/`. See `docs/tasks/README.md` for the full system.

This gate protects product implementation work. Explicit user-requested maintenance of workflow docs, agent charters, task templates, or project operating rules may be done directly in the main conversation as a **Micro Lane** docs-only change, as long as it does not modify product code or protected source documents.

### Hard Rules

0. **For product work, the main conversation is a coordinator only.** It launches plan-agent / execute-agent / audit-agent as sub-agents via Task tool when available. It must NOT perform product planning, execution, or audit work inline. Docs-only workflow maintenance may be handled directly when the user explicitly asks for it.
1. **Product code changes require an approved active task.**
2. **execute-agent must read `docs/tasks/active_spec.md` before writing product code.** If no approved active task exists, stop.
3. **plan-agent does not write product code.** It may write normal planning outputs under `docs/tasks/plan/`, `docs/tasks/progress.md`, and `docs/tasks/active_spec.md`.
4. **execute-agent does not audit its own tasks.**
5. **audit-agent reports findings and does not add features.**
6. **Visual output should align with `docs/00_design/高保真静态图.jpg`; when image access is unavailable, use `docs/00_design/HuaHuaBen.jsx` as the readable hi-fi proxy.**
7. **DeepSeek API key is server-side only.**
8. **Forbidden:** accounts, database, PNG main pipeline, color story frames, marketing landing page.

### Product Code vs Agent Output

"No code changes without a task" means no changes to product implementation files such as `app/`, `components/`, `lib/`, API routes, runtime config, package files, or generated application behavior.

It does not block normal agent workflow outputs:

- plan-agent may write `docs/tasks/plan/`, `docs/tasks/progress.md`, and `docs/tasks/active_spec.md`.
- execute-agent may write `docs/tasks/execution-log/`, `docs/tasks/artifacts/`, and task status fields.
- audit-agent may write `docs/tasks/audit-report/`, `docs/tasks/artifacts/`, and audit status fields.

### Fast Lane vs Full Lane

Use the lightest workflow that preserves safety.

**Micro Lane** for docs-only workflow maintenance:

```
user requests workflow/doc change
main conversation edits AGENTS.md / docs/tasks / agent charters directly
verify the docs are internally consistent
done
```

Micro Lane may not touch product implementation files, protected source documents, API keys, generated app behavior, or package/runtime config.

**Fast Lane** for small visual, copy, layout, or single-surface tasks:

```
plan-agent writes a concise plan file
user approves
plan-agent updates active_spec.md + progress.md
execute-agent implements and writes a concise execution log
audit-agent checks the active task acceptance criteria + build/type/basic safety
done
```

**Full Lane** for high-risk tasks:

Use the full detailed plan and audit when the task involves API keys, server routes, generated SVG sanitization, AI calls, new dependencies, deployment, data migration, broad refactors, or cross-module contracts.

### Task Lifecycle

```
planned -> approved -> in_progress -> audit -> done
```

`docs/tasks/active_spec.md` is the execution gate and current active-task status source. `docs/tasks/progress.md` is the project board and historical index. Plan files describe scope and acceptance criteria; they must not carry lifecycle status fields such as `Status: planned`, because that label becomes stale after approval.

Status files are workflow metadata. They should not create extra approval loops by themselves. If the user clearly says "approve this plan", plan-agent may update both `progress.md` and `active_spec.md` in one pass.

After a task reaches `done`, `active_spec.md` must be cleared before the next execution task starts.

### Source of Truth Priority

1. Current user explicit instruction
2. `docs/tasks/active_spec.md`
3. Current task's plan file (`docs/tasks/plan/TASK-XXX-*.md`)
4. `docs/00_design/高保真静态图.jpg`
5. `docs/00_design/frontend_design_spec.md`
6. `docs/00_design/HuaHuaBen.jsx`
7. `docs/00_design/design_brief.md`
8. `AGENTS.md` and agent charters

## Three Agents

See `docs/agent-charters/` for full charters:

1. **plan-agent** - Scope control, hackathon constraints, milestones, deliverables, feature triage. Does not write product code.
2. **execute-agent** - Vertical slice implementation. Keeps changes small and keeps the project runnable.
3. **audit-agent** - Build, type, SVG safety, mobile, Novus events when relevant, and active-task acceptance checks.

### How to Invoke Each Agent

For product tasks, each agent should be invoked as a separate sub-agent via the Task tool when available. The main conversation acts as coordinator: it reads `active_spec.md` and `progress.md`, launches the appropriate agent, and handles handoff.

For explicitly requested docs-only workflow maintenance, use Micro Lane and edit the relevant workflow docs directly. Do not create a product task solely to adjust the task process itself.

Invocation pattern:

```text
Task tool:
  subagent_type: "general"
  description: short description
  prompt:
    "You are the {plan|execute|audit} agent for SayDraw.
     Read your charter at docs/agent-charters/{plan|execute|audit}-agent.md.
     Then read docs/tasks/active_spec.md and docs/tasks/progress.md.
     [task-specific instructions here]"
```

Coordinator rules:

- Before launching an agent, verify current task status in `progress.md` and `active_spec.md`.
- Launch the agent whose turn it is.
- Do not perform another agent's substantive work inline when the Task tool is available.
- The coordinator may update status files only as an explicit handoff step requested by the relevant agent or user.
- If an agent reports `blocked`, stop and surface the blocker to the user.

## Development Priority

**Can be played publicly > complete feature set.**

If we can't make it all work, make the core loop work end-to-end: speak/type -> see SVG draw -> next frame -> playback.

## Forbidden

- Write product code without an approved active task in `docs/tasks/active_spec.md`
- Put DeepSeek key on the frontend
- Add a database by default
- Add user accounts or login
- Switch primary output format to PNG/bitmap
- Build a marketing landing page instead of the core experience
- Use color in story SVG frames
- Implement a native mobile app
- Overwrite, edit, or create files in user-provided source directories (`docs/00_design/`, `docs/_archive/`, original briefs)
