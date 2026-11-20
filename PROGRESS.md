# PROGRESS: learning UX, phases 2–6

Branch `feat/learn-ux-phases-2-6`, cut from `main` at 8d8d832. Plan: `PLAN.md`; detail: `docs/plans/learn-ux-spec.md`.
Real database checksum at start (must be unchanged at the end): `3c7bbe3f8c31ca0c9184c6ac993335ac8b2829edf2a59a19c7c029a5b8be77e6`.

One row per sub-phase, newest last. Status: done · parked · blocked (reverted).

| Sub-phase | Status | Commit | Checks | Notes |
|---|---|---|---|---|
| plan | done | (this commit) | n/a | PLAN.md, spec and this file; Gate 0 answered by Itai |
| 2g | done | 53af070 | typecheck ok; test 550 core + 25 api + 46 web green | `buildFacts` drops top-level `learn` before the reviver. `apps/api/test/explain.test.ts` pins sha256 `3330b645…92f8` of `buildFacts(referenceTune, dominant.tritoneSub@10.1)`: **4a must re-pin it deliberately**. Restoring pre-8d8d832 keys was taken from the audit (not re-derived from an old checkout). Counts 8→9 in README, STATE_OF_THE_UNION, index.html; §1 tree has `src/learn/`. og-card untouched |
