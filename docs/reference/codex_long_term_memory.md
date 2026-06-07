# Codex Long-Term Memory

Updated: 2026-06-07

This file stores stable project operating rules for Codex sessions. It should contain reusable decisions, preferences, pitfalls, and unresolved items, not chat logs or temporary task state.

## Reusable Project Bootstrap Rules

### New Project Initial Configuration

- **Preference:** New projects should start by establishing collaboration structure before implementation. Create or update `AGENTS.md`, agent charters, design source documents, and task tracking files before agents write product code.
- **Decision:** Use a three-agent workflow for AI-assisted projects:
  - `plan-agent` writes task plans and controls scope.
  - `execute-agent` implements only approved active tasks.
  - `audit-agent` reviews task output and reports P0/P1/P2/P3 findings without adding features.
- **Decision:** Use a flat, AI-friendly task directory layout:
  - `docs/tasks/README.md` for task system rules.
  - `docs/tasks/progress.md` for lightweight task status.
  - `docs/tasks/active_spec.md` for the single current active task.
  - `docs/tasks/plan/TASK-XXX-kebab-title.md` for plans.
  - `docs/tasks/execution-log/TASK-XXX-kebab-title.md` for execution logs.
  - `docs/tasks/audit-report/TASK-XXX-kebab-title.md` for audit reports.
  - `docs/tasks/artifacts/TASK-XXX-kebab-title/` for screenshots, command output, and other evidence.
- **Decision:** Only one active task should exist at a time. If `docs/tasks/active_spec.md` does not point to an approved active task, `execute-agent` must not modify product code.
- **Preference:** Every task should follow a lightweight superpowers-style flow: brainstorming when direction is unclear, writing-plans before implementation, executing-plans after approval, test-driven-development where applicable, requesting-code-review via `audit-agent`, then finishing and clearing the active task.
- **Preference:** Use test-first thinking for all tasks. Functional tasks should define the failing check first. UI tasks should define visual acceptance criteria first.
- **Decision:** Future projects using plan/execute/audit agents should distinguish **product code** from **agent workflow output**. "No code changes without a task" should protect implementation files (`app/`, `components/`, `lib/`, API routes, runtime config, package files, generated behavior), but should not block plan-agent from writing `docs/tasks/plan/`, execute-agent from writing `docs/tasks/execution-log/` and `artifacts/`, or audit-agent from writing `docs/tasks/audit-report/`.
- **Preference:** Three-agent prompts should default to a **Micro Lane / Fast Lane / Full Lane** model. Micro Lane is for explicit docs-only workflow maintenance in `AGENTS.md`, `docs/tasks/`, task templates, and agent charters, and may be handled directly by the main conversation. Fast Lane is for small visual, copy, layout, and single-surface product tasks: concise plan file, one user approval, direct execution, active-task AC audit. Full Lane is for API keys, server routes, generated SVG sanitization, AI calls, new dependencies, deployment, migrations, broad refactors, or cross-module contracts.
- **Decision:** Task lifecycle status should have a single operational source. `docs/tasks/active_spec.md` is the execution gate and current active-task status source; `docs/tasks/progress.md` is the project board and historical index. Plan files describe scope and acceptance criteria and should not contain lifecycle fields such as `Status: planned`, because those labels become stale after approval.
- **Decision:** For docs-only workflow maintenance requested explicitly by the user, do not create a product task merely to change the task process itself. Use Micro Lane, edit workflow docs directly, and verify internal consistency. Micro Lane must not touch product implementation files, protected source documents, API keys, generated behavior, package files, or runtime config.
- **Preference:** audit-agent should close passing tasks when there are no unresolved P0/P1 findings by marking the task `done` in `progress.md` and clearing `active_spec.md`. This removes a coordinator-only cleanup step and reduces handoff friction.
- **Pitfall:** Over-broad wording like "do not modify any files" can cause plan-agent to paste plans into chat instead of creating the intended plan file. Prefer "do not modify product code; write normal task artifacts in the allowed docs/tasks paths."
- **Pitfall:** Duplicating lifecycle status across plan files, `active_spec.md`, and `progress.md` creates stale-status confusion. The observed case was a plan file still saying `Status: planned` while `active_spec.md` and `progress.md` had advanced to execution/audit. Avoid lifecycle fields in plans and reconcile `active_spec.md`/`progress.md` before launching another product agent if they disagree.
- **Preference:** plan-agent should create or update a plan file by default when asked to "write a plan"; chat-only output should be reserved for explicit chat-only requests. When the user clearly says "approve this plan", plan-agent may update both `active_spec.md` and `progress.md` in one pass instead of creating another approval loop.
- **Preference:** audit-agent should audit the active plan's acceptance criteria first, plus global safety checks that are relevant to that task. It should not fail early visual/static tasks for missing future features such as playback, AI, voice, Novus triggers, or full happy path unless the active plan includes them.
- **Preference:** In new-project agent charters, include an "Output Permissions Clarification" section for every agent so each one knows which files it may write as normal workflow output and which product/source files remain forbidden.
- **Preference:** Visual tasks should require screenshot evidence, but screenshot tooling should stay outside the project dependency graph unless the project already uses it. Do not add Playwright or browser libraries to a product repo merely to satisfy audit screenshots; use external browser tools, Codex browser capability, or manual screenshots instead.
- **Pitfall:** Chat-attached reference screenshots are not automatically available as filesystem artifacts. When a visual task uses a chat image as its oracle, explicitly save or ask the user to save it under the task artifact directory (for example `reference-*.png`) before audit, otherwise later agents may lose the visual baseline.
- **Pitfall:** Browser automation may be able to open a page but still fail when capturing screenshots in certain viewport sizes or Windows headless/GPU environments. If screenshot capture fails after a couple of targeted attempts, stop and hand off manual screenshot steps rather than installing new dependencies, widening scope, or marking screenshot ACs as passed without evidence.
- **Pitfall:** Letting a project AI begin implementation before the design and task workflow are approved creates cleanup churn. Freeze or archive premature scaffolds, preserve design sources, then soft-reboot the implementation layer if the direction changed.
- **Preference:** For design-led projects, establish a source-of-truth order in project docs. Current user instructions and `active_spec.md` override stale implementation. Reference screenshots and design specs override generic UI defaults.
- **Decision:** For LLM-backed web apps, API keys must live only in server-side routes or server-side libraries. Frontend code must call project API routes, not model provider URLs directly.

