# docs/tasks/ - AI-Friendly Task Management System

## Purpose

A minimal fixed-path task system for AI agents. It protects product code from unplanned edits without turning every small task into a heavy process.

This system is for product implementation work. Explicit user-requested maintenance of workflow docs, agent charters, templates, or operating rules can use **Micro Lane** and does not need a product task, provided no product code, protected source document, API key, generated behavior, package file, or runtime config is modified.

## Directory Structure

```text
docs/tasks/
  README.md              This file. Stable rules, not a task log.
  progress.md            Lightweight task kanban. One table for all tasks.
  active_spec.md         Current active task and execution gate.
  plan/                  All task plans (TASK-XXX-kebab-title.md)
  execution-log/         Execution logs (same filename as the plan)
  audit-report/          Audit reports (same filename as the plan)
  artifacts/             Evidence, screenshots, logs per task
    TASK-XXX-kebab-title/
      .gitkeep               Visual tasks should include browser screenshots at common breakpoints (desktop 1440×900, tablet 834×1112, mobile 390×844).
```

## File Naming Rules

1. Filename format: `TASK-XXX-kebab-title.md`.
2. `XXX` is a zero-padded sequential number (`001`, `002`, ...).
3. Plan, execution log, and audit report for the same task share the exact same filename, distinguished only by directory.
4. Artifacts go in `artifacts/TASK-XXX-kebab-title/`.
5. In `progress.md`, the Plan / Execution Log / Audit Report columns should contain the actual relative target path when that artifact exists.

## Source Document Protection - Critical

- User-provided original documents must never be overwritten, edited, or created by AI agents.
- Protected directories: `docs/00_design/`, `docs/_archive/`.
- AI may read these files. AI may copy them into an archive location. AI must never modify originals.
- If a referenced source file does not exist on disk, ask the user. Do not create a placeholder.
- This rule applies to all three agents.

## Product Code vs Agent Output

The task gate protects product/project implementation files such as `app/`, `components/`, `lib/`, API routes, runtime config, package files, and generated application behavior.

Normal agent workflow outputs are allowed without treating them as product code:

- plan-agent may write `docs/tasks/plan/`, `docs/tasks/progress.md`, and `docs/tasks/active_spec.md`.
- execute-agent may write `docs/tasks/execution-log/`, `docs/tasks/artifacts/`, and execution status fields.
- audit-agent may write `docs/tasks/audit-report/`, `docs/tasks/artifacts/`, and audit status fields.

## Status Source Of Truth

- `docs/tasks/active_spec.md` is the execution gate and the current active-task status source.
- `docs/tasks/progress.md` is the project board and historical index.
- Task plan files describe scope, constraints, acceptance criteria, and verification. They must not include lifecycle status fields such as `Status: planned`.
- If `active_spec.md` and `progress.md` disagree, stop and reconcile them before launching another product agent. Treat `active_spec.md` as the safer source for whether product code may be changed.

## Agent Permissions

### plan-agent

- **Can:** Create/update files in `docs/tasks/plan/`; update `progress.md`; update `active_spec.md` when approving a plan.
- **Cannot:** Write product code. Cannot modify `docs/00_design/` or `docs/_archive/`.
- **Default behavior:** If asked to write a plan, write the plan file without a lifecycle `Status:` field. Only keep it chat-only when the user explicitly asks for chat-only output.

### execute-agent

- **Can:** Execute only the task pointed to by `active_spec.md`; update `execution-log/`; update `artifacts/`; modify product code within the active plan's scope.
- **Cannot:** Change the plan, expand scope, audit its own work, or modify `docs/00_design/` / `docs/_archive/`.

### audit-agent

- **Can:** Update `audit-report/`; update `artifacts/`; update audit status in `progress.md`; clear `active_spec.md` after a passing audit and mark the task `done`.
- **Cannot:** Directly fix code, add new features, change the plan, or modify `docs/00_design/` / `docs/_archive/`.
- **Default behavior:** Audit the active plan's acceptance criteria first. Do not fail a task for future features that are outside the active plan.

