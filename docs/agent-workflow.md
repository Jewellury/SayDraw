# Agent Workflow — SayDraw Task Pipeline

> How the three agents (plan-agent, execute-agent, audit-agent) collaborate through the `docs/tasks/` system.

For the authoritative task-system rules, see `docs/tasks/README.md`. This file is a short workflow guide.

## 0. Micro Lane

Use Micro Lane for explicit user-requested workflow documentation changes: `AGENTS.md`, `docs/tasks/README.md`, task templates, and agent charters.

- The main conversation may edit those workflow docs directly.
- Do not touch product implementation files, protected source documents, API keys, generated behavior, package files, or runtime config.
- Verify the workflow docs remain internally consistent.

## 1. Brainstorming

- Use when design or approach is **not yet settled**.
- Only discuss and write design materials (specs, briefs, diagrams).
- **No code is written.**
- Output goes to `docs/00_design/` or reference notes in `docs/reference/`.

## 2. Writing Plans

- Every task **starts with a plan file** in `docs/tasks/plan/`.
- plan-agent owns this phase.
- Plan files **must** include:
  - Acceptance criteria (what does "done" mean?)
  - Test-first strategy (how will we verify before we build?)
  - Files in scope and forbidden files
  - Rollback plan
- Plan files must not include lifecycle `Status:` fields. Status lives in `active_spec.md` and `progress.md`.
- **Plan is not approved until `active_spec.md` points to it.**

## 3. Executing Plans

- execute-agent reads `docs/tasks/active_spec.md` before doing anything.
- If no approved active task: **stop, do not write code.**
- execute-agent strictly follows the approved plan:
  - Does **not** re-debate direction.
  - Does **not** expand scope.
  - Does **not** modify files outside the plan's scope.
- Writes execution log to `docs/tasks/execution-log/`.
- Stores evidence in `docs/tasks/artifacts/TASK-XXX-kebab-title/`.

## 4. Test-Driven Development

- **Feature tasks**: Write a failing check first, then implement until it passes.
- **UI tasks**: Write visual acceptance points first, then implement until they match.
- Every task must have a **minimum verification command** or **manual acceptance path**.
- Test results are recorded in the execution log.

## 5. Requesting Code Review

- After execution, every task goes to **audit-agent**.
- audit-agent produces a report in `docs/tasks/audit-report/`.
- Findings are classified: **P0** (block ship), **P1** (must fix), **P2** (should fix), **P3** (nice to have).
- **P0 and P1 issues must be resolved** before the task can reach `done`.
- audit-agent does **not** fix code — it reports findings for execute-agent to address.

## 6. Finishing a Development Branch

1. Task passes audit (P0/P1 resolved).
2. Update `docs/tasks/progress.md`: set status to `done`.
3. Clear `docs/tasks/active_spec.md` (set Active Task to `(none)`).
4. The project is now ready for the **next task**.

## State Machine

```
              plan-agent                plan-agent
  (nothing) ────────────→ planned ──────────────────→ approved
                              │                            │
                              │ (blocked)                  │ (blocked)
                              ▼                            ▼
                           blocked                      blocked
                                                            │
                                              execute-agent │
                                                            ▼
                                                       in_progress
                                                            │
                                                            │ (blocked)
                                                            ▼
                                             audit-agent blocked
                                                            │
                                              audit-agent   │
                                                            ▼
                                                          audit
                                                            │
                                                            │ (blocked)
                                                            ▼
                                                          blocked
                                                            │
                                             (P0/P1 fixed)  │
                                                            ▼
                                                           done
                                                            │
                                              plan-agent    │
                                                            ▼
                                                    (clear active_spec,
                                                     pick next task)
```

## Agent Communication

- Agents do **not** talk to each other directly.
- They communicate through the filesystem:
  - plan-agent writes `plan/` + `active_spec.md`
  - execute-agent reads `active_spec.md`, writes `execution-log/`
  - audit-agent reads `plan/` + `execution-log/`, writes `audit-report/`
- `progress.md` is the shared status board all three agents update.
- If an old plan file has a stale status label, ignore it and follow `active_spec.md` first, then `progress.md`.
