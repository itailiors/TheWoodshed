# PROGRESS: learning UX, phases 2–6

Branch `feat/learn-ux-phases-2-6`, cut from `main` at 8d8d832. Plan: `PLAN.md`; detail: `docs/plans/learn-ux-spec.md`.
Real database checksum at start (must be unchanged at the end): `3c7bbe3f8c31ca0c9184c6ac993335ac8b2829edf2a59a19c7c029a5b8be77e6`.

One row per sub-phase, newest last. Status: done · parked · blocked (reverted).

| Sub-phase | Status | Commit | Checks | Notes |
|---|---|---|---|---|
| plan | done | (this commit) | n/a | PLAN.md, spec and this file; Gate 0 answered by Itai |
| 2g | done | 53af070 | typecheck ok; test 550 core + 25 api + 46 web green | `buildFacts` drops top-level `learn` before the reviver. `apps/api/test/explain.test.ts` pins sha256 `3330b645…92f8` of `buildFacts(referenceTune, dominant.tritoneSub@10.1)`: **4a must re-pin it deliberately**. Restoring pre-8d8d832 keys was taken from the audit (not re-derived from an old checkout). Counts 8→9 in README, STATE_OF_THE_UNION, index.html; §1 tree has `src/learn/`. og-card untouched |
| 2h | done | 7a5b29b | typecheck ok; test 557 core + 25 api + 46 web green | Glossary `kind` gained a 4th value `"numeral"` (case-sensitive lookup, so `iv` ≠ `IV`). Categories: 7 (MoveCategory has 7, not 8 as PLAN said); `categoryEntry(cat)`. Levels: `L0`–`L4` (L0 added too), dial words as aliases (`"L2 Colour"`); `levelEntry(n)`, for 1b. `tensions`, `diminished 7th`, `augmented triad` link to existing basics nodes; `dominant 7th`, `roman numerals` and the 5 numerals have no `conceptId` yet: **2i links them to `basics:sevenths`/`basics:numerals`**. Spec's line-cliché gloss was 10 words; shortened to 8. `prereqSummary(id, tonic, {only?, lessonFor?})`: default lookup is basics only, so rule prerequisites count 0 and the sentence then drops the "(n steps)"; **2j/3d should pass `lessonFor` using `canonicalLesson`**. Gospel's soft edge is upperStructureII (no ♭VI) as PLAN says |
