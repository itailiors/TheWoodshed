# PLAN: Reharm Lab learning UX, from gap-close to persona review

**Goal.** Finish the learning-UX plan in `reports/Reharm Lab learning UX plan.md`. Every move is taught as 3–5 atomic steps in the order hear, see on the keys, name, then the rule. Those steps come from one deterministic lesson layer in theory-core, which feeds the move card, the Coach, the Deep Dive prompt and the demo. A prerequisite graph recommends an order but never locks anything. Every screen shows one headline, and everything else is one click away.

**Detailed spec.** UI flows, microcopy, Path tab, glossary chips, hints and fading, all 17 remaining lesson drafts with their `facts.learn` fields, the prompt outline, validator checks, dial labels and open questions are in `docs/plans/learn-ux-spec.md`. This file is the execution order.

---

## How to use this plan

- **One sub-phase per session, one commit per sub-phase.** Don't start the next sub-phase in the same session unless the first was tiny (2g, 2h, 1b). 2g and 2h may share a session but stay separate commits.
- **Definition of done, for every sub-phase:**
  1. `npm run typecheck && npm test` from the repo root, both green. Report the result.
  2. The e2e specs the sub-phase lists (`npm run e2e` builds the demo and runs Playwright against it).
  3. For anything visible: `npm run build:demo`, then `web-demo-build` (:4174). Read state with `textContent`, confirm zero `/api` entries in `performance.getEntriesByType('resource')`, check the mobile preset, reset to desktop.
  4. The sub-phase's safety checks and the **Pre-push check** below.
- **Commit message:** conventional (`feat(learn): …`, `fix(api): …`, `copy(coach): …`), body listing changed files when non-obvious, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Itai pushes.** Sessions commit, never push. Hand back changed files, test results and anything left for Itai.
- **Check before building** (CLAUDE.md §0): grep the repo and `git log` first; build only the gap.
- **Questions go through Gate 0** (below), not per sub-phase. Only the three hard stops block work.

---

## Confirmed state (main at 8d8d832)

| Phase | Commits | What it did |
|---|---|---|
| 0. Copy bugs | 22ca45a | Bugs 1–4, readable style tags, 17-rule docs, demo file via `--template`. Pinned in `moveCopy.test.ts`. |
| 1. Disclosure | ebcb8bc, cd4400d, ba4c768, 238c604 | Collapsed cards; folds for chord-by-chord, "Solo over it", rejected list, Band, Coach keys and Options; one-time Study hint; theme switch in ⚙; demo template Deep Dive hidden; panel-open counters; first-load e2e. |
| 2. `learn/` | 8d8d832 | `graph.ts` (17 rules + 8 basics, `conceptStates`, `nextUp`), `glossary.ts` (27), `lesson.ts`, `facts.ts`, 5 rule + 5 basics lessons, the `lessons-honest` proof (9 PROOFS). |

**Gaps found by the audit:**

1. **Deep Dive cache invalidated by accident.** `facts.learn` rides inside `move.facts` into `buildFacts` (`apps/api/src/explain.ts:69`), so every cached key has missed since 8d8d832. → **2g**.
2. **Stale counts.** "8 claims" in `docs/STATE_OF_THE_UNION.md:59`, `README.md:249`, `apps/web/index.html:42`; `og-card.html` says "11 rules"/"8 claims" (PNG re-render, a hard stop); §1 tree lacks `src/learn/`. → **2g**.
3. **Glossary holes:** category and level labels, Type A/B, Close (rootless), roman numerals, new lesson terms. Graph edges the teacher flagged. → **2h**.
4. **"Next up" points at lessonless nodes** (extensions, dim7, symmetricOctave); no basics for 7th chords or numerals. → **2i**.
5. **Wrong lesson in Coach:** `conceptDrillSteps` always yields the related-ii variant; its fallback (`coach.ts:301`) can return another rule's move. → **2j**.
6. **Phase-1 leftovers:** no ▶ before/after on the card face; ImprovCard at level 1; dial labels. → **1b**. "Mode ▾" is absorbed by the 3d ladder.
7. **Not started:** chips, Path, Learn stage, flags, demo guard, Why-card collapse, prompt rewrite.
8. **Copy-test gaps:** undeclared glossary words aren't scanned; only 4 rules pinned for one name per chord. → **5f**.

---

## Decisions

