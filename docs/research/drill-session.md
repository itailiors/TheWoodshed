# Drill session: agreed design (2026-11-19)

The outcome of the architecture review (candidate 01) and three rounds of design questions. Terms are from `GLOSSARY.md`.

## Why

`CoachDrill.tsx` and `VoicingsPage.tsx` each hand-build the same state machine: strike → grade → count misses → file once → advance after a timeout. The bugs live in the ordering (StrictMode, stale refs, timers that outlive the drill), not in the pure graders, and none of it is tested.

## Decisions

1. **A run** has 1..N target chords and is filed exactly once, when its last chord passes. A Coach run is a whole move. A Voicings run is one chord, so a ii–V–I is three runs in a row.
2. **Pure core in theory-core** (`src/drillSession.ts`), driven by a web hook `useDrillSession` (`apps/web/src/practice/`).
3. **Clock-free.** The core emits `wait(token)` effects. The hook owns `setTimeout` and the page owns the delay (Coach 1400 ms, Voicings 900 ms). A stale token is a no-op.
4. **Filing is an effect.** The core emits `file(record)` once per run. The hook calls `saveCoachRun` or `saveShapeRun` by record kind. No save function goes into the core.
5. **Self-check** verdicts are attempts with `by: "self"`. A run with any self-checked attempt is filed `gradedBy: "self"`, and a self-checked chord gives the next chord no voice-leading reference. Study mode stays out of the module.
6. **Voice motion**: one theory-core function in Coach's format, with chord-aware spelling, upper voices paired bottom to top, and the bass reported separately. It replaces `motionLine` in Voicings.
7. **Leaps** are counted only within a multi-chord (Coach) run. Shape runs are graded for the shape only.
8. **Key plan** belongs to the core:
   - a key flow (hold, fourths, fifths, random/transfer) moves on only after a clean run;
   - the 12-key drill (`drillKeyOrder` output) moves on after every filed run whose key matches by chroma, marks the key clean or not, and ends after 12 keys;
   - a key picked by hand, or stop, ends the 12-key drill.
9. **What stays in the pages:** tap-in pending notes, the red-pen display and Study mode. The core sees only completed strikes.
10. **Behaviour unchanged**, except decision 15. Timings and filed fields stay identical.
11. **The Changes game is out of scope.**
12. **No injected grader.** A closed union `move | shape` picks `diffStrike` + `diffVoiceLeading`, or `gradeShape`. A third kind is added when it exists.
13. **The run list is in the core.** A session holds a list of runs and walks them (a Voicings ii–V–I). ◀ ▶ and Hear the head jump to a run. Coach is the 1-run case.
14. **One seeded draw** for the random key. `nextKey` is decided when the run finishes, so the "Advancing to X" text and the key you land in always agree. This fixes a bug (`CoachDrill.tsx:204` vs `:229`). It goes in its own commit.
15. **The hook knows** both save functions and how the 12-key drill starts (`fetchProgress` → skip sample history → filter by `shapeRuleId` → `drillKeyOrder`). Sample history never orders a drill.

## Interface shape (hybrid of three designs)

The core exports:
- `startDrillSession(runs, keyTonic, plan, seed)`;
- `drillStep(session, event) → { session, effects }`;
- a read-only view: run and chord cursors, attempts, last attempt, misses, leaps, maxLeap, finished, clean, filed, nextKey, and lap progress.

Events: `strike`, `self`, `restart`, `goToRun`, `stop`, `changeKey` (by hand or from the plan), `runs` (new targets for a new key or form), and `elapsed(token)`.

Effects: `file(record)`, `wait(token, label)`, `setKey(key)`.

The hook keeps the session in a ref and runs effects in the event handler, never during render, so StrictMode's double render can't repeat them. It gives the page `strike`, `selfCheck`, `restart`, `stop`, `startTwelveKey` and the view.

## Tests to write first (against the core)

1. A 3-chord move with a miss, then a non-smooth change, files once with misses 1, leaps 1 and the right maxLeap. Later strikes emit nothing.
2. A mixed self/engine run files `gradedBy: "self"`.
3. A key flow in fourths after a clean run gives `wait` → `setKey` a fourth up. An unclean run gives neither. A stale token is a no-op.
4. Transfer with a fixed seed is reproducible, never repeats the key, and `nextKey` equals the key emitted.
5. In a 12-key lap, a run with a miss marks ✗ and still moves on. There is no 13th key. A hand pick ends the lap.
6. A shape run re-grades after filing but never files twice. A root that isn't a plain spelled key name (a fallback form) never files.
7. A 3-run ii–V–I moves to the next run after a pass. Changing the runs mid-wait cancels the move.
