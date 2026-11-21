# Handoff (2026-11-21, session 16)

## Goal
Close out the learning-UX follow-ups left by session 15 (phases 2–6, merged as PR #1). Plan and spec: `PLAN.md`, `docs/plans/learn-ux-spec.md`; history of every sub-phase and every deferred reviewer finding: `PROGRESS.md` (P6 rows).

## Done (all merged to `main`, now at df790f1 = PR #2, https://github.com/itailiors/TheWoodshed/pull/2)
- eab500e: the Coach "doesn't work on this chart in X" notice can't fire. The engine is transposition-invariant (no bundled tune loses a move in any of 12 keys, flat or sharp spellings). New `packages/theory-core/test/transposeInvariance.test.ts` pins it; comments in `coachLesson.ts` / `CoachPage.tsx` call the notice a guard.
- ff9e242: Itai's four deferred P6 calls, as he chose them:
  - Mediant step 3 names all five voices ("Into Fmaj7, C♯ slips to C, B♭ to A, G steps down to F; A and E hold."). New `inner` motions in `MediantDominantLearn` (facts.ts, rulesAdvanced.ts). Over a 6 chord the 5th steps down to the 6th. Highlights = the 4 upper voices labelled "→ X"/"holds" (4-key cap).
  - Basics asks move to notes not yet shown: guide tones has a new step 4 asking for I's guide tones (lesson is now 4 steps); dominant resolution asks at step 2 (E → F), and its headline no longer names the landings. Pins updated in `learn.asks.test.ts`, `learn.copy.test.ts`.
  - Path tab tier bands fold at every width (`PathView.tsx`); e2e helper in `e2e/path.spec.ts` unfolds at every width.
  - Coach Learn shows `sixChordNote` (coachLesson.ts, rendered by LearnStage `chartNote`): "Your chart writes F6; F6 and Fmaj7 are both the I chord here." Only in concept scope, major charts, I written as X6 with no Xmaj7, and the lesson actually says Xmaj7.
  - Demo explanations regenerated with `--template` (no live call).
- Checks at ff9e242: typecheck clean, `--noUnusedLocals` clean in all 3 packages; tests 1141 core + 54 api + 186 web; e2e 71/71; demo build (:4174) checked by hand, 0 /api requests, clean console.

## In progress
Nothing. Local `main` = origin/main. This file is the only uncommitted change.

## Next 3 steps
1. Add a PROGRESS.md row for session 16 (the four calls above + the invariance finding), so the P6 "deferred" markers aren't stale.
2. Ask Itai which of the remaining deferred P6 items to take next (all listed in PROGRESS.md P6 rows): "mark foundations as known" (parked with 3f test-out), engineer nice 6–8 / 11 / 15a bundle baseline, UI/UX 12 (h3 inside the card button) and 15, beginner nice 9–12 and "remember the last Coach concept".
3. Optional: if Itai wants less dead code, remove the not-in-key notice and `missingInKey` now that the invariance test covers it (he was offered this; no answer yet).

## Decisions + why
- Shipping: Itai is fine with feature branch + PR instead of pushing to `main` (safer: CI runs first; he merges). Saved as a memory. `/ship` on `main` = branch, push, open PR.
- Asks: a question step already hides its own text and lit keys until answered; the give-away was earlier steps/headlines. So asks target notes the lesson hasn't named yet, one ask per lesson (the asks test assumes one).
- Mediant 5th excludes the target root (the ♭7 takes it), so F6 gets E→D, not a doubled F.

## Gotchas
- The app remembers its last mode; to reach the passport (Path tab) in the browser, switch to the Study tab first.
- `learn` facts are stripped from `buildFacts` (apps/api/src/explain.ts), so lesson-fact changes don't move the API sha pin, but lesson-step changes do roll the Deep Dive cache: regenerate the demo file with `npm run demo:generate -w @reharm/api -- --template`.
- e2e runs on :4175, so it can run while the `web-demo-build` preview holds :4174.
- Old branches `feat/learn-ux-phases-2-6` and `feat/learn-deferred-calls` are merged; Itai said keep them.
- Still no Anthropic API key: live Deep Dives won't generate.

## Suggested skills
- `ship` for commit + push (branch + PR when on main, per the memory note).
- `mattpocock-skills:grilling` or plain AskUserQuestion to settle which deferred item is next.
- `run` / the `web-demo-build` launch config to verify UI changes; `code-review` before pushing anything larger.
