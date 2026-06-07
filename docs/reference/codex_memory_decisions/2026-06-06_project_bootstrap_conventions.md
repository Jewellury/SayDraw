# Decision: New Project Bootstrap Conventions

Date: 2026-06-06

## Context

During the SayDraw setup, an AI-generated implementation scaffold appeared before the design direction and collaboration workflow were fully approved. The scaffold contained some useful boundaries, but it also drifted away from the high-fidelity design source. This exposed a reusable project-start problem: implementation can begin too early unless the repository first defines agent roles, task state, source-of-truth order, and approval gates.

## Decision

For new AI-assisted projects, establish a standard initial configuration before product implementation:

1. Create or update `AGENTS.md`.
2. Create agent charters for `plan-agent`, `execute-agent`, and `audit-agent`.
3. Create `docs/tasks/README.md`, `progress.md`, `active_spec.md`, and flat task folders:
   - `plan/`
   - `execution-log/`
   - `audit-report/`
   - `artifacts/`
4. Require each task to move through:
   - plan
   - approval
   - execution
   - audit
   - done or blocked
5. Allow only one active task at a time through `docs/tasks/active_spec.md`.
6. Keep design and product source documents separate from implementation scaffolds.
7. Use test-first or acceptance-first planning before execution.

## Rationale

This structure is compact enough for AI agents to read quickly, but explicit enough to prevent scope drift. The flat task folders avoid deeply nested task dossiers while preserving separate ownership for plan, execution log, and audit report. `active_spec.md` gives the current agent a single small file to read first, while `progress.md` provides a lightweight project board.

## Alternatives Considered

- **One folder per task:** Clear for humans, but creates more paths and more context overhead for AI agents.
- **One markdown file per task:** Compact, but plan, execution, and audit ownership can bleed together.
- **No task files, only chat instructions:** Fast initially, but fragile across context compaction, agent switching, and parallel work.

## Consequences

- New projects spend a small amount of time on setup before coding.
- Agents have a clearer stop condition and fewer opportunities to start unapproved work.
- Audit reports and execution logs become easier to compare across tasks.
- The workflow depends on agents respecting `active_spec.md`; `AGENTS.md` must make this rule explicit.

## Revisit Conditions

Revisit if:

- The task system becomes too heavy for small one-file projects.
- Multiple independent workstreams are needed at the same time.
- A future tool provides native task state with equivalent source-of-truth and approval gates.
