# Handoff (2026-11-19, session 9)

## Goal
Architecture review (`/improve-codebase-architecture`) and its first deepening: one drill-session module shared by Coach and Voicings. Done. Next is either another review candidate or the remaining Voicings v2 items (spec `docs/research/voicings-tab.md` §6).

## Done (all pushed to `main`)
- `cead21f`: theory-core `drillSession.ts` (pure, clock-free core) with tests, plus one `voiceMotion` function.
- `da5ff80`: transfer-key fix. One seeded draw, so Coach's "Advancing to X" names the key you actually land in.
- `74c268b`: `apps/web/src/practice/useDrillSession.ts`. CoachDrill and VoicingsPage now run on it (their file-once refs and timers are gone).
- `b89d1b7`: `GLOSSARY.md` (first version; 12 practice terms) and `docs/research/drill-session.md` (the 15 agreed decisions and the interface).
- Checks at `b89d1b7`: typecheck clean; tests 276 theory-core + 21 API + 34 web. CI for this push was NOT checked.
- The build ran in a linked session; it reported fake-MIDI checks passing in the demo build.

## In progress
Nothing. The working tree is clean apart from this file.

## Next 3 steps
1. Check CI for `cead21f`..`b89d1b7` (`gh run list -L 3`).
2. Ask Itai to try at the keyboard:
   - Coach transfer mode: does "Advancing to X" match the key you land in?
   - Voicings: ii–V–I stepping, the 12-key drill, and the new voice-motion line format.
3. Next review candidate. 04 is the warm-up; 03 is bigger.
   - **04, one progress summary:** the API's `cleanKeys`/`lastPlaceFor`/`dueConcepts` (`apps/api/src/db/practiceRepo.ts:90–125`) and the loop in `demoHistory.ts` both rebuild what theory-core's `summariseProgress` already does.
   - **03, solo tape:** the passing-tone rule is written twice in `ImprovHeatmap.tsx:320`/`:541`.

## Other review candidates (not yet started)
These were in the HTML report, which was a temp file and may be gone:
- 02: pathway editor out of `App.tsx` (pedal vs click level rules at `:184–229`).
- 05: practice history as two adapters instead of `if (DEMO)` in 9 files. `fetchDue`/`fetchEarDue` drop the `sample` flag, so rule 11 is latent risk. Partly covered: `useDrillSession` now owns the "sample never orders a drill" rule.
- 06: "Hear the head" score-building belongs in theory-core. `VoicingsPage` hard-codes swing as `2/3` and drops the doubled top note, a pitch decision made in the UI.
- 07 (speculative): one audition handle in `player.ts`.

## Decisions + why
- **No injected grader.** A closed `move | shape` union picks the grader. Coach's grader needs the previous played chord, and two near-pass-through adapters don't earn a seam.
- **A Voicings run is one chord**, so a ii–V–I is three runs: shape concepts are per quality. Leaps are graded only within a Coach run.
- **The key plan lives in the core.** A key flow advances only after a clean run. The 12-key drill advances every time and marks ✓/✗ (behaviour unchanged).
- **No ADRs written.** Nothing settled was both hard to reverse and surprising.

## Gotchas
- **`GLOSSARY.md` is now the domain vocabulary.** Add terms there as they settle; keep it free of implementation detail.
- **The exploration agent's report was wrong on one point:** the API does normalise keys on insert (`recordCoachAttempt`). Candidate 04 is about duplication, not live drift.
- Earlier gotchas (quartal under a melody, octave-free grading, Vitest scope, no Prettier) still hold.

## Suggested skills
- `mattpocock-skills:improve-codebase-architecture` to re-run the review, or to pick up 04/03 directly with `mattpocock-skills:grilling`.
- `mattpocock-skills:tdd` for any theory-core change (see `test/drillSession.test.ts`).
- `mattpocock-skills:domain-modeling` when terms change (`GLOSSARY.md`).
- `ship` when Itai says "commit and push".