| # | Decision | Adopted |
|---|---|---|
| 1 | Mastery thresholds | Familiar = lesson finished, 1 clean key or ear/shape evidence; Proficient ≥ 4 keys; Mastered ≥ 8. Revisit at ~100 attempts. |
| 2 | Level-dial labels | **Answered by Itai (2026-11-20).** **L0 Original · L1 Inside · L2 Colour · L3 Bold · L4 Out**, `L0`–`L4` prefix kept. Density moves into the tooltip ("L2 Colour: about 1 move per 4 bars"). Phones keep showing only L0–L4. Lands in 1b. |
| 3 | First-load level | Keep L2. |
| 4 | Demo path states | Ignore the seeded sample: `p.sample ? empty : p`. |
| 5 | Lesson flags storage | **Answered by Itai (2026-11-20).** localStorage `reharm.lessons` as `{v: 1, flags}` in v1, no migration. A server table only once Itai uses the app on two machines. The demo's "Erase runs" also clears lesson and test-out flags (a clean slate, never a half-reset). |
| 6 | Explanation depth | **Answered by Itai (2026-11-20).** Both: the global ⚙ setting overrides adaptive fading per concept ("Just the rule" collapses everything; "Step by step" lets fading decide). Visitors default to "Step by step"; the setting is per browser, so Itai picks "Just the rule" once per machine. Finishing a lesson makes the concept Familiar for the path (next up moves on, prerequisite notes clear), but **fading waits for ≥ 1 clean graded key**, so the steps stay until the move has been played once. |
| 7 | Reader model in the prompt | One reader. No `audience` field. |
| 8 | "I know this" test-out | **Answered by Itai (2026-11-20).** In scope, parked. Built at the M2 review if `prereq.continueAnyway / prereq.view` ≥ 50% or Itai asks. When built: 2 random keys, never the one on screen; listen mode with no hints (MIDI, computer keys or clicks); hidden on touch-first phones (self-check isn't a test); a pass marks the concept and its unmet hard prerequisites Familiar, with Undo; a miss sets the concept to Learning and keeps the run in history like any other. |
| 9 | Secondary dominant → tritone sub | Soft. |
| 10 | Barry Harris sixth-diminished | Out of scope. |
| 11 | Claude-written demo Deep Dives | Hard stop. Only `--template` without Itai's OK. |
| 12 | Where Learn lives | Inside Coach, as a fourth stage. Tab bar stays at five. |
| 13 | dim7 → mediant dominant | Hard (teacher's advice; was Confirm 4). |

---

## Gate 0: one question message, then go

At the start of the first session (before 1b), send Itai **one** message with every item below and its default. **If he hasn't answered when a sub-phase needs it, proceed on the default and note it in the handoff.**

| # | Question | Default | Used in |
|---|---|---|---|
| 1 | Dial words: Inside · Colour · Bold · Out? | **answered: yes** (decision 2) | 1b |
| 2 | Self-check saves runs (first saved rung)? | **answered: yes, as today** | 3d |
| 3 | Finishing a lesson = Familiar? | **answered: yes for the path; fading waits for a clean key** (decision 6) | 3b, 3i |
| 4 | Test-out: listen only, two random keys, hard prerequisites only? | **answered: yes, hidden on touch-first phones** (decision 8) | 3f |
| 5 | Visitor explanation default | **answered: "Step by step"** (decision 6) | 3i |
| 6 | "Recreate it" e2e: keep the label, or change the assertion in 3g? | **answered: keep; change only deliberately** | 3g |
| 7 | Add `basics:sevenths` and `basics:numerals` (optional tier-0)? | **answered: add** | 2i |
| 8 | Common-tone °7 spelled by direction (D♯/F♯)? | **answered: YES, explicit** (2026-11-20): respell and update the affected golden test cleanly | 5c |
| 9 | Demo "Erase runs" also clears `reharm.lessons` and test-out flags? | **answered: yes** (decision 5) | 3b |
| 10 | 5f wording-pass scope: split by screen as listed? | **answered: yes** | 5f |

Also: snapshot Itai's ⚙ usage tally into the handoff as the **baseline** for the success criteria.

**Hard stops, answered by Itai (2026-11-20):**
- Any paid Claude call (the 4d live check, Claude-written demo Deep Dives in 4e): **NO.** `--template` only; validator tested on fixtures with a stubbed client.
- The og-card PNG re-render: **NO.** Leave `og-card.html` and its PNG alone.
- The common-tone °7 respelling: **YES** (Gate 0 item 8).

**Execution (2026-11-20):** Itai approved an autonomous run from 2g through Phase 6 on branch `feat/learn-ux-phases-2-6` (never `main`). One commit per sub-phase after `npm run typecheck && npm test` (plus e2e/a11y at milestones); progress in `PROGRESS.md`. No destructive git; no push. A sub-phase blocked after 2–3 attempts is reverted (its uncommitted changes only), logged in `PROGRESS.md`, and the run stops cleanly. 3f stays parked unless the M2 trigger fires (no counter data exists during an autonomous run, so it is expected to stay parked).

---

## Success criteria

Local counters only (no `/api`), added in 3b through `usage/panelOpens.ts` and shown in the ⚙ tally: `learn.step`, `learn.finish`, `prereq.view`, `prereq.continueAnyway`, `testout.pass`, `testout.undo`, `why.open`.

| Target | Measured by |
|---|---|
| Itai finishes ≥ 3 lessons unprompted in week 1 after M1 | `learn.finish` |
| "Continue anyway" on < 50% of PrereqNote views | `prereq.continueAnyway / prereq.view` |
| "Why it works" open rate up vs the Gate-0 baseline | `why.open` |

Re-read at every milestone. A miss reshapes the next phase; a high `continueAnyway` rate is the trigger to build 3f.

---

## Global safety rules

1. **Itai's database.** The `api` preview (:8787) writes to his real `reharm.sqlite`. No test POSTs. No injected notes on the dev Coach page, Voicings drills, Changes, or Study with "Solo over it" open. Test anything that grades or saves in the demo build (:4174) or a scratch DB per CLAUDE.md §0. Read-only: `curl -s localhost:8787/api/practice/progress`.
2. **Demo makes zero `/api` requests.** `e2e/fixtures.ts:15` fails any test that makes one. Flags, glossary, hints, counters and settings stay client-side.
3. **Grader isolation is a hard requirement.**
   - During Learn the drill is **unmounted**: no `useChordStrikes`, no `useDrillSession` strike path. `useChordStrikes` is gated on `stage === "play"` (and Self-check's hint mode) only, via a pure `modeForStage`.
   - The stepper is its own `useNoteBus` subscriber and never calls `drill.strike`.
   - **ImprovHeatmap is a second saving listener** (`ImprovHeatmap.tsx:515`, saves at `:302`). Stepper asks are disabled while it is mounted, or stepper keys carry a source the heatmap ignores. Structural, with a test.
   - Zero-`/api` is vacuous in the demo (fixtures already fail it, and the demo saves to localStorage via `browserHistory`, `practice.ts:126`). The isolation e2e asserts **the local practice store key is absent or unchanged** after every Learn step, and `progress().sample` is still true.
4. **Rule 11.** Path states never read `demoHistory.json`: `p.sample ? empty : p` in one place, pinned in `demoHistory.test.ts`.
5. **Prompt and cache.** Key = sha256(`PROMPT_VERSION|MODEL|facts`). Anything that changes `buildFacts` output rolls every key: 2g restores; **4a rolls (facts carry `draft: move.text`, `explain.ts:71`)**, 4c rolls; 4d bumps `PROMPT_VERSION`. No Anthropic key is configured yet, so a roll costs nothing today: pushes are never held for it. Once a key exists, ship facts and prompt changes together so keys roll once. Model, effort, betas, fallbacks and `cache_control` stay per CLAUDE.md §2 rule 2.
6. **No paid calls** without Itai's explicit OK. Demo Deep Dives: `--template` only.
7. **Lessons never compute notes.** Templates read only `move.facts.learn` (or `transpose()`/`guideTones()` for basics); missing values go into the rule's `*Learn` block. Rule 7 (traces are the engine) holds: lesson-derived text is assembled in `engine.ts` `buildMove`, inside the traced path, importing only the barrel-free `learn/ruleLesson.ts`. **Never import `learn/index` from `engine.ts` or `ruleKit.ts`** (cycle: graph → concepts → ruleset → rules → ruleKit).
8. **Gotchas:** StrictMode runs effects twice (write flags in handlers or behind `live`). HMR crashes a drawer when an edit uses a `learn/` export before it exists: reload first. Hidden pane: override rAF, `Tone.getDraw().cancel(0)`. Live notes use `Tone.immediate()`; production console clean.

### Pre-push check (every visible sub-phase keeps it green)

- `npm run e2e`.
- `golden.spec` asserts the move-card headline and a ▶ button are inside the first viewport, with zero console errors.
- **Demo-safe main between commits:** a rule without a lesson renders today's body, with no empty Learn stage or stepper (e2e in 3d and 3g).

---

## Sub-phases

Each entry: **Goal · Files · Tests · Verify · Safety · Size/risk · Depends on · Commit.** 3a is merged into 1b; 5e into 3i.

### Phase 2 gap-close

#### 2g. Stop sending `facts.learn` to Claude; fix stale counts (FIRST)
- **Goal:** destructure the top-level `learn` key off the facts before the reviver at `explain.ts:69`. 8d8d832 only appended `learn` and the chain refactor is output-identical, so this restores the old keys. Fix stale counts.
- **Files:** `apps/api/src/explain.ts`; new `apps/api/test/explain.test.ts`; `docs/STATE_OF_THE_UNION.md` (9 proofs; `src/learn/` in §1); `README.md`; `apps/web/index.html`.
- **Tests:** `buildFacts` for the reference tritone sub has no `learn` key and its JSON has no `"learn"`; **pin a sha256 of that `buildFacts` output** (4a re-pins it deliberately). Keep green: `api.test.ts` demo tests.
- **Verify:** typecheck + test. **Safety:** no Claude call; don't touch `og-card.html` (hard stop). **Size/risk:** S, low. **Depends on:** nothing.
- **Commit:** `fix(api): keep facts.learn out of explain facts so Deep Dive cache keys hold; 9 proofs in docs`

#### 2h. Glossary, graph edges and `prereqSummary`
- **Goal:** the glossary covers every label and term the UI shows; the teacher's graph edges; soft-lock notes can say "This builds on guide tones (3 steps)".
- **Files:** `learn/glossary.ts` (`kind?: "term" | "category" | "level"`; 8 category labels from `tokens.ts:48`; `L1`–`L4`; Type A/B; Close (rootless); spec §D terms; **roman-numeral entries V, ♭II, ii, ♭VII7, iv**); `learn/graph.ts` (**mediantDominant hard-needs `basics:dim7`, tritoneSub becomes soft, backdoor stays soft; flatSixFlatSeven gains soft `backdoorTwoFive`; gospel.halfStepTurnaround gains hard `basics:extensions` and soft `voicing.upperStructureII`**); `learn/index.ts` (`prereqSummary(conceptId, key)`).
- **Tests:** `learn.copy.test.ts`: glosses ≤ 8 words; every category and level has an entry; `prereqSummary` counts > 0. `learn.graph.test.ts`: the new edges; update the exact `nextUp` list if it moves. Keep green: `concepts.test.ts`, `proofs.test.ts`.
- **Verify:** typecheck + test. **Safety:** pure theory-core. **Size/risk:** S, low. **Depends on:** nothing.
- **Commit:** `feat(learn): glossary covers labels and numerals; teacher's prerequisite edges; prereq summaries`

#### 2i. Five basics lessons and shipped-copy fixes
- **Goal:** every node `nextUp()` can return has a lesson. Add `basics:extensions`, `basics:dim7`, `basics:symmetricOctave`, and (Gate 0 item 7) `basics:sevenths` and `basics:numerals` as optional tier-0 nodes: guideTones hard-needs sevenths; numerals is soft for tritoneSub, backdoor, flatSixFlatSeven and secondaryDominant. Shipped-copy fixes: guide-tones step 2 ("B, the 3rd, makes G7 major. F, not F♯, makes it a dominant 7th: F♯ would make Gmaj7."), borrowedIv step 4 ("bittersweet, a softer landing than V–I"), and a play cue on step 1 of every shipped lesson. Link the numeral glossary entries to `basics:numerals`.
- **Files:** `learn/lesson.ts` (`DEGREE_WORD` gains sus 4th, ♯11, ♯9, 11th, ♭5; optional `sound?: string[][]`; no "a/an" before a note name); `learn/lessons/basics.ts`, `learn/lessons/rules.ts`; `learn/graph.ts`; `learn/glossary.ts`.
- **Tests:** `learn.copy.test.ts`: `BASICS` to all 10; flip the dim7 null assertion; **every lesson's step 1 has a play cue**; 12-key properties (dim7 = four minor 3rds, no double accidentals; major-3rd cycle = 4 semitones; tensions equal `transpose()`; sevenths' 3rd/7th equal `transpose()`). Every node `nextUp()` can return has a lesson. Re-pin any test that pins borrowedIv or guide-tones copy. Keep green: `lessons-honest`, `learn.graph.test.ts`.
- **Verify:** typecheck + test. **Safety:** pure theory-core. **Size/risk:** M, low. **Depends on:** 2h.
- **Commit:** `feat(learn): basics lessons for 7th chords, numerals, extensions, the diminished 7th and major-3rd cycles`

#### 2j. `canonicalMove` / `canonicalLesson(ruleId, tonic)`
- **Goal:** Coach's Learn stage gets the right lesson for a rule in any key, never another rule's.
- **Files:** new `learn/canonical.ts`, the **single table** of canonical progressions (the switch moves here from `coach.ts:254-283`). `canonicalMove = generateMoves(canonicalTune, [rule]).accepted.find(m => m.ruleId === ruleId) ?? null`, never a direct `rule.propose()`; `canonicalLesson` wraps it. New barrel-free `learn/ruleLesson.ts` (`lessonForMove`, `tidyLesson`, moved out of `learn/index.ts`, which re-exports them; imports only `lessons/rules` and `lesson.ts`). `coach.ts`: `conceptDrillSteps` calls `canonical.ts`. `canonical.ts` stays **out of the `learn/index` barrel** (export it from the package root).
- **Tests:** new `learn.canonical.test.ts`: every rule in 12 keys yields its own `ruleId` or `null`; secondaryTwoFive gives the full ii–V; `canonicalLesson` non-null for every lessoned rule. One cheap case in `lessons-honest` (time `numRuns: 150`). Keep green: `practice.test.ts`, `drillSession.test.ts`, `drillKeys.test.ts`.
- **Verify:** typecheck + test. **Safety:** drill content changes for some rules; history keys don't. **Size/risk:** M, medium. **Depends on:** 2i.
- **Commit:** `feat(learn): canonical progressions in one table; Coach never falls back to another rule's move`

### 1b. Phase-1 leftovers and the dial labels
- **Goal:** ▶ Before / After on the collapsed card face; ImprovCard behind "Solo over it"; dial labels L0 Original · L1 Inside · L2 Colour · L3 Bold · L4 Out, with the density in the tooltip, e.g. `L2 Colour: about 1 move per 4 bars`; phones show L0–L4 only (decision 2, answered).
- **Files:** `MoveCard.tsx` (face `:53-86`, existing audition calls); `App.tsx` (`:870-879`, `:917-921`); `design/tokens.ts` (`:79-82`); `LevelDial.tsx` (`:58,64`); copy found by grepping `Bebop|Gospel|Modern|Functional` (leave category words); level glossary display words; `STATE_OF_THE_UNION.md`; `e2e/golden.spec.ts`.
- **Tests:** e2e: card face has Before and After; no ImprovCard content until "Solo over it"; radios `/^L0\b/`…`/^L4\b/` and "Level 0 shows the tune as written." green; add the Pre-push headline/▶-in-first-viewport assertion.
- **Verify:** demo preview, desktop and phone (dial words hidden below `sm`). **Safety:** Study only. **Size/risk:** S, low. **Depends on:** 2h (level entries); otherwise parallel.
- **Commit:** `feat(study): before/after on the card face, scale card behind Solo over it, dial named by adventurousness`

### Phase 3. Study steps first, then Coach Learn and the Path

#### 3b. Lesson flags, path states, counters
- **Goal:** `reharm.lessons` and one hook turning the player's own progress plus flags into `conceptStates`/`nextUp`; the success-criteria counters.
- **Files:** `learn/graph.ts` (`LessonFlag` gains `testedOutAt`, `testedOutVia`, `relearn`, `lastStage`, `continuedAnyway`); new `apps/web/src/learn/lessonFlags.ts` (stores `{v: 1, flags}`; validates entries; ignores an unknown `v`; try/catch; subscribe); `learn/pathStates.ts` (`ownProgressOnly`); `learn/usePathStates.ts` (`live` flag; reruns on `onPracticeSaved` and flags); `usage/panelOpens.ts` (the seven counters); `library/practice.ts` (demo "Erase runs", `:129`, also clears `reharm.lessons` and test-out flags, per decision 5). Finishing a lesson (`finishedAt`) makes the concept Familiar in `conceptStates`, as `graph.ts` does now (decision 6).
- **Tests:** `pathStates.test.ts` (sample yields nothing above Recommended first; one own run → Familiar; throwing storage; unknown `v` ignored; malformed entry dropped). Extend `demoHistory.test.ts` and `learn.graph.test.ts`; Erase-runs clears flags. Keep green: `historyBrowser.test.ts`.
- **Verify:** typecheck + test. **Safety:** local only. **Size/risk:** M, medium (rule 11). **Depends on:** 2j.
- **Commit:** `feat(learn): versioned lesson flags, path states from own runs, local learning counters`

#### 3c. `components/learn/` primitives
- **Goal:** `LessonStepper` (one step per screen, ≤ 4 labelled keys, ▶ Hear, ‹ Back / Next ›, predict-then-reveal through `noteBus`, keys per spec §A, step 1's cue plays once on open), `PrereqNote`, `GlossaryChip`, with the spec §A a11y contract.
- **Files:** new `components/learn/` `LessonStepper.tsx`, `PrereqNote.tsx`, `GlossaryChip.tsx`, `lessonAudio.ts` (Tone-free), `useTapAnswer.ts`; keyboard from `practice/PenKeyboard.tsx`, emitting through `noteBus` with a guaranteed note-off; `Shortcuts.tsx` (`COACH_LEARN_SHORTCUTS`, `?` on Coach; no footer legend). Popovers and sheets handle Esc in the **capture phase with `stopImmediatePropagation`** (as `Shortcuts.tsx:75`), so `CoachPage.tsx:117`'s Esc-to-Study doesn't fire. `playwright.config.ts`: a `mobile` project (Pixel 5) for learn/path specs; `@axe-core/playwright` (**new devDependency**).
- **Tests:** `useTapAnswer.test.ts` (E vs F♭ accepted; wrong key not counted; struck chord answers at once); Enter twice on an ask (focus "Show me", then reveal); Space/Enter ignored on a focused button. A small story-style e2e mount if cheap; else the a11y/keyboard e2e lands in 3g.
- **Verify:** typecheck + test. Lazy-load the folder. **Safety:** imports nothing from `CoachDrill` or grading. **Size/risk:** M/L, medium. **Depends on:** 2h, 3b.
- **Commit:** `feat(learn): LessonStepper, PrereqNote and GlossaryChip, keyboard and screen-reader ready`

#### 3g. Study: "Why it works" steps through the lesson
- **Goal:** for moves with a lesson, the card's level-2 body is the inline stepper. **"Go deeper" is a plain section on the last step** (melody check, voice-leading grid, insight, Deep Dive button), not a fold. Moves without a lesson keep today's body, with no empty stepper.
- **Files:** `MoveCard.tsx` (`:119-166`), `LessonStepper.tsx` (inline variant), `ImprovHeatmap.tsx` (the saving-listener guard, safety rule 3), `e2e/golden.spec.ts`, new `e2e/learn.spec.ts`.
- **Tests:** e2e: "Step 1 of N"; "Recreate it" per Gate 0 item 6; a lessonless move renders today's body; **fails if any element has ≥ 3 `aria-expanded` ancestors**; keyboard-only run through every step and ask; axe scan; mobile project. Unit: stepper keys never reach the heatmap's save path.
- **Verify:** demo preview, desktop and phone. **Safety:** ungraded; heatmap guard. **Size/risk:** M, medium. **Depends on:** 3c.
- **Commit:** `feat(study): Why it works steps through the lesson inline`

#### 3i. Explanations setting and adaptive fading (was 3i + 5e)
- **Goal:** ⚙ "Explanations: Step by step · Just the rule" (`reharm.explain`). "Just the rule" collapses steppers to headline + rule + ▶ Before/After + "Step by step ›"; prerequisite notes still show as one line. The setting overrides fading (decision 6). Adaptive, in "Step by step": a concept opens collapsed only once it has **≥ 1 clean graded key** (a finished lesson alone keeps the steps open); a latest graded run ≤ 2 reopens the steps once; never from the seeded sample. Visitors default to "Step by step"; stored per browser.
- **Files:** `SettingsMenu.tsx`; new `learn/explainDepth.ts` (pure `depthFor(setting, cleanKeys, latestRun)`); `LessonStepper.tsx`, `MoveCard.tsx`.
- **Tests:** `depthFor` table (finished lesson with 0 clean keys stays open; 1 clean key folds; "Just the rule" always folds; a grade ≤ 2 reopens once); storage fallback; demo guard re-asserted; e2e: the toggle collapses the Study stepper.
- **Verify:** demo preview. **Size/risk:** S/M, low. **Depends on:** 3b (path states), 3c, 3g.
- **Commit:** `feat(settings): explanations step by step or just the rule, fading once a concept is familiar`

> **Milestone 1: Study card steps inline.** Itai reviews the demo. Then a **mini persona checkpoint**: UI/UX, PM and beginner checklists (Phase 6) run on the 10 shipped lessons in the demo build; fixes before 3d. Read the counters.

#### 3d. Coach stage ladder: Learn → Study it → Self-check → Play it
- **Goal:** spec §A–B. The ladder replaces `GradingSwitch`; unlearned concepts open on Learn, Familiar+ on Play it; PrereqNote with the return banner folded into the stepper header; the Why card collapses to formula + headline + rule; basics get Learn plus an evidence link. **A fresh demo opens Coach on `nextUp()[0]`** (a foundation, no PrereqNote).
- **Files:** `CoachPage.tsx`; `CoachDrill.tsx` (Why card `:539-612`); new `coach/LearnStage.tsx` (stepper **instead of** the drill; `canonicalLesson` for concept drills, `lessonForMove(dmove)` for a tune move); `coach/gradingMode.ts`: pure **`modeForStage(stage, midi)`** (learn → drill unmounted, study → "study", self → "self", play → "listen"), `useChordStrikes` gated on `stage === "play"` (plus Self-check's hint mode); **retire `reharm.coachGrading`** (`gradingMode.ts:26,52`) into `lastStage` (one source of truth; note `useGradingMode` forces "listen" when MIDI connects today).
- **Tests:** `modeForStage` unit table. e2e (demo): first Coach view shows "Step 1 of" and **no** PrereqNote; separately, the tritone sub shows the PrereqNote, "Continue anyway" opens step 1, the last step lands on Study it; a lessonless rule shows no empty Learn stage; **Esc on an open chip stays on Coach**; one routing line at a time. **Isolation e2e:** notes through every Learn step → local practice store key unchanged, `progress().sample` true, passport says "Sample notebook". Axe on Learn and an open chip; mobile project.
- **Verify:** demo preview, desktop and phone. Dev `web` only in Study mode. **Safety:** structural isolation; never the dev Coach page against :8787. **Size/risk:** L, high. **Depends on:** 3b, 3c, 3g, 3i, 2j.
- **Commit:** `feat(coach): Learn stage and stage ladder before Study it, Self-check and Play it`

#### 3e. Path tab and the Coach "Your path" rail
- **Goal:** passport "Path" tab (tier bands, state chips, prerequisites on hover/focus, 2–4 next up) and the Coach rail ("Next up", then "All concepts ▾"), per spec §B–C.
- **Files:** `progress/PracticeDashboard.tsx` (tablist, `EngineXRay.tsx` pattern); new `learn/PathView.tsx` (lazy); `CoachPage.tsx` rail (`:189-335`); `panelOpens.ts` (`passport.path`); deep link `#coach/<conceptId>`.
- **Tests:** e2e (demo): Path lists the tritone as next up and the tritone sub as Recommended first, not Proficient despite the sample; clicking a card opens Coach on it; axe on Path; mobile project.
- **Verify:** demo preview, phone. **Safety:** rule 11; "The sample notebook isn't counted." **Size/risk:** M, medium. **Depends on:** 3d (same `CoachPage.tsx`).
- **Commit:** `feat(progress): Path tab and Coach "Your path" rail from concept states`

> **Milestone 2: Coach Learn + Path.** Itai reviews; read the counters; build 3f if `prereq.continueAnyway / prereq.view` ≥ 50% or Itai asks.

#### 3f. "Skip ahead: I know this (2-key test)" (data-driven, off the critical path)
- **Goal:** spec §B, decision 8 (answered). **Build trigger:** at the M2 review, `prereq.continueAnyway / prereq.view` ≥ 50%, or Itai asks; otherwise it stays parked. Format: 2 random keys, never the key on screen; listen mode, no hints (MIDI, computer keys or clicks); **hidden on touch-first phones** (`autoMode`'s touch check) and while the concept is New and the player has no runs at all. Pass → `testedOutAt` on the concept and its unmet hard prerequisites, with Undo; a miss → Learning, and the run stays in history like any other; "Relearn this" in ⋯.
- **Files:** `LearnStage.tsx`, `CoachDrill.tsx` (`testOut` prop, injectable keys), `lessonFlags.ts` (`markTestedOut`, `undoTestOut`, `relearn`), `PathView.tsx`.
- **Tests:** flag helpers (Undo removes exactly what was set); e2e (demo) with fake MIDI in two injected keys → Familiar; a miss → Learning; the saved runs land only in the local store (assert the key, not `/api`).
- **Verify:** demo build or a scratch DB only. **Safety:** the one Learn feature that saves runs. **Size/risk:** M, high. **Depends on:** M2.
- **Commit:** `feat(coach): two-key test-out marks a concept and its prerequisites Familiar`

#### 3h. Glossary chips, symbol decoder and first-run hints
- **Goal:** spec §D: chips replace teaching `title` tooltips; a **chord-symbol decoder chip** explains suffixes (7(♭9), m7♭5, maj7, 13(♯11), slash chords) from theory-core's symbol parts, not hand text; one dismissible hint per screen; the Changes "Learn the tritone sub →" link.
- **Files:** new `packages/theory-core/src/learn/decoder.ts` (`decodeSymbol` from the `ChordShape` fields `symbol()` prints, `chords.ts:84`); `ChordMoveSelector.tsx`, `voicings/VoicingsPage.tsx`, `practice/PracticeMode.tsx`, `ChordHUD.tsx`, `ImprovHeatmap.tsx`, `changes/GamePieces.tsx`, new `components/learn/FirstRunHint.tsx` (`useRevealState`).
- **Tests:** unit: every chip term resolves; `decodeSymbol` round-trips every suffix the rules emit, in 12 keys. e2e: a chip opens a popover with "Learn it"; Esc stays on screen. Keep green: `ears.motions.test.ts`.
- **Verify:** demo preview, mobile. **Size/risk:** M, low/medium. **Depends on:** 3c. **Parallel:** with 3g–3e.
- **Commit:** `feat(learn): glossary chips, chord-symbol decoder and one-time hints`

### Phase 4. One lesson source and the prompt

#### 4a. `MoveText` derived from lessons
- **Goal:** for lessoned rules, `summary = headline`, `recreateRule = rule`, `theory = steps joined`, `insight = deeper`, assembled in **`engine.ts` `buildMove`** (`:130`, the one place a proposal becomes a move, inside the traced path) via `learn/ruleLesson.ts`.
- **Files:** `engine.ts`; `rules.ts`, `rulesAdvanced.ts` (delete dead hand text); `types.ts`; `apps/api/demo/explanations.json` via `--template`; the 2g test.
- **Tests:** re-pin `moveCopy.test.ts` deliberately (one-symbol and respelling claims kept); golden titles and rejection regexes; copy budgets cover `move.text`; `trace-honest`, `lessons-honest`; **re-pin 2g's `buildFacts` sha256 deliberately** (facts carry `draft: move.text`, `explain.ts:71`); `api.test.ts` demo coverage.
- **Verify:** typecheck + test + e2e; card headline equals lesson headline. **Safety:** `--template` only; keys roll (safety rule 5). **Size/risk:** M, high. **Depends on:** phase 2 gap-close. **Parallel:** with phase 3 UI.
- **Commit:** `refactor(theory-core): derive MoveText from lessons in buildMove`

#### 4b. Step cues from lesson facts
- **Goal:** `buildStepCue`'s `whyHere` uses `facts.learn`; the six generic-cue rules get real ones; ≤ 25 words.
- **Files:** `coach.ts` (`:32-169`); optional `learn/cueFacts.ts`.
- **Tests:** `practice.test.ts`: no generic cue, word cap; 12-key property: notes in `whyHere` belong to the step's target.
- **Size/risk:** M, medium. **Depends on:** 2j. **Parallel:** with phase 3 and 4a.
- **Commit:** `feat(coach): step cues speak the lesson's facts`

#### 4c. `buildFacts` carries the lesson as prose
- **Goal:** add `lesson: {headline, steps, rule}`, `pedagogy`, `prereqs` (names), `glossary` (terms used). Raw `learn` stays out.
- **Files:** `explain.ts`; the 2g test file.
- **Tests:** reference tritone sub facts contain the rule and ≥ 1 glossary entry, no `undefined`, no `learn`; template fallback green.
- **Safety:** keys roll (free while no key is configured; see the push rule). **Size/risk:** S/M, medium. **Depends on:** 4a.
- **Commit:** `feat(api): explain facts carry the lesson, pedagogy, prerequisites and glossary`

#### Deep Dive track (off the critical path): 4d, 4e
Deep Dive is hidden in the demo and live calls need Itai's OK, so phase 5 doesn't wait for these.

**4d. Prompt rewrite and output validator** *(hard stop before any live call)*
- **Goal:** spec §F prompt, one `PROMPT_VERSION` bump covering 4a + 4c, the 8-check validator. Retry at most once; on a second failure serve the template uncached; a **negative cache** (memory, keyed by cache key, TTL) skips moves that failed validation twice; dev-only logging.
- **Files:** `prompt.ts`; new `validateExplain.ts`; `explain.ts`; banned-phrase regex exported from theory-core.
- **Tests:** `validateExplain.test.ts` (one fixture per check); a stubbed client proves exactly one retry; the negative cache skips the call within TTL and expires after it. No network.
- **Verify:** typecheck + test; a live call only with Itai's OK, one move, scratch DB. **Size/risk:** M, high. **Depends on:** 4c.
- **Commit:** `feat(api): explain prompt for a strong non-specialist reader, with validator and negative cache`

**4e. Regenerate the demo file**
- **Goal:** `npm run demo:generate -w @reharm/api -- --template`; `demo.ts` no longer repeats the steps; template Deep Dive stays hidden. Claude-written demo Deep Dives: separate commit, hard stop.
- **Tests:** `api.test.ts` fallback and coverage; e2e. **Size/risk:** S, low. **Depends on:** 4d.
- **Commit:** `chore(demo): regenerate template explanations from lessons`

> **Milestone 3: one lesson source** (after 4e; after 4c if the Deep Dive track waits on Itai). Read the counters.

### Phase 5. The other 12 rules and wording

Each lesson sub-phase: `*Learn` interface in `learn/facts.ts`, populated in `propose()`; lesson per spec §E in `RULE_LESSONS`; grow `SLICE`; 12-key properties; `lessons-honest` covers the rule; re-pin `moveCopy.test.ts` where text changes; demo file via `--template`. Keep green: `rules.property.test.ts`, `advancedRules.test.ts`, golden tests, `practice.test.ts`.

#### 5a. Engine helpers the lessons need
- **Goal:** helpers with tests: (1) `planeMotion(from, to)` in `ruleKit.ts`, positional motion for planing and grips; fix constant structure's `voiceLeading` grid (D♭maj7's C wrongly holds). (2) Tidied dim tones for descending passing °7s (E♭ G♭ A C) and **direction spelling for the common-tone °7** (`transpose(root, "#2" | "#4")`, simplified where a double sharp results; behind the hard stop). (3) `symbol()` check for line-cliché stops. (4) Collapse hold runs in a `VoicePath`. (5) Degree codes in `rulesOneNote.ts` `roles`.
- **Tests:** unit and 12-key properties; planed slides all −1; no double accidentals shown.
- **Size/risk:** M, medium (grid change visible). **Depends on:** 4a.
- **Commit:** `feat(theory-core): positional voice motion, diminished spelling and voice-path helpers`

#### 5b. Coltrane, constant structure, one note on top
- Coltrane key-centre map first (may add `map?: string[]`); one note on top splits 3-chord walks across steps 3–4. Refit 4b cues.
- **Size/risk:** L, medium. **Depends on:** 5a, 2i.
- **Commit:** `feat(learn): Coltrane, constant structure and one-note-on-top lessons`

#### 5c. Diminished and chromatic moves
- Mediant dominant, passing diminished (up/down), common-tone diminished (**hard stop**: D♯/F♯ changes golden tests), gospel half-step turnaround, minor line cliché.
- **Size/risk:** M, medium. **Depends on:** 5a. **Parallel:** with 5b, 5d.
- **Commit:** `feat(learn): lessons for the diminished and chromatic moves`

#### 5d. Voicing and borrowed-chord moves
- Rootless ii–V–I, upper structure ♭VI, upper structure II, ♭VI–♭VII.
- **Size/risk:** M, medium. **Depends on:** 5a. **Parallel:** with 5b, 5c (never two sessions in `rulesAdvanced.ts`).
- **Commit:** `feat(learn): voicing and borrowed-chord lessons`
- **After 5b–5d:** a test asserts all 17 rules and 10 basics have lessons.

#### 5f. App-wide wording pass (Gate 0 item 10)
- **Goal:** the Part 1 style guide over everything still visible: `pedagogy.whyItWorks` ≤ 25 words, `FUNCTION_WORD`, scale `why`, leftover hype, Coach/Practice/Voicings copy. One-name-per-chord sweep for all 17 rules; scan step text for undeclared glossary words. og-card only with Itai's OK.
- **Tests:** `npm run e2e`, assertions updated and listed in each commit; `ears.motions` and golden rejection regexes kept; `concepts.test.ts`.
- **Size/risk:** L, high e2e churn. Split: `copy(coach)`, `copy(study)`, `copy(voicings,practice)`. **Depends on:** 5b–5d, 3h.

> **Milestone 4: end of phase 5.** Read the counters against the targets.

### Phase 6. Five-persona review and polish

- **Setup:** `npm run build:demo`, :4174, desktop and phone, light and dark; fresh state (clear `reharm.*`) and returning state (demo-saved runs, one test-out if 3f shipped).
- **Reviewers:** five fresh sessions, one per persona; findings with screen, severity (blocker / should / nice) and fix.

| Persona | Checklist | Pass when |
|---|---|---|
| UI/UX designer | ≤ 2 disclosure levels (`aria-expanded` e2e); ≤ 4 lit keys; house idioms; 44 px targets (black keys too); one docked phone block; one routing line; axe clean; keyboard-only path; dark contrast | No blocker; no third level |
| Product manager | Headline and ▶ in the first viewport; "Next up" obvious; nothing seeded reads as real; success criteria read | First load to finished lesson in ≤ 3 *decisions* (revised at P6, see note) |

**Note (P6 fixes, measured in the demo build):** "≤ 3 clicks" isn't reachable without cutting lesson steps, so the criterion counts decisions (open a lesson, answer its ask, finish), not presses of Next. Measured clicks: **Coach 5** (Coach tab, Next ×3, then one "Next up: The tritone ›" that both finishes 7th chords and opens the next lesson; was 5 plus 2 more to move on), **Study 6** (Why it works, Next ×4, Done on the 5-step ii–V lesson). Each lesson is 3–5 steps by design (spec §A, one idea per step); merging steps or auto-advancing on Next would trade the one-idea-per-screen rule for a click count. `learn.finish` still counts only a lesson walked to its last step and finished.
| Beginner pianist (3–4 months) | `basics:sevenths` → `basics:tritone` → tritone sub with on-screen keys or QWERTY; every term chipped; symbol decoder; "Recommended first" never a wall | Finishes all three unaided |
| Jazz piano teacher | Spelling (F♭, C♭, sharps that rise, no double accidentals shown); idiomatic voicings; defensible edges; any key | No wrong claim in 27 lessons |
| Senior engineer | CLAUDE.md §2 rules 1, 2, 7, 11–14; lessons read only `facts.learn`; no grader in Learn; heatmap guard; no `learn/index` cycle; StrictMode-safe; no leaked listeners; lazy chunks; bundle delta | All rules hold; local store unchanged by Learn; no leaks |

- **Fixes:** one small commit each, `fix(learn): persona review, <what>`.
- **Re-verify:** typecheck, test, e2e, demo zero-`/api`, the real DB's `sha256sum` unchanged since phase 3 began. Then `/handoff`.

### Phase 7. Harmony Catcher

The spec and slices 7a–7f are in [`docs/plans/harmony-catcher.md`](docs/plans/harmony-catcher.md) (decided 2026-11-23).

---

## Dependency graph, milestones and parallel sessions

**Critical path:** 2g → 2h → 2i → 2j → 3b → 3c → 3g → 3i → 3d → 3e → 4a → 5a → 5b → 5f → 6.

**Off the path:** 1b (after 2h); 3h (after 3c); 3f (after M2, data-driven); 4b (after 2j); Deep Dive track 4c → 4d → 4e (after 4a); 5c, 5d (after 5a).

**Parallel-safe:** 2g, 2h, 1b touch different files. 4a and 4b run beside phase 3 UI. 3h beside 3g–3e. 3d and 3e both edit `CoachPage.tsx`: in sequence. 5b, 5c, 5d after 5a, never two sessions in `rulesAdvanced.ts` or `golden.spec.ts`.

**Push rule:** none needed while no Anthropic key is configured (a key roll costs nothing). If a key is added before 4d lands, push 4a, 4c and 4d together under one `PROMPT_VERSION` bump.

**Gates:** Gate 0 (one message, defaults if unanswered). Hard stops: paid calls (4d live check, 4e Claude-written), og-card PNG, common-tone respelling (5c).

**Milestones:** M1 after 3g/3i (+ mini persona checkpoint), M2 after 3e, M3 after 4e, M4 end of phase 5. Counters re-read at each.

---

## Risk register

| # | Risk | Mitigation |
|---|---|---|
| 1 | Learn or test-out notes reach a grader and a saved run | Drill unmounted in Learn; `modeForStage` table; heatmap guard; isolation e2e on the local store key and `sample`; demo or scratch DB; checksum across phase 3 |
| 2 | Seeded history shown as real (rule 11) | One `ownProgressOnly`; `demoHistory.test.ts`; Path e2e |
| 3 | Cache keys roll by accident or more than once | 2g sha256 pin; 4a re-pins deliberately; free while no key is configured, otherwise 4a + 4c + 4d pushed together under one bump |
| 4 | Import cycle via `learn/index`; golden/`moveCopy` churn | Text assembled in `buildMove` from barrel-free `ruleLesson.ts`; `canonical.ts` off the barrel; re-pin deliberately |
| 5 | Validator too strict: retries, cost | One retry; uncached template fallback; negative cache with TTL; fixtures |
| 6 | e2e text churn (3g, 3h, 5f) | Each commit updates and lists its assertions |
| 7 | Wrong variant or another rule's lesson | 2j single table via `generateMoves`, shared with the drill |
| 8 | `lessons-honest` slows CI and the Proof tab | Time `proofs.test.ts` after 2j and each phase-5 step |
| 9 | Esc in a popover also leaves Coach | Capture-phase Esc with `stopImmediatePropagation`; e2e |
| 10 | main breaks the demo between commits | Pre-push check; lessonless rules render today's body |
| 11 | Two grading-mode stores disagree | Retire `reharm.coachGrading` into `lastStage` (3d) |
| 12 | Flag storage drifts | `{v: 1}` envelope, validation, unknown `v` ignored |

---

## Persona panel (pass 1): what changed

**Product manager:** Study stepper (3g) and explanations (3i) before the Coach ladder, with four milestones · one Gate 0 message with defaults, three hard stops · fresh Coach opens on `nextUp()[0]` · success criteria and local counters, baseline at Gate 0 · mini persona checkpoint at M1 · test-out (3f) after M2, data-driven, relabelled and hidden for brand-new players · 3a → 1b, 5e → 3i, 4d/4e off the path · Pre-push check and demo-safe main.

**Beginner pianist:** `basics:sevenths` and `basics:numerals` (2i, Gate 0) · numeral glossary entries and a chord-symbol decoder chip (2h, 3h) · step 1 always has a play cue, played on open · extensions step 2 split · guide-tones step 2 rewrite; "V (F's five chord)" only via the numeral chip.

**UI/UX designer:** "Go deeper" a plain last-step section plus an `aria-expanded` depth e2e · capture-phase Esc · Enter focuses then reveals "Show me" · a11y contract · Pixel 5 project, axe, keyboard-only e2e in 3c–3d · one docked phone block · one routing line at a time · `?` shortcuts sheet and no-input ask copy.

**Senior engineer:** text assembled in `buildMove` via barrel-free `ruleLesson.ts` · `canonicalMove` through `generateMoves`, one table in `canonical.ts` · `modeForStage`, `reharm.coachGrading` retired · isolation e2e on the local store, not `/api` · ImprovHeatmap guard · 4a rolls keys and re-pins 2g · 2g by destructuring, sha256 pin, no worktree · negative cache in 4d · versioned flags; Erase runs clears flags.

**Jazz piano teacher:** Coltrane's single descending voice · gospel resolves to Cmaj13 with a D♭–C♭–F + E♭-triad grip · rootless grips A/B and Cmaj9 · extensions "raise it or go sus" · symmetric-octave spelling line · dim7 "three different" · borrowedIv "bittersweet" · oneNoteOnTop "suggests", line cliché "inside or in the bass" · graph edges (dim7 hard for mediant, so old Confirm 4 is resolved) · common-tone °7 spelled D♯/F♯ by default, behind a hard stop.

**Declined:**
- Beginner's "E (written F♭)" reversal: style rule 5 (engine spelling first, twin in parentheses) stays; the chip explains respelling.
- PM's "merge 2g + 2h": different packages and risk profiles; they may share a session but stay separate commits.
