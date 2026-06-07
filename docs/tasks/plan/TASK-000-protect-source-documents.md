# TASK-000: protect-source-documents

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent

## Background

During task management system bootstrap, `SayDraw.txt` was incorrectly created as a 95-character placeholder. The original `SayDraw.txt` was a user-provided long document whose content has since been migrated to `docs/00_design/design_brief.md`. The placeholder should never have been created.

This task hardens the project against inadvertent overwrites of user-provided source materials.

## Goal

Ensure no AI agent ever overwrites or creates files in the user's original document directories:
- `docs/00_design/` and its contents
- `docs/_archive/` and its contents
- User-provided project briefs / original documents
- `SayDraw.txt` (migrated to `design_brief.md`; no longer exists)

## Non-goals

- Recovering the original SayDraw.txt content (already in design_brief.md)
- Re-organizing docs/00_design/
- Changing any code in app/, components/, lib/

## Design Source

External audit feedback.

## Files In Scope

| File | Action |
|------|--------|
| `SayDraw.txt` | Delete (was bogus placeholder) |
| `AGENTS.md` | Add "Source Document Protection" rule |
| `docs/tasks/README.md` | Add "Source Document Protection" rule |
| `docs/tasks/progress.md` | Add TASK-000 row; pre-fill all task paths |
| `docs/tasks/active_spec.md` | Point to TASK-000 as current active |
| `docs/tasks/plan/TASK-000-protect-source-documents.md` | This file |

## Forbidden Changes

- app/, components/, lib/, package.json, node_modules/
- docs/00_design/ content
- docs/_archive/ content

## Acceptance Criteria

- [x] `SayDraw.txt` no longer exists (deleted)
- [x] `AGENTS.md` contains explicit rule: user-provided original documents must NOT be overwritten or created; read-only or archive-copy only
- [x] `docs/tasks/README.md` contains same rule
- [x] `docs/tasks/progress.md` has TASK-000 row with all paths pre-filled as actual file paths (no `—` dashes)
- [x] `docs/tasks/progress.md` TASK-001 paths pre-filled to target locations
- [x] `docs/tasks/active_spec.md` updated to reference TASK-000 as current task
- [x] No product code modified

## Test First Plan

Manual verification:
1. `Test-Path E:\SayDraw\SayDraw.txt` returns `False`
2. `AGENTS.md` grep for "source document" matches the new rule
3. `docs/tasks/README.md` grep for "Protection" matches the new rule
4. `docs/tasks/progress.md` table has no `—` values in Plan/Execution Log/Audit Report columns

## Implementation Strategy

1. Delete bogus `SayDraw.txt`
2. Add "Source Document Protection" to `AGENTS.md` Forbidden list
3. Add same to `docs/tasks/README.md`
4. Rewrite `progress.md` table with pre-filled paths
5. Update `active_spec.md`

## Risks

None. This is a documentation-only change.

## Rollback

Revert the five files to their prior state. `SayDraw.txt` was always bogus and should stay deleted.

## Approval

Self-approved per external audit direction (user explicit instruction).
