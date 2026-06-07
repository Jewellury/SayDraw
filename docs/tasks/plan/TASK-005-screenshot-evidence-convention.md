# TASK-005: screenshot-evidence-convention

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent

## Background

TASK-004 passed audit with 15/15 ACs but `docs/tasks/artifacts/TASK-004-align-first-screen-with-hifi-proxy/` only contains pre-edit backups — no desktop/tablet/mobile screenshots. Visual tasks (animation, texture, layout) need browser screenshots as hard evidence for audit. This convention should be baked into task templates so future tasks automatically produce them.

## Goal

Codify the screenshot evidence requirement into `docs/tasks/plan/TEMPLATE.md` so every visual task plan includes it, and update `docs/tasks/README.md` to mention it under the artifacts section.

## Non-goals

- Taking screenshots for TASK-004 (already done, not worth reopening)
- Modifying product code at all
- Adding any tooling or dependencies

## Design Source

External audit feedback: "这类视觉任务最好保留 desktop/mobile 截图证据。TASK-005 开始建议把截图作为硬 evidence。"

## Files In Scope

| File | Action |
|------|--------|
| `docs/tasks/plan/TEMPLATE.md` | Add "Screenshot Evidence" section to Test First Plan |
| `docs/tasks/README.md` | Add screenshot mention under artifacts |
| `docs/tasks/progress.md` | Add TASK-005 row |

## Forbidden Changes

- app/, docs/00_design/, docs/_archive/, AGENTS.md, package.json, all config files

## Acceptance Criteria

- [AC1] `docs/tasks/plan/TEMPLATE.md` includes a prompt to capture desktop/tablet/mobile screenshots for visual ACs.
- [AC2] `docs/tasks/README.md` artifacts section mentions screenshots as expected evidence for visual tasks.
- [AC3] No product code modified.

## Test First Plan

Read current TEMPLATE.md and README.md → edit → verify changes render correctly.

## Implementation Strategy

1. In `plan/TEMPLATE.md` Test First Plan section, add:
   ```
   ### Screenshot Evidence (required for visual tasks)
   - Desktop (1440×900)
   - Tablet (834×1112)
   - Mobile (390×844)
   Save to docs/tasks/artifacts/TASK-XXX-kebab-title/
   ```
2. In `README.md` artifacts section, add: "Visual tasks should include browser screenshots at common breakpoints."

## Risks

None. Documentation-only change.

## Rollback

Revert both files to prior content.
