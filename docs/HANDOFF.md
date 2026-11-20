# Handoff (2026-11-20, session 14)

## Goal
Itai made "less overload, plainer teaching" the #1 product priority. This session researched it, wrote a phased plan, and built phases 0 and 1.
The plan is `reports/Reharm Lab learning UX plan.md` (Part 3 = per-screen table, Part 4 = phases + tests, end = 12 open decisions). Sources: `research_notes/Reharm Lab learning UX plan/`.

## Done (on `main`, 6 commits ahead of origin, NOT pushed)
- `22ca45a` copy bugs: tritone sub respelling + one chord name, backdoor "no tritone" wording, ii–V into the tonic (keyed on the tune's tonic, not the roman string), gospel turnaround name. Pinned by `packages/theory-core/test/moveCopy.test.ts`.
- `b90e61d` the research notes and the plan report.
- `ebcb8bc` phase 0 finish (Coltrane/US-II names, readable style tags via `styleLabel` in tokens.ts, 17-rule docs) + phase 1 Study:
  - Move cards: headline, Practice, Drill, Also works here; details behind "Why it works".
  - `components/Reveal.tsx` (`Reveal`, `useRevealState`, `reharm.reveal.*`): Chord by chord, Solo over it, rejected list.
  - Study heatmap has no trading or mixer (`trading`/`mixer` props); dismissible lead-sheet tip; demo hides template Deep Dive.
- `cd4400d` Coach: duplicate formula line and footer sentence gone; All keys / Options / When-to-use folded. Theme switch → ⚙ `SettingsMenu.tsx`.
- `ba4c768` transport: band mixer, count-in, loop behind "▾ Band" on all widths; desktop keeps MIDI/QWERTY out.
- `238c604` `usage/panelOpens.ts`: local-only open counts, listed in ⚙ with reset.
- Checks at `238c604`: typecheck clean; tests 314 theory-core + 22 API + 46 web; e2e 7/7 (new first-load test). Verified in the demo build (:4174), desktop and phone width.

## In progress
Nothing. Only this file is uncommitted. Previews `web-demo-build` (:4174) and `api` (:8787) were left running.

## Next 3 steps
1. Itai pushes (6 commits); check CI.
2. Phase 2: `packages/theory-core/src/learn/` (concept graph, glossary, lessons) for the first slice: 4 tritone-sub basics + `basics:twoFiveOne`, and tritoneSub, secondaryDominant, secondaryTwoFive, borrowedIv, backdoorTwoFive. Tests: `learn.graph.test.ts`, `learn.copy.test.ts`, 12-key property test, new PROOF. Plan Part 4 has the spec.
3. Get Itai's calls on the blocking decisions (plan end): #2 rename level labels, #6 explanation depth default, #8 "I know this" test-out, #5 lesson storage.

## Decisions + why
- Folded = unmounted (Reveal). A folded heatmap must not grade or save improv passes. Study now records improv only while "Solo over it" is open.
- The Coach passport's sample-notebook note stays: it labels the seeded demo history (rule 11).
- Desktop keeps Connect MIDI visible: it's how you play, and the MIDI e2e clicks it.
- Disclosure before the wording pass: the queued wording pass goes last (phase 5), so it doesn't polish text phases 1–4 hide.
- Fold states persist per panel in localStorage so panels Itai uses stay open.

## Gotchas
- `apps/web/scripts/og-card.html` still says "11 rules"; editing it needs the OG PNG re-rendered.
- Uppercase CSS changes `innerText`: test text with `textContent`.
- Browser pane tabs can sit on :8787 (the real API); check the tab URL before running page JS.
- Back-to-back synthetic clicks in one script hit stale React closures; await between clicks.
- After rule-text edits: `npm run demo:generate -w @reharm/api -- --template`. After UI edits: `npm run build:demo` before checking :4174.
- No Anthropic key yet (`key MISSING`); Deep Dives won't generate.

## Suggested skills
- `mattpocock-skills:tdd` for phase 2 (graph and copy tests first).
- `mattpocock-skills:codebase-design` for the shape of the `learn/` module.
- `code-review` (high) on `19ddf67..238c604` before or after pushing.
- `ship` when Itai says "commit and push".
