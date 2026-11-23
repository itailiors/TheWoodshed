# Handoff (2026-11-23, session 19)

## Goal
Close the deferred P6 items (PROGRESS.md P6 rows; the review reports were p6-*.md in an old scratchpad, not in the repo). Every closed item gets a row in `PROGRESS.md`.

## Done
- Merged to main: PR #8 (425bbfe) "remember the last Coach concept": `CoachPage` reports its place via `onPlace`, App keeps it in a ref and makes it `coachTarget` when the mode leaves Coach. Explicit opens still win; a new tune turns a remembered move into its concept. Same session only (not stored).
- Merged to main: PR #9 (875c413) `videos/PLAN.md` + `videos/scripts/` (Playwright, demo build :4174). Clips and frames stay git-ignored in `videos/clips`, `videos/shots`. Deep dive clip didn't record.
- Repo settings (Itai asked): auto-merge allowed; "Automatically delete head branches" on; `main` requires the "Typecheck, test, build" check (admins not enforced, so a direct push to main still works). All 10 merged branches deleted locally and on GitHub; only `main` is left.
- Merged to main: PR #10 (squash 0012323), from `/next-steps 3` plus the Tone fix. It merged before CI ran (main had no required check yet); CI on main then went green. Its commits:
  - 579186a step 1, engineer nice 6–8: guard tests match tokens on whitespace-stripped source; learn.copy's 10.5 s sweep split per concept in chunks of ≤ 300 (max case ~0.7 s); 30 s timeouts → 15 s in learn.copy/moveCopy; coach.spec ISOLATION polls the store for 2 s instead of a 500 ms sleep.
  - 2354731 step 2, engineer nice 11: `coachFreshStart` useMemo on `[mode, coachTarget, historyLoading, ownHistory]`.
  - a9e3b41 step 3, engineer nice 15a: bundle baseline in STATE_OF_THE_UNION §6.
  - 38c9d70 perf(audio): Tone.js out of the entry chunk. Volume store → Tone-free `audio/mix.ts` (`band.ts` re-exports it and subscribes to apply it to Tone); `audio/ghostSax.ts` is a lazy stand-in for the heatmap. Entry 577,799 → 322,050 raw (175,006 → 109,702 gzip). `toneIsolation.test.ts` guards it.
- Local checks before the merge: typecheck clean; tests 1180 core + 54 api + 205 web; e2e 74/74; master volume → Tone destination and the ghost sax checked live in the dev preview.
- Global `~/.claude/CLAUDE.md` and the ship memory updated: ship = branch + PR + `gh pr merge --auto --squash`, merged branches deleted.

## In progress
Nothing. Local `main` = origin/main at 0012323. This update to `docs/HANDOFF.md` is uncommitted.

## Next 3 steps
1. Itai: listen to the band, the mixer and the Ghost Master's sax once (the volume path now goes through a subscription; checked by value, not by ear).
2. Beginner nice 9–12 (lesson/glossary copy; changes the api facts sha and needs `demo:generate -- --template`): needs Itai's wording, so ask first.
3. Still parked: "mark foundations known" and 3f ("I know this" test-out), waiting on the ⚙ counters after real use.

## Decisions + why
- `coachFreshStart` keeps `mode` in its deps: a lesson finished in Study changes the flags but no other dep.
- learn.copy chunks by concept AND size: constant structure alone has ~1,400 tune lessons (~5 s in one case).
- voiceTheTune/voicingForms keep their 30 s timeouts (not in the review; ≤ 1.1 s each).
- The coach ISOLATION 250 ms waits stay: they pace the notes, not a negative assertion.
- "Remember the Coach concept" isn't persisted across reloads (the deferred item said App state). Persisting is an option if Itai wants it.
- HANDOFF.md was left out of the PR #8/#9 commits because it was already modified when the session started.

## Gotchas
- Anything outside `audio/engine.ts`/`audio/band.ts` must import volumes from `audio/mix.ts`, not `band.ts`, or Tone lands in the entry chunk again (`toneIsolation.test.ts` fails).
- `Map.groupBy` isn't in the TS lib target: group by hand.
- Squashed-source regexes break `\b` after a tag name (`<CoachDrillmove=`): count tags on the raw source.
- `gh pr merge --auto` works now that the repo allows auto-merge.
- Global CLAUDE.md now says "merge once CI is green" = `/ship`, `gh pr create --fill`, `gh pr merge --auto --squash` (earlier PRs here were merge commits).

## Suggested skills
- `ship` for push + PR.
- `code-review` on the branch before merging (38c9d70 touches audio loading).
