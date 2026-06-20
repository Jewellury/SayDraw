# Active Spec

**Status:** idle
**Active Task:** —
**Plan:** —
**Approved:** —
**Execution Log:** —

## Handoff Notes

- TASK-018 (语音) is DONE — user-verified working end-to-end with a real voice on 2026-06-20.
- TASK-017 (画图) is DONE — passed post-execution audit 2026-06-20 (0 P0 / 0 P1 / 1 P2 / 3 P3).
  - Provider-abstract AI layer shipped (`lib/ai/provider.ts` + `lib/ai/doubao.ts` + `lib/ai/errors.ts`).
  - Few-shot prompt upgrade shipped (3 sanitize-safe examples in `COMBINED_SYS`).
  - Permanent server-side timing log `[story/generate] model call: Xms` in place.
  - **Production uses DeepSeek chat** — every available Volcano endpoint proved too slow in the 2026-06-20 bakeoff (25-45 s vs. 30 s Vercel cap). `DOUBAO_*` env vars commented out indefinitely in `.env.local` per user direction. The env-preference resolver makes a future Doubao re-evaluation a 1-line `.env.local` change. See ADR-6 in the plan file.
  - DeepSeek median latency dropped 34 % (8.5 s → 5.6 s) thanks to the tightened element-count rule (8-14) and the few-shot style anchors.
  - Build / typecheck / lint all clean. No client-exposed keys. Sacred Decisions preserved.

## Next task

None queued. Await user direction.
