# TASK-003: fix-build-lint-config

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent

## Background

TASK-002 cleared archive-caused tsc errors. `tsc --noEmit` passes with zero errors. However, `npm run build` fails at the linting phase with:

```
Error: Definition for rule '@typescript-eslint/no-unused-vars' was not found.
```

The `.eslintrc.json` explicitly declares `@typescript-eslint/no-unused-vars` in its `rules` object, but the corresponding ESLint plugin is not installed as a direct dependency. The `next/core-web-vitals` preset already handles this rule internally.

## Goal

Fix `.eslintrc.json` so `npm run build` passes (exit code 0). tsc must still pass.

## Non-goals

- Installing new npm packages
- Modifying package.json
- Changing any product code

## Design Source

TASK-002 audit report P2 finding.

## Files In Scope

| File | Action |
|------|--------|
| `.eslintrc.json` | Remove explicit `@typescript-eslint/no-unused-vars` rule |
| `docs/tasks/plan/TASK-003-fix-build-lint-config.md` | Create |
| `docs/tasks/execution-log/TASK-003-fix-build-lint-config.md` | Create |
| `docs/tasks/audit-report/TASK-003-fix-build-lint-config.md` | Create |
| `docs/tasks/progress.md` | Add TASK-003; update TASK-001 Next Action |
| `docs/tasks/active_spec.md` | Point to TASK-003 |

## Forbidden Changes

- app/
- docs/00_design/
- docs/reference/
- AGENTS.md
- package.json
- package-lock.json
- tsconfig.json
- README.md
- .gitignore
- node_modules/

## Acceptance Criteria

- [AC1] `.eslintrc.json` no longer references `@typescript-eslint/no-unused-vars`.
- [AC2] `tsc --noEmit` passes.
- [AC3] `npm run build` exit code 0.
- [AC4] No product code modified.
- [AC5] `package.json` unchanged.

## Test First Plan

1. Confirm build currently fails (baseline).
2. Modify `.eslintrc.json`.
3. tsc → build → both must pass.

## Implementation Strategy

1. Remove `rules` object from `.eslintrc.json`, keeping only `"extends": "next/core-web-vitals"`.
2. Run tsc and build.

## Risks

None. Removing an unused ESLint rule has no impact on runtime behavior.

## Approval

Self-approved per user explicit instruction.