## Fast Lane vs Full Lane

Use the lightest workflow that preserves safety.

### Micro Lane

Use for docs-only maintenance of the workflow itself: `AGENTS.md`, `docs/tasks/README.md`, task templates, and agent charters.

```text
user requests workflow/doc change
main conversation edits workflow docs directly
verify docs are internally consistent
done
```

Micro Lane cannot modify product implementation files, protected source documents, API keys, generated app behavior, package files, or runtime config.

### Fast Lane

Use for small visual, copy, layout, or single-surface tasks.

```text
plan-agent writes concise plan file
user approves
plan-agent updates active_spec.md + progress.md
execute-agent implements and writes concise execution log
audit-agent checks active ACs + build/type/basic safety
done
```

Fast Lane plans still need:

- Goal
- Non-goals
- Files in scope
- Forbidden changes
- Acceptance criteria
- Verification commands or visual checks
- Rollback

### Full Lane

Use for tasks involving API keys, server routes, generated SVG sanitization, AI calls, new dependencies, deployment, data migration, broad refactors, or cross-module contracts.

Full Lane uses the complete template sections and a fuller audit trail.

## Status Flow

```text
planned -> approved -> in_progress -> audit -> done
planned -> blocked
approved -> blocked
in_progress -> blocked
audit -> blocked
```

- **planned:** Plan file exists, awaiting approval.
- **approved:** Plan is approved, `active_spec.md` points here. Ready for execution.
- **in_progress:** execute-agent is working.
- **audit:** audit-agent is reviewing.
- **blocked:** Cannot proceed without a decision, dependency, or external-state change.
- **done:** Passed audit, all P0/P1 resolved.

Status files are workflow metadata. They should not create extra approval loops by themselves. If the user clearly says "approve this plan", plan-agent may update both `progress.md` and `active_spec.md` in one pass.

## active_spec.md - The Gate

- `active_spec.md` is the only file that authorizes product code changes.
- If `active_spec.md` shows no approved active task, execute-agent must not write product code.
- Only plan-agent can approve a task by updating `active_spec.md`.
- execute-agent may move the active task from `approved` to `in_progress` and from `in_progress` to `audit`.
- audit-agent may clear `active_spec.md` after a passing audit and mark the task `done`.
- After a task reaches `done`, `active_spec.md` must be cleared before the next execution task starts.

## progress.md - The Kanban

- A single Markdown table tracks every task lifecycle.
- Columns: `| Task | Title | Status | Active | Plan | Execution Log | Audit Report | Next Action |`
- Status is updated by the agent currently owning the task or by the coordinator as an explicit handoff step.
- The Plan / Execution Log / Audit Report columns should contain actual relative paths from `docs/tasks/` when those artifacts exist.
- Not for long-form plans, designs, or architecture notes.

## Source of Truth Priority

When sources conflict, follow this order:

1. Current user explicit instruction
2. `docs/tasks/active_spec.md`
3. Current task's plan file (`docs/tasks/plan/TASK-XXX-*.md`)
4. `docs/00_design/高保真静态图.jpg`
5. `docs/00_design/frontend_design_spec.md`
6. `docs/00_design/HuaHuaBen.jsx`
7. `docs/00_design/design_brief.md`
8. `AGENTS.md` and agent charters

## Superpowers Workflow

Use the relevant part of the workflow, not the heaviest version by default:

1. **brainstorming:** Direction not settled. Discuss and write design docs only. No product code.
2. **writing-plans:** Every product task starts with a plan file. No execution before approval.
3. **executing-plans:** execute-agent follows the approved plan. No scope expansion.
4. **test-driven-development:** Feature tasks define failing checks first. UI tasks define visual acceptance points first.
5. **requesting-code-review:** Every execution task gets audited. P0/P1 unresolved means not done.
6. **finishing-a-development-branch:** After audit passes, update progress, clear active_spec, then move to the next task.
