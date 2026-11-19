# Handoff (2026-11-20, session 11)

## Goal
Work through the architecture-review candidates from session 9, one deepening per commit. Done this session: 05 and 02. Left: 07 (speculative), or the Voicings v2 items (spec `docs/research/voicings-tab.md` §6).

## Done (both pushed to `main`)
- `640d594` (candidate 05): practice history now goes through one `PracticeHistory` interface (`apps/web/src/library/practice.ts`).
  - Two adapters: `historyApi.ts` (sessions, `sendBeacon` on pagehide) and `historyBrowser.ts` (IndexedDB plus the sample notebook). The adapter is picked once from `DEMO`; the public functions are unchanged.
  - Rule 11 fix: the browser adapter's `due()` never returns the sample notebook's reviews. The old `fetchDue` returned them without the `sample` flag.
  - New test: `historyBrowser.test.ts`. `localProgress` is gone; `memoryBackend` and `Backend` are exported for tests.
  - Also committed the session-10 handoff.
- `49a75d6` (candidate 02): theory-core `pathwayEditor.ts` holds `editPathway(state, event, candidates)`.
  - Events: dial, pedal, pick, keep, release, select, newTune, link. `editorPathway` and `editorPicks` derive the pathway.
  - `apps/web/src/usePathwayEditor.ts` gives a stable `edit`. `App.tsx` no longer holds level, forced, kept or selectedId state.
  - Bug fixed: a stale pick id (old link) crashed the next pick through `accepted.find(...)!`.
  - Test: `packages/theory-core/test/pathwayEditor.test.ts` (9 tests).
- Checks at `49a75d6`: typecheck clean; tests 290 theory-core + 21 API + 40 web. CI not checked after the push.

## In progress
Nothing. The working tree is clean apart from this file.

## Next 3 steps
1. Ask Itai to try at the keyboard:
   - "Hear the head" swing at a few slider settings.
   - Session 9's Coach transfer, ii–V–I stepping and the 12-key drill.
   - A quick pass on pathway editing: pick, keep and the linked pedal. It was verified in the dev app, but not by ear.
2. Check that GitHub CI went green for `640d594` and `49a75d6`.
3. Choose between candidate 07 and Voicings v2 (`docs/research/voicings-tab.md` §6). Ask Itai; 07 was marked speculative.

## Decisions + why
- **05 was smaller than the handoff said.** Only `practice.ts` branched on `DEMO` for history. The other `DEMO` uses (library, Deep Dive, UI labels) were left alone on purpose.
- **Change-game sessions stay in `localStore` in every build.** They're outside the adapter because the API has no tables for them.
- **The editor reducer lives in theory-core,** like `drillSession`. That keeps it pure and testable without React.
- **A new tune keeps the dial level;** a link without a level keeps the current one. Both match the old behaviour.

## Gotchas
- **Chord selector options** are `li[role=option]` wrapping a `button`. Click the inner button, or nothing happens.
- **Live pedal module:** import it from its `performance` resource URL, then call `pedal.setLinked(true)` and `pedal.input(1, 127)`. Restore the previous linked state afterwards.
- **Console logs** keep stale HMR errors from halfway through edits (same `?t=` timestamp). Compare timestamps before calling something broken.
- **Previews still running:** `api` and `web`. Only reads were sent; the database checksum was unchanged. I cleared the test run from the demo build's IndexedDB.
- **Only chords some move targets have a selector,** so `keep=c3` on Co-op Blues shows nothing.

## Suggested skills
- `mattpocock-skills:grilling` before picking 07 or scoping Voicings v2.
- `mattpocock-skills:tdd` for theory-core work.
- `mattpocock-skills:codebase-design` if 07 is a deepening.
- `ship` when Itai says "commit and push".