## SayDraw-Specific Stable Context

- **Fact:** SayDraw's design source of truth currently lives under `docs/00_design/`.
- **Fact:** SayDraw's high-fidelity visual direction is warm paper sketchbook plus dark playback theater, with black ink SVG story frames and restrained dad/kid accent colors.
- **Decision:** SayDraw should not continue refining the premature gray mobile scaffold as the production UI. Preserve it only as archive/reference and rebuild the implementation layer from the design source.
- **Pitfall:** If `http://localhost:3001/` shows connection refused, first check whether the Next.js dev server is actually listening on port 3001. In the observed case, the project code and build were fine; the dev server from the earlier task had stopped. Restart with `npm run dev -- -p 3001` or a direct Next dev command, then verify with an HTTP request before investigating page code.
- **Inference:** On this Windows setup, Next may print a warning that `@next/swc-win32-x64-msvc` is "not a valid Win32 application" while still falling back successfully. Treat that warning as non-blocking when `next dev`, `tsc`, and `next build` otherwise pass.
- **Pitfall:** If a Next.js App Router page renders like naked HTML/default controls even though JSX class names are present, check `app/layout.tsx` for `import "./globals.css";` and inspect the served HTML for `_next/static/css` before tuning component styles. Missing global CSS import can make a visually aligned implementation appear completely broken.
- **Pitfall:** If `next dev` returns a 500 such as `Cannot find module './833.js'` after `npm run build` succeeds, suspect stale `.next` runtime chunks from running `next build` while the dev server was still active. Restart the dev server, and clear `.next` only if a restart does not resolve it.
- **Preference:** On this Windows/Codex setup, run local Next dev servers in a persistent PowerShell window (`npm.cmd run dev -- -p 3001`) when the user needs to keep using the browser. Foreground tool commands can stop on timeout, and temporary background helpers may not survive reliably. This is a local development concern only; Vercel/production deployment does not depend on the local dev server staying open.
- **Pitfall:** Config errors can stay hidden while the affected file is not imported. In this project, PostCSS ESM compatibility only surfaced after `globals.css` was added to `app/layout.tsx`. If a task must touch a normally forbidden config file to make existing styles load, record it as a necessary scope deviation for audit rather than silently treating it as a product feature change.
- **Stable rule — Dev server port 3001:** SayDraw's Next.js dev server runs on port 3001 (`npm run dev -- -p 3001`). When the browser shows "connection refused" at `http://localhost:3001/`, the dev server process is down — this is never a DeepSeek key issue, never a code bug, and never a dependency problem. Always verify with `Invoke-WebRequest http://127.0.0.1:3001/` before investigating anything else. Full runbook at `docs/reference/dev-server-runbook.md`.

## Needs Confirmation

- Whether the new project bootstrap convention should be promoted outside this repository into a global Codex template or skill.
- Whether the Micro Lane / Fast Lane / Full Lane three-agent convention should become the default global template for future hackathon-style projects.
- Whether model-provider fallback should be treated as a first-class reversible routing choice, with UI copy that clearly marks any temporarily reserved prompt fields as inactive until the richer dual-model path returns.
