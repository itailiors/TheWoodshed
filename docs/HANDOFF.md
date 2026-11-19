# Handoff (2026-11-19, session 10)

## Goal
Work through the architecture-review candidates from session 9, one deepening per commit. Done this session: 04, 03 and 06. Left: 02, 05 and 07 (speculative), or the Voicings v2 items (spec `docs/research/voicings-tab.md` §6).

## Done (all pushed to `main`; CI green for every push)
- `8400c8b` (candidate 04): `GET /practice/progress` and `/due` call `progressSummary()` in `apps/api/src/db/practiceRepo.ts`.
  - It only loads rows; theory-core's `summariseProgress` applies the rules.
  - The demo's sample notebook (`apps/web/src/library/demoHistory.ts`) also goes through `summariseProgress`, with one stand-in run per concept. New test: `demoHistory.test.ts`.
  - Also committed the session-9 handoff.
- `3a8341b` (candidate 03): `isPassingTone` and `isOnBeat` live in theory-core `lineEval.ts`.
  - `ImprovHeatmap.tsx` closes every note through `closeNote`.
  - Bug fixed: notes cut off at the Ghost's call→response barline, or by re-striking a held pitch, skipped the passing check and counted as held avoid notes.
- `3fe6a6c` (candidate 06): theory-core `headScore(tune, path, swing)` (`voiceTheTune.ts`) builds "Hear the head".
  - It swings with `swingTime` at the player's swing ratio, like the band: waltz swings too, and note lengths are swung.
  - Tempo is capped at `HEAD_MAX_TEMPO` (112). The melody note isn't doubled in the voicing.
- Checks at `3fe6a6c`: typecheck clean; tests 281 theory-core + 21 API + 36 web.

## In progress
Nothing. The working tree is clean apart from this file.

## Next 3 steps
1. Ask Itai to try at the keyboard:
   - Voicings → Voice the tune → Hear the head: does the new swing feel right at a few slider settings?
   - Also session 9's items: Coach transfer "Advancing to X", Voicings ii–V–I stepping and the 12-key drill.
2. Candidate 05: practice history as two adapters (API vs browser/demo) instead of `if (DEMO)` in ~9 files.
   - `fetchDue`/`fetchEarDue` in `apps/web/src/library/practice.ts` drop the `sample` flag; rule 11 is latent risk there.
   - Start with `mattpocock-skills:grilling` on the adapter interface; `useDrillSession` already owns "a sample never orders a drill".
3. Candidate 02: the pathway editor out of `App.tsx` (pedal vs click level rules near `:184–229`; line numbers may have moved).

## Decisions + why
- **`progressSummary` filters improv runs in SQL** (tune and limit) but loads all Coach attempts. That's fine at personal-library scale. Attempts load newest id first, so a `createdAt` tie resolves to the later run, as the old SQL did.
- **The demo keeps per-concept totals in its JSON** rather than individual runs. It feeds `summariseProgress` one stand-in run per concept instead of changing the fixture format.
- **The head follows the band's swing slider** (`getBandFeel().swing`), so the head and the band never disagree.

## Gotchas
- On the Practice page, the fake `requestMIDIAccess` input never got `onmidimessage` hooked. Use QWERTY (click "⌨ Keys (M)", dispatch keydown/keyup on window and document) in the demo build.
- Heatmap note explanations are SVG `<title>`s. The tape clears on every loop wrap, so read them during the pass.
- The Voicings stage marks the current chord with `aria-current`. Use that to check that "Hear the head" follows along.
- The `api` preview is running from this session (read-only checks only; the database checksum was unchanged).
- A third edge case seen while testing: "A = 5 over D7(♯9,♭13)" grades as Avoid (D altered has no natural 5). That's musically defensible; not changed.

## Suggested skills
- `mattpocock-skills:grilling` before 05 or 02 (interface design).
- `mattpocock-skills:codebase-design` for the adapter seam in 05.
- `mattpocock-skills:tdd` for any theory-core change.
- `mattpocock-skills:domain-modeling` if terms change (`GLOSSARY.md`).
- `ship` when Itai says "commit and push".
