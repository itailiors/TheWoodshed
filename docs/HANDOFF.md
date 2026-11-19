# Handoff (2026-11-19, session 5)

## Goal
Turn Itai's Open Studio PDFs into engine features, one ranked gap at a time. This session digested all 15 PDFs, checked the leads against the code, and built two rules.

## Done (pushed to origin/main)
- `b813094` feat: `functional.secondaryDominant` (L1, `rules.ts`) plus a drop-3 bass-clash fix in `voicing.ts`. Also adds `docs/research/open-studio-digest.md` and section F of the ideas file.
- `7febda9` feat: `dominant.mediantDominant` (A1, L3, `rulesAdvanced.ts`), the Family's fourth member. Includes a Co-op Blues golden update and regenerated demo Deep Dives.
- Read both commit messages and the "Full digest + F1" entry in `docs/STATE_OF_THE_UNION.md` §5 for details.
- Checks: typecheck clean; tests 229 theory-core + 20 API + 34 web passing. Both rules were checked in the demo build (:4174): Sunny Side bars 5 and 24, and Co-op Blues bar 10. CI for these two commits was not checked.

## Research sources
- `docs/research/open-studio-digest.md`: one digest per PDF (§1–§13) plus an index. Made by Antigravity (Gemini 4 Hydrogen) and reviewed by Claude.
- `docs/research/open-studio-ideas.md`: the build list. Items A–E are from session 4. Section F is the verified, ranked gap list: 7 leads were dropped as already built and 8 real gaps remain. F1 and A1 are marked built.
- The source PDFs are in Itai's Drive folder "openstudio" (Google Drive connector now connected) and in `C:\Users\itail\Downloads`. Staging copies are in `C:\agy-scratch\openstudio`, which can be deleted.

## In progress
Nothing. `docs/HANDOFF.md` (this file) is the only uncommitted file.

## Next 3 steps (Itai picks)
1. **Dominant-colour axis (plain/sus/alt)** across every rule that writes a dominant (secondaryDominant, mediantDominant, tritoneSub, backdoor…). Sus suits a melody on the 4th; alt suits anything except a natural 9 or 13. See A1's sub-bullet in the ideas file.
2. **F2/A3, slash connectors:** V7 over its 3rd, and add2 "mu" chords, as an inversion flag on secondaryDominant and secondaryTwoFive, not a new rule. L2.
3. **F3, voicing styles:** quartal and spread (a LH 10th under a RH triad) in `voicing.ts`. Then F4: inner-voice movers in the band piano. These are the most audible gains for the least code.
- Also open: A2, A4 and A5 (heart melter, walk-up to I/5, going-home endings), the Changes "Family" round, and the CI check.

## Decisions + why
- **secondaryDominant skips the ii of a written ii–V.** Without the guard it turned nearly every Dm7 → G7 into D9 → G7 and took over L1. Now it fires where a chord doesn't point anywhere yet (Sunny Side Am7 → A9 → D7). Itai hasn't heard it yet; dropping the guard is a one-line change if he wants II7–V7.
- **mediantDominant is always ♭9, major targets only, L3.** The ♭9 makes it literally the shared °7 (E7♭9 = E under B°7). The colour axis comes later, across all rules at once.
- **Facts use plain `symbol()`; prose uses the pretty `ps()`.** Some older rules mix these.
- **The digest records concepts only.** The PDFs are © Open Studio (Keezer for §11). No exercises or melodies go into the repo.

## Gotchas
- **Counting firings:** run `npx tsx` on a scratchpad script that imports theory-core by absolute path (`C:/Users/itail/.../src/index.ts`). Relative imports from the scratchpad don't resolve.
- **Antigravity swarm:** with `sandbox: "read-only"` (plan mode), workers stop to ask for plan approval, and long answers come back truncated. What worked: no sandbox, a staging folder holding only the inputs, a shared INSTRUCTIONS.md, and each worker writing its own output file.
- **Demo Deep Dives:** `apps/api/demo/explanations.json` is `source: template`, so `npm run demo:generate -w @reharm/api -- --template` is free and safe. If it's ever regenerated with Claude, ask Itai first (it costs budget).
- **Deep links:** `move=` only opens a move the dial chose. Add `pick=<same id>` to force it in.
- **Voicing tests:** the voicing-style property test is now backed by an exhaustive root × quality × style test, because sampling missed the D♭m7♭5 case.
- **Adding a rule:** bump the rule count in `practice.test.ts`, add the rule to the coverage map in `advancedRules.test.ts` if it's in the advanced pack, and give it a `coach.ts` step cue and concept-drill case.

## Suggested skills
- `mattpocock-skills:tdd` for the colour axis and each new rule (property test first).
- `ship` when Itai says "commit and push".
- `run`, or the built-in browser on `web-demo-build` (:4174, run `npm run build:demo` first), to check moves; read the page with JavaScript.
