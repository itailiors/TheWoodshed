# Learn UX spec: flows, microcopy and lesson drafts

The durable detail behind `PLAN.md`. It covers the Coach stage ladder (A), soft lock, test-out and Next up (B), the Path tab (C), glossary chips, the symbol decoder, hints and fading (D), the 17 remaining lesson drafts with their `facts.learn` fields (E), the `/api/explain` rewrite and dial labels (F), and open questions (G).

Sources: `reports/Reharm Lab learning UX plan.md` (Parts 1–4, 12 decisions), the phase 2 code in `packages/theory-core/src/learn/` (8d8d832), the rules in `rules.ts`, `rulesAdvanced.ts` and `rulesOneNote.ts`, `CoachDrill.tsx`, `LevelDial.tsx`, `tokens.ts`, `apps/api/src/prompt.ts`, and the persona panel's pass 1. It adopts the defaults in `PLAN.md` "Gate 0" unless Itai answers otherwise.

**Two facts from the code shape this spec.**
1. Coach already has three grading modes (`CoachDrill.tsx:704-710`): 🎹 Play it here (listen), ✋ Self-check and 📖 Study it. **Self-check saves its runs** as self-graded and schedules them (`:512`). It is disabled while MIDI is connected (`:719`).
2. Lesson text names the answer to its own `ask`. For example, tritone-sub step 3 lists both guide tones and then asks you to tap them. So "predict, then reveal" happens in the UI: an ask step hides its text and highlights until the player answers.

**Sub-phase pointers.** Where a section is built is noted as *(PLAN 3d)* and so on.

---

## A. The Coach stage ladder: Learn → Study it → Self-check → Play it *(PLAN 3d)*

### Frame
Above the drill, a row of four pills in the house ladder idiom used by the Changes game (Guided → Choices → Open):

`Learn · Study it · Self-check · Play it`

- The current stage is circled in red pen. Finished stages get a mustard wash.
- **Every pill is always clickable.** Nothing is locked.
- The existing `GradingSwitch` folds into this ladder. Stages 2–4 *are* its three modes, so there is one control, not two. This replaces Phase 1's planned "Mode ▾" fold.
- `lastStage` persists per concept in `reharm.lessons`. It replaces `reharm.coachGrading` (`gradingMode.ts:26,52`), which is retired, so there is one source of truth.
- A pure `modeForStage(stage, midi)` maps the ladder onto the drill, with a unit table: learn → drill unmounted, study → `"study"`, self → `"self"` (or listen with the hint forced on when MIDI is connected, see Stage 3), play → `"listen"`. Note that `useGradingMode` forces `"listen"` when MIDI connects today; `modeForStage` takes over that rule.

**Where a concept opens:**
- **A fresh visitor's first Coach view** opens on `nextUp()[0]`, a foundation with no PrereqNote, not on a gated rule.
- New, Recommended first or Learning → **Learn**.
- Familiar or above → **Play it**, with "Why? (n steps)" under the rule card to reopen Learn.
- "Explanations: just the rule" → Learn opens collapsed (see D).

**Basics concepts** (`basics:*`) have no drill. Their ladder is `Learn` plus one evidence link, marked as practice elsewhere:
- guide tones → Voicings › Shells
- dominant resolution → Changes, Make the Changes, V → I (`ear:landing`)
- ii–V–I → Changes (`ear:setup`)
- the other basics: none; the lesson is the whole thing

### Stage 1: Learn (the `LessonStepper`)
**Where the lesson comes from:**
- For a rule drilled as a concept: `canonicalLesson(ruleId, key)` *(PLAN 2j)*. `canonicalMove` runs `generateMoves(canonicalTune, [rule]).accepted.find(m => m.ruleId === ruleId) ?? null` on that rule's canonical progression in the drill's current key (never a direct `rule.propose()`), so the secondary ii–V shows the full ii–V and it never returns another rule's move. The table lives only in `canonical.ts`; the drill (`conceptDrillSteps`) calls it, so Learn and Study it show the same chords.
- For a tune move drilled from the chart: `lessonForMove(dmove)`, the move's own lesson.
- For a basic: `basicsLesson(id, key)`.
- **A rule without a lesson yet** shows no Learn stage at all (the ladder starts at Study it) and today's body. No empty stepper ever renders.

**What the stage shows, top to bottom:**
1. A header: concept name · `Step 2 of 5` · progress dots. Each dot is a button; finished dots are filled. When the lesson was opened from a PrereqNote, the header also reads `from Tritone sub` (the return banner lives here, not as its own line).
2. The step text in `font-hand`, about 20 px, at most two lines on a phone. Glossary chips mark the step's `term`.
3. A keyboard with up to 4 lit keys and the label written **on** each key. Base it on `PenKeyboard` (it already has `labels` and `onKey`); `DoodleKeyboard` is display-only. The range fits the highlighted notes plus one key either side: two octaves minimum on desktop, the tightest fit (at least an octave) on a phone.
4. If the step has one, an inline `prereqLink` chip: "New to guide tones? Learn that first →".
5. A control bar: `‹ Back` · `▶ Hear` · `Next ›`.
   - On the last step, Next reads **"Study it ›"** and sets `finishedAt`.
   - Then the rule (one sentence, framed like the existing Why card) and a **"Go deeper" section**, plain and always shown on the last step (no fold), holding `deeper` and, in Study, the melody check, voice-leading grid, insight and the Deep Dive button. The stepper is the second disclosure level and the last one; an e2e fails if any element has ≥ 3 `aria-expanded` ancestors.

**On open**, step 1's play cue sounds once. Opening the lesson is a user gesture, so audio may start. Every lesson's step 1 has a cue (copy test).

**Play cues** (`▶ Hear`):

| Cue | What plays |
|---|---|
| `interval` | the highlighted notes one by one, then together |
| `before` | the move's original chords into the target |
| `after` | the reharm chords into the target |
| `ab` | before, a beat's rest, then after; small "Before / After" links underneath replay either half |

Basics have no "original", so steps carry an optional `sound?: string[][]` *(PLAN 2i)*: chord lists in engine spelling, produced by `transpose()`/`guideTones()`. Basics use it in place of before/after. Audio goes through the existing `player` audition (`hearChord`/`cancelAudition`), never Tone directly (rule 12).

**Keys** (the Changes precedent at `ChangesPage.tsx:122`):

| Key | Does |
|---|---|
| ← / → | Back / Next |
| Enter | Next. On an unanswered ask, the first Enter focuses and pulses "Show me"; a second Enter reveals |
| Space | ▶ Hear |
| Esc | closes a glossary popover or sheet |
| M | toggles computer keys, as on Changes |
| ? | opens the shortcuts sheet |

- Shortcuts are ignored while focus is in an input, and Space/Enter shortcuts are ignored while focus is on a button or link (the focused control handles them).
- The Learn listener mounts only while Learn is the stage, because `CoachDrill`'s own ←/→ handler is bound when Study it is on.
- **Esc:** popovers and sheets handle Esc in the **capture phase with `stopImmediatePropagation`** (as `Shortcuts.tsx:75` does), so `CoachPage.tsx:117`'s Esc-to-Study doesn't also fire. e2e: Esc on an open chip stays on Coach.
- No footer legend. `COACH_LEARN_SHORTCUTS` joins `Shortcuts.tsx`, and `?` opens it on Coach.

**Accessibility contract** *(PLAN 3c, tested in 3g/3d)*:
- The step region is `aria-live="polite"`. On Next/Back, focus moves to the step heading.
- Dots: `aria-label="Step n"`, the current one `aria-current="step"`. Ladder pills: `aria-current` on the current stage.
- A wrong key announces `Not B♭`. The reveal is announced ("B and F: both chords hold them").
- On a stage change, focus moves to the new stage's heading.
- Sheets trap focus and restore it on close.
- Every animation (pulse, tick, ghost key) has a `motion-reduce` variant.
- Verified with `@axe-core/playwright` scans of Learn, Path and an open chip, a keyboard-only e2e through every step and ask into Study it, and a Playwright `mobile` project (Pixel 5) for the learn/path specs.

**Predict, then reveal** (one ask per lesson, always in steps 2–4):
1. **Before the answer:** the step shows only the ask's `prompt` ("Tap the two keys G7 and D♭9 share.") above an unlit keyboard. The step text is replaced by a dashed "?" line. A `Show me` link sits beside Next. With no MIDI and computer keys off, the line under the prompt reads: `Tap the keys, or press M to use your computer keys.`
2. **Input** comes through **`useNoteBus(listener, stage === "learn")`**, so on-screen keys, QWERTY and MIDI all count. On-screen keys emit through `noteBus` with a guaranteed note-off (the `ChangesPage.tsx:458-463` pattern).
   - Each note-on is reduced to its pitch class.
   - A note in the answer set lights its key at once, with its label.
   - A wrong note shows briefly as a dashed ghost key with a small red-pen "✗" and is not counted.
   - **Order and octave don't matter.** A MIDI chord struck all at once answers a two-note ask in one go.
3. **The reveal** comes when every answer note has been played, or on Show me. The text and highlights appear, with a red-pen tick and a result line that states a fact: "✓ B and F: both chords hold them." Show me gives the same reveal without the tick.
4. Nothing is stored about right or wrong answers. **An ask is a moment of attention, not a test.**

**Grader isolation (hard requirement; Itai's real database depends on it):**
- While Learn is the stage, `LearnStage` renders the stepper **instead of** mounting the drill. No `useChordStrikes` and no `useDrillSession` strike path exist.
- When the drill is mounted, `useChordStrikes` is enabled only when `modeForStage` yields `"listen"` for the Play it stage (and Self-check's hint mode with MIDI). Study it stays ungraded.
- The lesson listener is a separate `useNoteBus` subscriber that never calls `drill.strike`.
- **ImprovHeatmap is another saving listener** (`ImprovHeatmap.tsx:515`, saves at `:302`) and can co-mount with the Study stepper. Structural guard: stepper asks are disabled while the heatmap is mounted, or stepper keys emit with a source the heatmap ignores. A test proves stepper notes never reach its save path.
- **The isolation e2e checks the local store, not `/api`.** In the demo, `e2e/fixtures.ts:15` already fails any `/api` request, and runs save to localStorage via `browserHistory` (`practice.ts:126`), so "zero `/api/practice`" proves nothing. With notes typed through every Learn step, ask included, the local practice store key must be absent or unchanged, `progress().sample` still true, and the passport still "Sample notebook". Any dev-server check runs against a scratch database (CLAUDE.md §0), never :8787.
- Lesson flags are written only to localStorage, in event handlers (StrictMode-safe).

### Stage 2: Study it
The existing ungraded `📖 Study it` (`StudyNav` + `StudyNotes`), unchanged apart from:
- The `WhyThisWorksCard` collapses to formula + lesson headline + rule, with a link: "Why? (5 steps)".
- After the last chord: **"Ready? Self-check ›"**. With MIDI connected it reads "Ready? Play it with the hint ›" (see below).

### Stage 3: Self-check
**The first saved attempt, with support** (Gate 0 item 2 in `PLAN.md`; default: yes). It adapts to the input:
- **No MIDI** (acoustic piano, or none): the existing ✋ Self-check mode. Reveal the voicing, play it, mark "Nailed it / Missed". The run is saved as self-graded (existing behaviour).
- **MIDI connected** (Self-check is disabled there today), or the player chooses QWERTY or on-screen keys: listen mode with **"Show the voicing hint" forced on**. The pill reads "Self-check: with hint".

The existing copy stays: "Self-checked runs are saved and scheduled for review like any other, marked as self-graded." After a clean run: "Clean in C. Play it from memory ›".

Verification of this stage happens only in the demo build or against a scratch database.

### Stage 4: Play it
Listen mode, **hint off**, with "New key after every clean run" on by default. This is the existing graded drill: in the fade from worked example to problem, the full problem.

### Layout
- **Desktop (md+):** the "Your path" rail on the left (about 16 rem). In the centre: the ladder, then the stepper. On the right: today's passport strip, as now. The keyboard spans the centre column, and the text sits directly above the lit keys (spatial contiguity).
- **Phone (<768 px):**
  - The rail becomes a "Your path ▾" button that opens a bottom sheet, plus a horizontally scrolling row of the 2–4 Next up chips.
  - The ladder pills scroll horizontally.
  - **One docked block** at the bottom, not two sticky bars: a short one-octave keyboard above the nav row (Back · ▶ Hear · Next as `tap-lg` buttons), padded by `env(safe-area-inset-bottom, 0px)`. The keys show only on steps that light or ask for keys; otherwise the block is just the nav row. Black keys are at least 44 px tall.
  - Glossary popovers open as bottom sheets.
  - The Why card folds under the drill, as it already does (`CoachDrill.tsx:525`).

### One routing line at a time
Above the stepper, at most one routing line shows, in this priority: **PrereqNote > return banner > first-run hint**. The return banner folds into the stepper header (`from Tritone sub`), and the Coach first-run hint hides while a PrereqNote shows.

---

## B. Soft lock, test-out and Next up *(PLAN 3b, 3d, 3e, 3f)*

### State inputs
`conceptStates(progress, flags, now)` exists. `progress` is always `ownProgressOnly(p)` = `p?.sample ? { concepts: [], cleanKeys: {} } : p` (rule 11; decision 4). **`LessonFlag` gains:**
- `testedOutAt?: string` and `testedOutVia?: string` (set on unmet hard prerequisites when a test-out passes)
- `relearn?: boolean`
- `lastStage?: "learn" | "study" | "self" | "play"`
- `continuedAnyway?: boolean`

**Storage:** `reharm.lessons` holds `{v: 1, flags}`. Each entry is validated on read and malformed ones are dropped; an unknown `v` is ignored (treated as empty). In the demo, "Erase runs" (`practice.ts:129`) also clears `reharm.lessons`, including test-out flags (Gate 0 item 9).

**Counters** (local, through `usage/panelOpens.ts`, shown in the ⚙ tally; *PLAN 3b*): `learn.step`, `learn.finish`, `prereq.view`, `prereq.continueAnyway`, `testout.pass`, `testout.undo`, `why.open`.

In `conceptStates`:
- `testedOutAt` counts like `finishedAt`.
- `relearn: true` caps the state at `learning`, whatever the evidence. **It is the only way to demote**, and only the player sets it.

Note: `recommendedFirst` is assigned only while a concept has no `seenAt` and no attempts. Opening a lesson makes it Learning and hides the PrereqNote; the step-level prereq chips still show.

### Recommended first
- **Chip** on the rail item and the Path card, with a dashed `ink-soft` border (the "ghost" idiom): `Recommended first: Guide tones →`. With two unmet prerequisites: `Recommended first: The tritone +1 →`. Clicking the chip opens the first unmet prerequisite's Learn.
- **PrereqNote**, inline above step 1 in red pen, never a modal:
  - `This builds on guide tones (3 steps).`
  - `This builds on the tritone and dominant resolution (7 steps).` The count comes from `prereqSummary` *(PLAN 2h)*: the sum of the prerequisite lessons' `steps.length`.
  - Buttons: **`Learn that first`** (primary) · **`Continue anyway`** · link **`Skip ahead: I know this (2-key test)`** (once 3f ships). The link is hidden while the concept is New and the player has no runs at all.
- **Continue anyway** sets `continuedAnyway: true`. The note disappears for that concept for good, and the state drops from recommendedFirst to new. Step-level `prereqLink` chips stay: they are help at the moment of use, not a gate.
- **Learn that first** opens the prerequisite's Learn; the stepper header reads `from Tritone sub` (the return banner, folded in; see A, "One routing line at a time"). On the prerequisite's last step, Next reads `Back to Tritone sub ›`.

### "Skip ahead: I know this (2-key test)" *(PLAN 3f, after Milestone 2)*
In scope by default (decision 8, answered by Itai), parked until the M2 review: built if `prereq.continueAnyway / prereq.view` ≥ 50% or Itai asks. Off the critical path. **Hidden on touch-first phones** (self-check isn't a test), and while the concept is New and the player has no runs at all. Never the key on screen.
1. **Panel** (inline, replaces the PrereqNote): `Play Tritone sub clean in two keys: E♭, then A. No hint.` Buttons: `Start` · `Not now`.
   - Two random `KEYS`: not the current key, not each other, and not the last pair tried. Injectable for e2e.
2. **Mechanism:** the existing `useDrillSession` with `flow: "random"`, two runs, listen mode only, hint off. Self-check doesn't qualify: a test-out is a performance check, not a self-report. With no MIDI the panel says: `Use computer keys (M) or the keys on screen.` The runs are real practice and are saved and graded like any Play it run, so verify only in the demo build or against a scratch database.
3. **Pass** = both runs have `misses === 0 && leaps === 0`.
   - Set `testedOutAt` on the concept, and `testedOutAt`/`testedOutVia` on each unmet hard prerequisite. Soft prerequisites are not marked.
   - Copy: `Clean in E♭ and A. Tritone sub, the tritone and dominant resolution are now Familiar.` · link `Undo`.
4. **Fail** at the first unclean run: `A miss in A. Tritone sub stays on Learning: open the lesson, or try two new keys.` The concept is Learning because it now has attempts; the run stays in history like any other.
5. **Reversible:**
   - **Undo** (in the result line, and in the rail item's ⋯ menu for a week) removes exactly the flags this test-out set.
   - **Relearn this** (⋯ menu on any Familiar+ concept) sets `relearn: true` and opens step 1: `Back to step 1. Your practice history is kept.` Finishing the lesson clears `relearn`.
6. **Demo build:** the runs save to this browser only; the flags live in localStorage, so a test-out still works with zero `/api`. Its e2e asserts the runs land in the local practice store, not that `/api` stayed quiet (which the fixture already guarantees).

### Next up and Due
In the rail, under the heading **"Next up"**: `nextUp(states, 4)`, showing at least 2 and at most 4 items. After *PLAN 2i*, every node it can return has a lesson.
- **Due items** fold in first, each with a red-pen dot and `Due in G♭`. If more than one key is due: `Due in 3 keys`.
- **Frontier items** carry one reason line: `New · builds on Dominant resolution ✓`, or `Learning · step 3 of 5`.
- The rest of the rail is "All concepts ▾" (collapsed): the tier list with state chips. It replaces "All 17 Jazz Concepts".
- When nothing is left: `Nothing new is waiting. Pick any concept, or play something due.`

---

## C. The Path tab in the passport drawer *(PLAN 3e)*

- A new tab, **"Path"**, after "Today's practice", in the drawer's pill-tab idiom (copy the `EngineXRay.tsx` `role="tablist"` pattern). The drawer still opens on "Today's practice".
- One line at the top: `Your path, from this browser's lessons and runs.` In the demo build add: `The sample notebook isn't counted.`
- **Layout:** five tier bands, top to bottom. Each band has a marker-font heading and wrapping `SketchBox` cards.

| Band | Heading |
|---|---|
| Tier 0 | Foundations |
| Tier 1 | First moves |
| Tier 2 | Core colours |
| Tier 3 | Borrowed and bold |
| Tier 4 | Out |

- **Card:** the name (`learnName`), a state chip, and the level tag (`L2`) in small ink-soft text.
- Tier 0 includes the two optional basics, `basics:sevenths` and `basics:numerals` (Gate 0 item 7), with an "optional" tag in ink-soft.
- **No edges are drawn by default**: a full DAG of 27 nodes is noise. On hover or focus, a card's hard prerequisites get a red-pen underline and its soft ones a dotted underline, and the card shows `Builds on: The tritone, Dominant resolution · Pairs well with: Secondary dominant`.

**State chips and visual idioms:**

| State | Card | Chip |
|---|---|---|
| New | plain ink | none |
| Recommended first | dashed `ink-soft` border | `Recommended first: X →` |
| Learning | solid ink border | `Learning` |
| Familiar | thin mustard wash | `Familiar` |
| Proficient | sage wash | `5/12` |
| Mastered | sage wash + red-pen stamp | `CLEAN` |
| Due (any state) | red-pen dot, top right | `Due` |

- Next up items carry a red-pen arrow `→ next`, the "you are here" idiom.
- **Click (or Enter):** close the drawer, switch to Coach, select the concept, and open the stage from A's rule. Deep link: `#coach/<conceptId>`. A Recommended-first card opens its PrereqNote. It never refuses.
- **Phone:** one column; bands become collapsible `<details>`, open for the tier holding the first Next up item.
- **Demo guard:** states come from `ownProgressOnly(p)` merged with *this browser's* runs and flags only, never `demoHistory.json`. `demoHistory.test.ts` asserts that with the seeded sample loaded, every concept is new or recommendedFirst.
- Panel counter: `passport.path`.

---

## D. Glossary chips, the symbol decoder, first-run hints and fading *(PLAN 2h, 3h, 3i)*

### GlossaryChip
- **Look:** a dotted underline, no icon.
- **Desktop:** opens on hover after 300 ms, or on focus + Enter. **Touch:** opens on tap.
- **Popover:** the term in bold, the gloss (≤ 8 words) and `Learn it →` when the entry has a `conceptId`. Esc (capture phase, see A) or a tap outside closes it.
- **Only the first use of a term in a view gets a chip.**
- Chips replace native `title` tooltips that carry teaching text; those don't work on touch and can't hold a link.

| Screen | Chips on |
|---|---|
| Study | the move card's headline and stepper terms (`step.term`); category labels ("Dominant sub", "Modal"); `ChordMoveSelector`'s teaching tooltips (`:341-353`); the rejected list's reasons ("avoid note") |
| Coach | the Learn step's `term`; the Why card's formula words (tritone sub, backdoor, upper structure); the ladder's "Self-check" (gloss: "Reveal, play, grade yourself.") |
| Changes | glossary terms in feedback, plus a "Learn the tritone sub →" link after a "real jazz move" alt line. The game's copy is not changed (`ears.motions.test.ts` constraints hold). |
| Voicings | "guide tones", "rootless", "Close (rootless)", and a `Recommended first: Shells` chip on rootless shapes |
| Practice | "Don't hold:" (avoid note) and "enclosure" in the heatmap legend; the inline `xl` shortcut legend moves behind ⌨ |
| Path | none: the cards are the concepts |

**Glossary additions** *(PLAN 2h)*. Besides the category labels, level labels (keyed `L1`–`L4`), Type A / Type B and Close (rootless), the new lessons need (≤ 8 words each):

| Term | Gloss | Concept |
|---|---|---|
| `tensions` (aliases `tension`, `extensions`) | "Notes above the 7th: 9th, 11th, 13th." | `basics:extensions` |
| `diminished 7th` | "Four notes stacked in minor 3rds." | `basics:dim7` |
| `augmented triad` | "Three notes a major 3rd apart." | `basics:symmetricOctave` |
| `sus` | "The 4th replaces the 3rd: no pull yet." | none |
| `line cliché` | "One voice moving by half steps inside a held chord." | `chromatic.minorLineCliche` |
| `dominant 7th` | "Major 3rd plus ♭7: wants to resolve." | `basics:sevenths` |
| `roman numerals` | "Chords named by their root's scale step." | `basics:numerals` |

**Roman-numeral entries** (2h adds them; 2i links them to `basics:numerals`):

| Term | Gloss |
|---|---|
| `V` | "The chord built on the key's 5th." |
| `♭II` | "Chord on the lowered 2nd: tritone-sub root." |
| `ii` | "Minor chord on the key's 2nd step." |
| `♭VII7` | "Dominant on the lowered 7th: the backdoor." |
| `iv` | "Minor chord on the 4th, borrowed from minor." |

This is how a lesson says "V (F's five chord)" without extra words: the numeral carries a chip.

Also check that `borrowed`, `appoggiatura`, `tonicize`, `constant structure`, `upper structure`, `shell`, `rootless` and `the Family` exist. The copy test requires every `term` to be in the glossary; *PLAN 5f* adds a scan for undeclared glossary words in step text.

### Chord-symbol decoder chip *(PLAN 3h)*
- Any chord symbol shown in a lesson, card or HUD can be tapped (or focused + Enter). The popover breaks it into parts: root, quality, extensions, alterations, bass. Example, `G7(♭9)`: "G: root · 7: dominant 7th (B, F) · ♭9: A♭".
- Covers at least `7(♭9)`, `m7♭5`, `maj7`, `13(♯11)` and slash chords (`F/G`: "F triad over G in the bass").
- Generated by a pure `decodeSymbol` in theory-core (`learn/decoder.ts`) from the same `ChordShape` fields `symbol()` prints (`chords.ts:84`), never hand-written text. Notes in the popover come from `chordTones()`, display-spelled.
- Test: every suffix the 17 rules emit decodes, in 12 keys.

### First-run hints
- One dismissible line per screen, stored under `reharm.reveal.hint.<screen>` through `useRevealState` (the convention 238c604 set for Study; `hint.*` keys skip the open counter). If storage throws, the hint shows each session, which is acceptable.
- A `✕ Got it` button dismisses it.
- A hint is a routing line: it hides while a PrereqNote or return banner shows (A, "One routing line at a time").

| Screen | Hint |
|---|---|
| study | "Each card leads with what you'll hear. Press ▶ Before / After, then open the steps." |
| coach | "Pick a concept. New ones start with a short lesson; nothing is saved until Self-check." |
| path | "Recommended first is advice, not a lock: every concept opens." |
| voicings | "Start with Shells: the 3rd and 7th that every other shape builds on." |
| practice | "Practice is for moves you know. ⌨ shows the shortcuts." |

### Fading and the Explanations setting *(PLAN 3i: the setting and adaptive fading ship together)*
- **Setting:** in ⚙ Settings (where the theme switch went), a radio: `Explanations: Step by step · Just the rule`. Stored per browser in `reharm.explain` = `"steps" | "rule"`. The setting overrides fading (decision 6, answered by Itai). One pure `depthFor(setting, cleanKeys, latestRun)` decides, using the player's own runs from 3b.
- **Default:** "steps" for a new visitor (decision 6). Itai sets "rule" once per browser and it persists. No account-specific defaults.
- **Step by step (adaptive):** a concept opens the stepper until it has **at least one clean graded key**; then it opens collapsed: headline + rule + `Why? (5 steps)`. Finishing a lesson makes the concept Familiar for the path, but does **not** fold the steps: they stay until the move has been played clean once.
- **Just the rule:** every concept opens collapsed, including new ones. Learn shows the headline, the rule, ▶ Before/After and `Step by step ›`, and the primary button is `Study it ›`. **Prerequisite notes still appear, as one line**, because they are routing, not explanation.
- **Adaptive from SM-2** *(PLAN 3i)*: if a concept's latest graded run is ≤ 2, it reopens step by step once: `A rough run in A♭: the steps are open again.` Only in "steps" mode, and never from the seeded sample.

---

## E. Lesson drafts (key of C, as rendered)

Conventions, as in phase 2:
- **Text** is display-spelled. **`highlight` and `ask.answer`** are engine-spelled.
- **Step format:** `n.` text · **HL** highlights · **▶** play cue · **ASK** · **T** term · **P** prereqLink.
- Word counts were checked by hand against the copy test's `words()` and `sentences()`. ⚠ marks a step tight on budget.
- Budgets (from `learn.copy.test.ts`): step ≤ 20 words; any sentence ≤ 25; headline ≤ 20; ≤ 4 highlights; ≤ 2 terms per lesson; exactly one ask, in steps 2–4; 3–5 steps; **step 1 has a ▶ cue** (new in 2i; it plays on open); banned words; no ASCII flats, no `#`.
- **Spelling rule 5 stays:** engine spelling first, the enharmonic twin in parentheses ("C♭ (same key as B)"). The panel's "E (written F♭)" reversal was declined; the symbol decoder and glossary chips explain respelling instead.
- Lessons never compute notes. Every value comes from the rule's `*Learn` block, or from `transpose()`/`guideTones()` for basics.

**Helper changes** (formatting only, in `lesson.ts`) *(PLAN 2i)*:
- Extend `DEGREE_WORD` with `"4": "sus 4th"`, `"#11": "♯11"`, `"#9": "♯9"`, `"11": "11th"`, `b5: "♭5"`.
- The optional `sound?: string[][]` step field (see A).
- **Never "a/an" before a note name.** Write "the E♭ triad". (`mediantDominant` already needs a regex for this.)

**Engine helpers** in theory-core, each with tests *(PLAN 5a)*:
- `planeMotion(from, to)` in `ruleKit.ts`, positional voice motion: `nearestMotion(from, [{degree, note: to}])`. `nearestMotion` over a whole chord can tie or pick a hold where parallel motion is meant.
- Tidied diminished tones for display (no B♭♭ or D♭♭ in descending passing °7s), and direction spelling for the common-tone °7 (`"#2"`/`"#4"`, behind its hard stop).
- A `symbol()` check for the line-cliché stops.
- Collapsing runs of holds in a `VoicePath` (Coltrane step 3).
- Degree codes, not words, in one-note-on-top `roles`.

### Basics (`lessons/basics.ts`, tonic T = C) *(PLAN 2i)*

**Shipped-copy fixes in 2i** (lessons from 8d8d832; re-pin any test that pins the old text):
- **basics:guideTones step 2** becomes: "B, the 3rd, makes G7 major. F, not F♯, makes it a dominant 7th: F♯ would make Gmaj7."
- **functional.borrowedIv step 4:** the landing reads "bittersweet, a softer landing than V–I".
- **Step 1 of every shipped lesson** gets a ▶ cue where it lacks one.
- The tritone-sub "V (F's five chord)" idea is served by the numeral glossary chip on "V", not by extra words in the step.

**basics:sevenths** *(optional tier 0, Gate 0 item 7; guideTones hard-needs it)*
- **Headline:** "A 7th chord stacks four notes in 3rds; its 3rd and 7th give it its name." (16 words)
- **Steps:**
  1. "Stack 3rds on G: G, B, D, F. That's G7, a dominant 7th." · HL G root, B 3rd, D 5th, F ♭7 · ▶ interval · T dominant 7th
  2. "Raise F to F♯ and it's Gmaj7: a major 7th, a half step below the root." (16 words) · HL G, B, D, F♯ · ▶ `sound` [G7, Gmaj7]
  3. **ASK** "Make it Gm7: lower one key. Tap the new 3rd." answer [Bb] · text "Lower the 3rd, B to B♭, and G7 becomes Gm7: minor 3rd, ♭7." · HL G, B♭, D, F · ▶ `sound` [Gm7]
  4. "Built from C major's notes, the chord on G gets F, not F♯: a dominant 7th." (16 words) · HL F ♭7 · ▶ `sound` [G7, C]
- **Rule:** "Name a 7th chord by its 3rd and 7th: maj7 has both major, 7 a major 3rd and ♭7, m7 both minor." (22 words)
- **Deeper:** "The 5th rarely changes the name; drop it first when your hand is full."
- **Notes:** all tones via `transpose(G, "3" | "b3" | "5" | "7" | "b7")`. One term.

**basics:numerals** *(optional tier 0, Gate 0 item 7; soft prerequisite of tritoneSub, backdoor, flatSixFlatSeven and secondaryDominant)*
- **Headline:** "Roman numerals name chords by scale step: in C, V is the chord built on G, the 5th note." (19 words)
- **Steps:**
  1. "Number C major's notes: C is 1, D is 2, and so on up to B, 7." · HL C 1, D 2, G 5, B 7 · ▶ interval
  2. **ASK** "V is the chord on step 5. Tap its root." answer [G] · text "V is the chord on step 5: G7 in C. Uppercase is major, lowercase minor." · HL G root · ▶ `sound` [G7, C] · T roman numerals
  3. "ii is Dm7, on step 2, so ii–V–I in C is Dm7, G7, Cmaj7." · HL D, G, C · ▶ `sound` [Dm7, G7, Cmaj7]
  4. "Add ♭ and the root drops a half step: ♭II in C is D♭, ♭VII is B♭." (17 words) · HL D♭, B♭ · ▶ interval
- **Rule:** "Read a numeral as a scale step of the key; the chord's root sits on that step." (17 words)
- **Deeper:** "Numerals let one rule work in all 12 keys: V7 to I is the same move anywhere."
- **Notes:** roots via `transpose(T, "2" | "5" | "b2" | "b7")`. Step 4 avoids opening with "A flat": "A" would read as a note name. One term.

**basics:extensions** (step 2 split: the avoid-note idea, then "raise it or go sus")
- **Headline:** "Above the 7th, a chord keeps stacking 3rds: the 9th, 11th and 13th add colour, not function." (17 words)
- **Steps:**
  1. "Keep stacking 3rds on G7 past F: A is the 9th, C the 11th, E the 13th." · HL F ♭7, A 9th, C 11th, E 13th · ▶ `sound` G7 then G13 · T tensions
  2. "On G7, C is an avoid note: a half step above B, the 3rd, it clashes." (15 words) · HL C "avoid", B 3rd · ▶ `sound` [G7 with C] · T avoid note · P basics:guideTones
  3. "Raise it to C♯, or drop B and make it sus." · HL C♯ ♯11, C sus 4th · ▶ `sound` [G7(♯11), G7sus]
  4. **ASK** "Tap the ♭9 and the ♭13 of G7." answer [Ab, Eb] · text "A dominant may bend the 9th or flatten the 13th: A♭ or A♯, and E♭." · HL A♭ ♭9, A♯ ♯9, E♭ ♭13
  5. "Play B, F, A and E over G: the guide tones hold the chord, the tensions colour it." · HL B 3rd, F ♭7, A 9th, E 13th · ▶ `sound`
- **Rule:** "Stack 9, 11 and 13 above the 7th; a dominant raises the 11th or goes sus, and may bend the 9th or flatten the 13th." (25 words, ⚠ at the limit)
- **Deeper:** "The target chooses the tensions: a dominant resolving to minor wants the ♭9 and ♭13."
- **Notes:** A♯ is `transpose(G, "#9")`; C♯ is `transpose(G, "#11")`. Two terms (tensions, avoid note): at the limit, so "sus" is not marked here (the gospel lesson owns it).

**basics:dim7**
- **Headline:** "A diminished 7th stacks four minor 3rds and splits the octave into four equal parts." (15 words)
- **Steps:**
  1. "Stack minor 3rds from B: D, F, A♭. That's Bdim7, a diminished 7th." · HL B, D, F, A♭ · ▶ interval · T diminished 7th
  2. "Past A♭, the next minor 3rd is C♭ (same key as B), so only three different diminished 7ths exist." (19 words) · HL A♭, C♭ · ▶ interval
  3. **ASK** "Put G under Bdim7. Which key is G7's ♭9? Tap it." answer [Ab] · text "Put G under it: B, D, F, A♭ are G7's 3rd, 5th, 7th and ♭9." · HL G root, B 3rd, F 7th, A♭ ♭9
  4. "So Bdim7 pulls into C like G7 does: B rises to C, A♭ falls to G." · HL B ↑, C, A♭ ↓, G · ▶ `sound` [Bdim7, C] · P basics:dominantResolution
- **Rule:** "Treat any diminished 7th as a rootless 7(♭9): each of its notes is the 3rd of a dominant a major 3rd below." (22 words)
- **Deeper:** "So four dominants, G7, B♭7, D♭7 and E7, share Bdim7 once they take the ♭9."
- **Notes:** dim = `transpose(T, "7" | "2" | "4" | "b6")`; the four dominants are on `"5" | "b7" | "b2" | "3"`, the same intervals `mediantDominant` uses.

**basics:symmetricOctave**
- **Headline:** "Three major 3rds stack to an octave: C, E, A♭, back to C. Three keys, equally spaced." (17 words)
- **Steps:**
  1. "C up a major 3rd is E. E up a major 3rd is G♯; we spell it A♭, C's ♭6." (19 words) · HL C, E, A♭ · ▶ interval
  2. **ASK** "Tap the key a major 3rd above A♭." answer [C] · text "One more from A♭ lands on C: three major 3rds fill the octave exactly." · HL A♭, C · ▶ interval
  3. "C, E and A♭ together make an augmented triad: no note sounds like home." · HL C, E, A♭ · ▶ `sound` · T augmented triad
  4. "Make each a key: Cmaj7, Emaj7, A♭maj7. Each arrival lands far from the last." · HL C, E, A♭ · ▶ `sound` three chords
- **Rule:** "Divide the octave into three major 3rds; each note can be a key centre of its own." (16 words)
- **Deeper:** "Coltrane changes tour these three keys, each reached from its own dominant."
- **Notes:** E → A♭ is a diminished 4th on paper and a major 3rd by ear. Step 1 names the G♯ the ear expects, then the A♭ the engine writes (as Coltrane's rule does), with the reason: it is C's ♭6.

### Rules *(PLAN 5b–5d)*

Each rule gives its key-of-C context, the **`facts.learn` fields** its `propose()` must add (built from variables already in scope), and the lesson.

**voicing.upperStructureBVI** (context: G7 → Cm7) *(5d)*
- **`UpperStructureBVILearn`:**

| Field | Built from |
|---|---|
| `original` | `symbol(chord)` |
| `voiced` | `symbol(newChord)` |
| `target` | `symbol(next)` |
| `root` | `chord.root` |
| `triadRoot` | `tr` |
| `triad` | `rh` as `[string, string, string]` |
| `shell` | `lh` (root, ♭7, 3rd) |
| `sharpNine` | `transpose(chord.root, "#9")` |
| `common` | `common`, capped at 3 |
| `thirdResolves` | `nearestMotion(lh[2], triadTones(next))` |
| `targetMinor` | `toMinor` |

- **Headline:** "Over G7's shell, play the E♭ triad: one easy shape gives you G7(♯9,♭13)." (13 words)
- **Steps:**
  1. "Left hand: G, F, B. Root, ♭7 and 3rd: the dominant's shell." · HL G root, F ♭7, B 3rd · ▶ interval · T shell · P basics:guideTones
  2. **ASK** "Tap the major triad a major 3rd below G." answer [Eb, G, Bb] · text "Right hand: the E♭ major triad, a major 3rd below G: the upper structure." · HL E♭, G, B♭ · T upper structure
  3. "Over G, the triad reads ♭13, root, ♯9: B♭ (same key as A♯) is the ♯9." · HL E♭ ♭13, G root, B♭ ♯9 · ▶ after · P basics:extensions
  4. "Into Cm7, B rises to C, and E♭, G and B♭ are already there." · HL B ↑, C, E♭, G · ▶ ab
     - If `common` is empty: "Into ${target}, ${thirdResolves}: the triad's tension lands there."
- **Rule:** "Over a dominant 7th, hold root, ♭7 and 3rd in the left hand and play the major triad on its ♭13 above." (21 words)
- **Deeper:** "All three triad notes sit in G altered, so the right hand can keep going in that scale."

**gospel.halfStepTurnaround** (context: G7 → Cmaj7, 4 beats) *(5c)*
- **`GospelTurnaroundLearn`:**

| Field | Built from |
|---|---|
| `original` | `symbol(chord)` |
| `sus` | `sus.display` ("F/G") |
| `susRoot` | `chord.root` |
| `susTriad` | `[susTop, transpose(susTop, "3"), transpose(susTop, "5")]` |
| `approach` | `symbol(approach)` |
| `approachRoot` | `apRoot` |
| `target` | `targetSym` |
| `targetRoot` | `next.root` |
| `motions` | `vl` (positional, via `planeMotion`) |
| `held` | `vl.filter(m => m.semitones === 0).map(m => m.from)` |
| `sharpEleven` | the `#11` tone of `chordTones(approach)` |
| `leadingTone` | `guideTones(chord)[0].note` |
| `grip` | `{lh: [root, ♭7, 3rd], rh: [9th, ♯11, 13th]}` of `approach` by degree: LH D♭–C♭–F, the E♭ triad (E♭ G B♭) on top |

- **The target shown must match the resolution.** Six voices falling a half step or holding from D♭13(♯11) make Cmaj13 (B♭ → A is the 13th), so the draft shows Cmaj13. If the engine's `targetSym` prints something else, 5c either shows what the voices make or drops the 13 from the approach's display; never a target the voices don't reach.
- **Headline:** "Turn G7 → Cmaj7 into F/G → D♭13(♯11) → Cmaj13: a slide into home from a half step above." (16 words)
- **Steps:**
  1. "F/G is G9sus: the F triad over G in the bass. No B, so nothing leans into C yet." (18 words) · HL G bass, F, A, C · ▶ after · T sus
  2. "D♭13(♯11) is the tritone sub of G7: its root sits a half step above C." · HL D♭ ♭II, G old root, C home · P dominant.tritoneSub
  3. **ASK** "Which keys of D♭13(♯11) stay put into Cmaj13? Tap them." answer `held` = [Cb, G] · text "Into Cmaj13, D♭, F, E♭ and B♭ fall a half step; G and C♭ (same key as B) hold." (19 words) · HL C♭ "holds as B", G holds, D♭ ↓, C · ▶ after
     - The voicing shown is `grip`: LH D♭–C♭–F with the E♭ triad on top, a playable grip, not a 7-note cluster. If a key respells two holds, drop the falling list: "Every other voice falls a half step; G and C♭ (same key as B) hold."
  4. "Compare: G falls a fifth to C; here D♭ slides down a half step after the sus." · HL G, D♭, C · ▶ ab
- **Rule:** "Before a major I, play IV/V, then a 13(♯11) chord a half step above I, and slide down into I." (21 words)
- **Deeper:** "D♭13(♯11)'s ♯11 is G: the sub keeps G7's root inside, as the ♯11."
- **Prerequisites** *(2h)*: hard `basics:extensions`, soft `voicing.upperStructureII` (the E♭ triad over the shell is the same idea).

**voicing.rootlessTwoFiveOne** (context: Dm7 → G7 → Cmaj7) *(5d)*
- **`RootlessTwoFiveOneLearn`:**

| Field | Built from |
|---|---|
| `ii`, `V`, `I` | the symbols (`iiChord`, `vChord`, `afterNext`) |
| `iiGrip` | `[...iiGrip.lh, ...iiGrip.rh]` (3–5–7–9) |
| `vGrip` | the same for V (7–9–3–13) |
| `iGrip` | the same for I (3–5–7–9) |
| `toV` | `iiGrip[k] → vGrip[k]` by `planeMotion` |
| `toI` | `vGrip[k] → iGrip[k]` by `planeMotion` |
| `vRoot` | `next.root` |

  Positional motions are required here: `nearestMotion(A, Cmaj7)` ties between G and B.
- **Headline:** "Voice Dm9 → G13 → Cmaj9 without roots: one finger moves from ii to V." (13 words)
- **Steps:**
  1. "Play Dm9 rootless: F, A, C, E, its 3rd, 5th, 7th and 9th." · HL all 4 · ▶ after · T rootless · P basics:extensions
  2. **ASK** "One key of Dm9 moves to make G13. Tap where it goes." answer [B] · text "Only C moves: it falls a half step to B, G13's 3rd. F, A and E stay." · HL C 7th, B 3rd, F, A · P basics:twoFiveOne
  3. "Now F, A, B, E read as G13's 7th, 9th, 3rd and 13th." · HL the 4 with those labels · ▶ after
  4. "Into Cmaj9, F falls to E, A to G, E to D; B holds." · HL E 3rd, G 5th, B 7th, D 9th · ▶ ab
- **Rule:** "Over ii–V–I, voice ii as 3–5–7–9, drop only its 7th a half step for V, then step down into 3–5–7–9 on I." (24 words, ⚠ close to the limit)
- **Deeper:** "Grip A has the 3rd on the bottom, grip B the 7th. Start ii on either; each fifth down swaps them."

**voicing.upperStructureII** (context: G7 → Cmaj7) *(5d)*
- **`UpperStructureIILearn`:** `original`, `voiced: symbol(newChord)`, `target`, `root`, `triadRoot: tr`, `triad: rh`, `shell: lh` (root, 3rd, ♭7), `naturalEleven: transpose(chord.root, "4")`, `parentMelodicMinor: tidy(transpose(chord.root, "5"))`.
- **Headline:** "Over G7's shell, play the A major triad: G13(♯11), bright and open." (12 words)
- **Steps:**
  1. "Left hand: G, B, F. Root, 3rd and ♭7: the shell." · HL G, B, F · ▶ interval · T shell · P basics:guideTones
  2. **ASK** "Tap the major triad a whole step above G." answer [A, C#, E] · text "Right hand: the A major triad, a whole step above G: the upper structure." · HL A, C♯, E · T upper structure
  3. "Over G, A is the 9th, C♯ the ♯11, E the 13th." · HL G root, A 9th, C♯ ♯11, E 13th · ▶ after · P basics:extensions
  4. "C♯ is the bright note: a ♯11 where a plain C would rub against B, the 3rd." · HL C♯, C, B · ▶ ab
- **Rule:** "Over a dominant 7th, hold root, 3rd and ♭7 in the left hand and play the major triad a whole step above the root." (23 words)
- **Deeper:** "Together they spell G Lydian dominant, the 4th mode of D melodic minor."

**dominant.mediantDominant** (context: G7 → Cmaj7) *(5c)*
- **`MediantDominantLearn`:**

| Field | Built from |
|---|---|
| `original` | `symbol(chord)` |
| `sub` | `symbol(sub)` |
| `target` | `symbol(next)` |
| `originalRoot` | `chord.root` |
| `subRoot` | `sub.root` |
| `targetRoot` | `T` |
| `dim` | `dim` |
| `respelled` | `[third, dim.find(d => chroma(d) === chroma(third))]` (G♯ / A♭) |
| `resolution` | `chainMotions([third, seventh], [next]).map(v => v[0])` |
| `familyRoots` | `familyChords.map(c => c.root)` |

- **Headline:** "Play E7(♭9) instead of G7: the same diminished shape on top, a new bass under it." (16 words)
- **Steps:**
  1. "Add the ♭9 to G7 and drop the root: B, D, F, A♭, a diminished 7th." · HL B, D, F, A♭ · ▶ ab · T diminished 7th · P basics:dim7
  2. **ASK** "Keep those four keys. Tap the bass a major 3rd above C." answer [E] · text "Put E under them: G♯ (same key as A♭), B, D and F make E7(♭9)." (17 words) · HL E bass, G♯ 3rd, D ♭7, F ♭9
  3. "Into Cmaj7, G♯ falls a half step to G, D a whole step to C. E stays." · HL G♯, G, D, C · ▶ ab
  4. "With a ♭9, G7, B♭7, D♭7 and E7 all hold these four keys: the Family." · HL G, B♭, D♭, E · T the Family
- **Rule:** "Over V7 to I, keep the diminished 7th a half step below I in your hands and put the bass a major 3rd above I." (25 words, ⚠ at the limit; can drop "in your hands")
- **Deeper:** "E7 usually leads to Am, so the ear expects A minor and gets C major instead."
- **Terms:** two, on the limit. Step 1's term can be dropped once basics:dim7 is Familiar.
- **Prerequisites** *(2h, adopted on the teacher's advice)*: hard `basics:dim7` (step 1 and "the Family" lean on it); `dominant.tritoneSub` becomes soft; the backdoor stays soft.

**modal.flatSixFlatSeven** (context: G7 → Cmaj7, 4 beats) *(5d)*
- **`FlatSixFlatSevenLearn`:** `original`, `target`, `targetRoot: T`, `bVI`, `bVII` (symbols), `bVIRoot`, `bVIIRoot`, `leadingTone: guideTones(chord)[0].note`, `bVIINinth` (the `9` tone of `chordTones(bVII)`).
- **Headline:** "Replace G7 with A♭maj7 → B♭6/9: the bass climbs two whole steps into C." (13 words)
- **Steps:**
  1. "A♭maj7 and B♭6/9 are borrowed from C minor: they sit on its ♭6 and ♭7." · HL A♭ ♭6, B♭ ♭7, C home · ▶ after · T borrowed · P basics:parallelMinor
  2. **ASK** "Tap the bass line into C." answer [Ab, Bb, C] · text "The bass climbs by whole steps: A♭ to B♭ to C." · HL A♭, B♭, C · ▶ after
  3. "B♭6/9 has no B: nothing leans up into C. Its 9th is C, already home." · HL B missing, C 9th · ▶ ab
  4. "You hear a lift by whole steps, not a half-step pull: a phrase-ending sound." · HL A♭, B♭, C · ▶ ab
- **Rule:** "Before a major I, play the major chords on ♭6 and ♭7 and let the bass climb by whole steps into I." (21 words)
- **Deeper:** "B♭6/9 is the backdoor's ♭VII with G in place of A♭: same root, no tritone."
  - Check: B♭ D F G C has no tritone; B♭7 has D–A♭.
- **Prerequisites** *(2h)*: gains soft `modal.backdoorTwoFive` (the deeper line compares to it); soft `basics:numerals`.

**chromatic.passingDiminished** (ascending context: Cmaj7 → Dm7; descending: Em7 → Dm7) *(5c)*
- **`PassingDiminishedLearn`:**

| Field | Built from |
|---|---|
| `from`, `dim`, `target` | the symbols |
| `fromRoot`, `dimRoot`, `targetRoot` | the roots |
| `ascending` | `ascending` |
| `dimTones` | `chordTones(dim).map(t => tidy(t.note))`: **tidied**, since E♭dim7 would otherwise show B♭♭ and D♭♭ (helper and property in PLAN 5a) |
| `impliedV` | `V` |
| `impliedV7` | `symbol(mk(V, "7", 1, [], ["b9"]))` |
| `roles` | each dim tone's degree in that V7(♭9) |
| `motions` | `dimTones.map(n => nearestMotion(n, chordTones(next)))` |

- **Headline (up):** "Between Cmaj7 and Dm7, slip in C♯dim7: the bass walks C, C♯, D by half steps." (16 words)
- **Steps (up):**
  1. "C to D is a whole step. C♯dim7 fills it, so the bass moves by half steps." · HL C, C♯, D · ▶ ab · P basics:dim7
  2. **ASK** "C♯dim7 is a dominant without its root. Tap that root: the V of Dm7." answer [A] · text "C♯, E, G, B♭ are A7(♭9) without A: its 3rd, 5th, 7th and ♭9." · HL A, C♯, G, B♭ · P functional.secondaryDominant
  3. "So it pulls into Dm7 like A7 would: C♯ rises to D, B♭ falls to A." · HL C♯ ↑, D, B♭ ↓, A · ▶ after
- **Steps (down):** branch on `ascending`; E♭dim7 tidied is E♭ G♭ A C.
  1. "E to D is a whole step. E♭dim7 fills it, so the bass walks down by half steps." · HL E, E♭, D · ▶ ab · P basics:dim7
  2. **ASK** "Tap the two keys E♭dim7 shares with Dm7." answer [A, C] · text "E♭dim7 already holds A and C, Dm7's 5th and 7th." · HL A, C
  3. "E♭ and G♭ slide down a half step into D and F." · HL E♭, D, G♭, F · ▶ after
- **Rule:** "Between two chords a whole step apart, put a diminished 7th on the half step between their roots." (18 words)
- **Deeper (up):** "Any rising ♯I°7 works the same way: it is the V7(♭9) of the chord it leads to."

**chromatic.commonToneDiminished** (context: G7 → Cmaj7, 4 beats) *(5c; **hard stop**, Gate 0 item 8)*
- **Spelling by direction of resolution (default, teacher's advice):** sharps rise, flats fall. The leaning tones are `transpose(root, "#2")` and `transpose(root, "#4")` (D♯, F♯), simplified where a double sharp would result; the 6th stays A. The descending passing °7 keeps flats (E♭ G♭ A C). This changes rule 3 output and golden tests, so it waits for Itai's explicit yes; without it, this lesson waits and the other 5c lessons ship.
- **`CommonToneDiminishedLearn`:** `chord: symbol(chord)`, `dim: symbol(dim)` (the symbol is unchanged), `root`, `dimTones` (C, D♯, F♯, A), `leans: lean.map(n => nearestMotion(n, chordTones(chord)))`.
- **Headline:** "Open the bar on Cdim7, then Cmaj7: two notes lean a half step up into the chord." (16 words)
- **Steps:**
  1. "Cdim7 is C, D♯, F♯, A: it shares only C with Cmaj7, and the bass stays." (16 words) · HL C, D♯, F♯, A · ▶ after · P basics:dim7
  2. **ASK** "Which two keys of Cdim7 rise a half step into Cmaj7? Tap them." answer [D#, F#] · text "D♯ rises to E, the 3rd; F♯ rises to G, the 5th." · HL D♯ ↑, E, F♯ ↑, G · ▶ after
  3. "D♯ and F♯ are appoggiaturas: tension on the beat that resolves up into Cmaj7." · HL D♯, F♯ · ▶ ab · T appoggiatura
- **Rule:** "On a major chord that lasts, start on the diminished 7th with the same root and let its middle notes rise a half step." (23 words)
- **Deeper:** "Sharps because they rise: the passing °7 that falls spells the same keys with flats."
- **If Itai keeps E♭/G♭:** steps 1–3 read "E♭ rises to E, G♭ to G", the ask's answer is [Eb, Gb], and the deeper line becomes "Spelled by function, it's C, D♯, F♯, A: a raised 2nd and 4th, each leaning up."

**symmetric.coltraneSubstitution** (context: Dm7 → G7 → Cmaj7, 2 bars). Key-centre map first. *(5b)*
- **`ColtraneLearn`:**

| Field | Built from |
|---|---|
| `ii`, `V`, `target` | the symbols |
| `targetRoot` | `T` |
| `centres` | `centres` (A♭, E, C) |
| `centreChords` | `[chords[2], chords[4]].map(symbol)` plus `target` |
| `dominants` | `[chords[1], chords[3], chords[5]].map(symbol)` |
| `dominantRoots` | `[roots[1], roots[3], roots[5]]` |
| `line` | a `VoicePath` from `chainMotions([b3 of ii, b7 of ii], [...chords.slice(1), afterNext])[0]`, with hold runs collapsed (PLAN 5a). It is a descending single voice, not a guide-tone line; a real 3rd/7th chain would need its own field |

- **Headline:** "Over Dm7 → G7 → Cmaj7, tour three keys a major 3rd apart before landing on C." (15 words)
- **Steps:**
  1. "The map first: three key centres, A♭, E and C, a major 3rd apart." · HL A♭, E, C · ▶ interval · P basics:symmetricOctave
  2. **ASK** "Each key gets its own V7. Tap the root a fifth above A♭." answer [Eb] · text "Each key is tonicized by its own V7: E♭7 → A♭maj7, B7 → Emaj7, G7 → Cmaj7." · HL E♭, B, G · T tonicize · P functional.secondaryTwoFive
  3. "One voice carries it: F, E♭ (held, respelled D♯), D, C." · HL F, E♭, D, C · ▶ after
     - ⚠ The raw `VoicePath` is F→E♭→E♭→D♯→D♯→D→C; the template uses the collapsed form.
  4. "Then G7 → Cmaj7, the V–I you started with, lands home on time." · HL G, C · ▶ ab
- **Rule:** "Over a ii–V–I, tonicize the keys a major 3rd apart: V7–I into ♭VI, V7–I into III, then V7–I home." (21 words)
- **Deeper:** "The three dominants, E♭7, B7 and G7, form a major-3rd cycle of their own."
- The map step may need a `map?: string[]` step field rendered by `LessonStepper`.

**chromatic.constantStructure** (context: G7 (4 beats) → Cmaj7, two-step plane) *(5b)*
- **`ConstantStructureLearn`:**

| Field | Built from |
|---|---|
| `from` | `symbol(chord)` |
| `target` | `symbol(next)` |
| `targetRoot` | `next.root` |
| `planed` | `planed.map(symbol)` |
| `planedRoots` | `path` |
| `shapeTones` | `chordTones(next).map(t => t.note)`, capped at 4 |
| `approachTones` | `chordTones(b).map(t => t.note)`, capped at 4 |
| `slide` | `approachTones[k] → shapeTones[k]` by `planeMotion` |

  The rule's own `voiceLeading` uses `nearestMotion`, which makes D♭maj7's C *hold* into Cmaj7. Planing is parallel, so the lesson uses positional motion, and PLAN 5a fixes the grid (the theory text, "every voice moves a semitone", is already right).
- **Headline:** "Slide into Cmaj7 with its own shape: Dmaj7 → D♭maj7 → Cmaj7, the whole hand moving together." (15 words)
- **Steps:**
  1. "Cmaj7's shape is C, E, G, B. Constant structure keeps that shape and moves it." · HL C, E, G, B · ▶ interval · T constant structure
  2. **ASK** "Move the whole shape up a half step. Tap D♭maj7." answer [Db, F, Ab, C] · text "Up a half step it's D♭maj7: D♭, F, A♭, C. Same shape, new root." · HL D♭, F, A♭, C
  3. "Slide down: D♭ to C, F to E, A♭ to G, C to B. Every voice moves together." (18 words) · HL C, E, G, B · ▶ after
  4. "Dmaj7 and D♭maj7 aren't in C major. The ear follows the moving shape and accepts them." · HL D, D♭, C · ▶ ab
- **Rule:** "Near the end of a chord, play the next chord's exact shape a half step above it and slide the whole hand down." (22 words)
- **Deeper:** "With room for two, start a whole step above, as here: Dmaj7, D♭maj7, then Cmaj7."

**chromatic.minorLineCliche** (context: Cm, 4 beats) *(5c)*
- **`MinorLineClicheLearn`:** `chord: symbol(chord)`, `root: r`, `third: transpose(r, "b3")`, `fifth: transpose(r, "5")`, `line`, `stops: chords.map(symbol)`.
- **Headline:** "Hold Cm and walk one inner voice down by half steps: C, B, B♭, A." (14 words)
- **Steps:**
  1. "Keep E♭ and G still: the minor triad's 3rd and 5th." · HL E♭, G · ▶ before
  2. **ASK** "Start on C. Tap the next three keys down by half steps." answer [B, Bb, A] · text "The root voice walks down by half steps: C, B, B♭, A. That's a line cliché." · HL C, B, B♭, A · ▶ after · T line cliché
  3. "Each stop renames the chord: Cm, Cm(maj7), Cm7, Cm6." · HL B maj7, B♭ 7, A 6 · ▶ ab
- **Rule:** "Over a long minor chord, hold the 3rd and 5th; walk the root voice down, inside or in the bass: 1, 7, ♭7, 6." (24 words, ⚠)
- **Deeper:** "Move the line to the top voice and it becomes a melody over a still chord."
- **Note:** `stops` are built with an added 9 (`mk(r, "m", …, ["9"])`), which may print "Cm(add9)" or "Cm9"; "Cm9" would contradict "Cm" in step 3. PLAN 5a checks `symbol()`; if it prints a 7th, the lesson renders the stops without extensions.

**melody.oneNoteOnTop** (changes-only context: Cmaj7 → Dm7 (4 beats) → G7; held D, walk A, A♭) *(5b)*
- **`OneNoteOnTopLearn`:**

| Field | Built from |
|---|---|
| `heldNote` | `T` |
| `fromMelody` | `fromMelody` |
| `original` | `symbol(chord)` |
| `target` | `symbol(next)` |
| `heldIn` | for changes-only, the degree of T in `chord` |
| `basses` | `basses` |
| `targetBass` | `target` |
| `walkChords` | `walk.map(symbol)` |
| `roles` | **degree codes**, not words (the `DEGREE_WORD` lookup moves out of `role()`) |
| `landing` | `landing?.degree ?? null` |

- **Headline:** "Hold D on top while the bass walks A, A♭, G: one note, a new colour on every beat." (17 words)
- **Steps:**
  1. "D is Dm7's root and G7's 5th: it can stay on top through the change." · HL D · ▶ before
     - With a melody: "The melody holds D, so keep it as the top voice."
  2. "Under it, the bass walks down by half steps: A, A♭, then G." · HL D top, A, A♭, G · ▶ after · P basics:extensions
  3. **ASK** "D is the ♯11 of one walk chord. Tap its bass." answer [Ab] · text "Over A, D is the sus 4th of A9sus4; over A♭, it's the ♯11 of A♭7(♯11)." · HL D, A, A♭
  4. "Into G7, D lands as the 5th. The top never moved; the colour under it did." · HL D, G · ▶ ab
- **Rule:** "Under a held top note, walk the bass down by half steps and build each chord to contain that note." (19 words)
- **Deeper:** "The interval from bass to top note suggests the chord: a half step above the bass gives 7(♭9), a tritone 7(♯11)."
- ⚠ **Hard on budget:** a 3-chord walk (chords of 6+ beats) has three roles, about 24 words in step 3. Split it: step 3 takes the first two roles, step 4 the third role plus the landing, and "never moved" moves into `deeper`.

### Budget flags

| Lesson | Problem |
|---|---|
| gospel | step 3 is 19 words with the twin; the target must match what the voices make |
| oneNoteOnTop | 3-chord walks |
| Coltrane | collapsing the hold run in step 3 |
| rootless | the rule is 24 words |
| mediant | the rule is 25 words, and the lesson uses 2 terms |
| minorLineCliche | the rule is 24 words |
| passingDiminished | separate up/down branches |
| upperStructureBVI | the common-tone list must be capped |
| basics:extensions | the rule is 25 words; 5 steps; 2 terms |

### Tests and proof
- **`learn.copy.test.ts`:** grow `BASICS` to all 10 (2i) and `SLICE` to all 17 rules (5b–5d). Every lesson's step 1 has a ▶ cue (2i). Add an edge case per new rule (ascending and descending passing °7; 2- and 3-chord walks for one note on top). Flip the `basicsLesson("basics:dim7")` null assertion (2i). The `facts: {}` assertion for upperStructureBVI stays valid.
- **New fast-check properties in 12 keys:**
  - the mediant's `respelled` pair has equal chroma
  - the Coltrane centres are 4 semitones apart
  - planed slides are all −1
  - dim tones never show double accidentals in display
- **`lessons-honest`:** extend to every lesson, plus a cheap `canonicalLesson` case (2j). Time `proofs.test.ts` after each addition.
- After 5b–5d: every rule (17) and every basics node (10) has a lesson.

---

## F. Rewriting `/api/explain`, and the dial labels *(PLAN 4a, 4c, 4d, 1b)*

### What `buildFacts` sends
- **Never** the raw `facts.learn` block. PLAN 2g destructures the top-level `learn` key off before the reviver (`explain.ts:69`) and pins a sha256 of the reference tritone sub's facts.
- From 4c: `lesson` (headline, step texts, rule), `pedagogy` (formula, whenToUse, bandstandCue), `prereqs` (names only), `glossary` (entries for the terms used).
- The cache key is sha256(`PROMPT_VERSION|MODEL|facts`). **4a also rolls it**, because the facts carry `draft: move.text` (`explain.ts:71`) and 4a changes `move.text`; 4a re-pins the 2g hash deliberately. 4a, 4c and 4d reach a push together under 4d's one `PROMPT_VERSION` bump, so keys roll once.

### Prompt outline (`apps/api/src/prompt.ts`; bump `PROMPT_VERSION` from `2026-11-11.1`)
1. **Role**, one paragraph, written in the target register. The task is to write the move card's Deep Dive for a player who has *already seen* the lesson's headline, steps and rule.
2. **Reader, with the reason attached.** "A strong player who knows chord symbols, ii–V–I, and the 3rd and 7th of any chord, but may not own this move's name. Overexplaining slows an experienced reader down, so state each idea once." One reader model; no `audience` field (decision 7).
3. **What you receive.** The current facts plus `lesson`, `pedagogy`, `prereqs` and `glossary`.
4. **Rules, all positive:**
   - Lead with what the ear gets.
   - Name at least two notes from the facts, spelled exactly.
   - Keep every sentence to 25 words or fewer, about 15 on average.
   - Summary: one sentence of 20 words or fewer, in the shape "Play X instead of Y. [payoff]".
   - Gloss at most two terms, using the supplied glossary's wording.
   - Use one metaphor family (magnetism, gravity or inertia), tied to a named note.
   - Describe a move by where it lands.
   - Encouragement states the result.
5. **The Deep Dive covers what the steps don't**, and must not restate them, because repeated text is the redundancy effect:
   - voicing and touch
   - the top-ranked scale and its guide-tone targets
   - where else the move works, by harmonic situation
   - when it fails against a melody
   - 100–180 words, in 2–3 paragraphs.
6. **recreateRule:** one imperative sentence of 25 words or fewer, in degrees and functions, with no note names. It may tighten `lesson.rule` but must agree with it.
7. **Accuracy rules:** as now, minus "do not define basic terms", which item 2 replaces.
8. **Four `<example>`s**, each a compressed `<facts>` block and an ideal output, varied in move type and length, inside the cached system block:
   - the tritone sub in F (C7 → G♭9 → F6)
   - the backdoor
   - Cmaj7 → C♯dim7 → Dm7
   - one note on top with `melodyVerified: false`: one brief line telling the player to check the move against the melody in their own lead sheet

Model (`claude-opus-5-5` via `EXPLAIN_MODEL`), effort, the fallback beta and `cache_control` are unchanged (CLAUDE.md §2 rule 2).

### Output validator (`apps/api/src/validateExplain.ts`)
Runs after the Zod parse.

| # | Check |
|---|---|
| 1 | Word and sentence caps: summary ≤ 20 words; any sentence ≤ 25; deepDive 100–180 words in 2–3 paragraphs; recreateRule is one sentence |
| 2 | No banned phrase (the copy test's regex, exported from theory-core and shared) |
| 3 | No markdown (`#`, `*`, `-` bullets) and no ASCII accidentals |
| 4 | Every note-name token is in the facts' note set as spelled; this catches respellings |
| 5 | deepDive names at least 2 fact notes |
| 6 | **Redundancy:** no run of 8 or more words in deepDive is shared with any lesson step |
| 7 | recreateRule contains no note names |
| 8 | If `melodyVerified` is false, "melody" appears; if true, there is no "check the melody" line |

- **On failure:** retry **at most once**, adding a user turn that lists the failed checks.
- **On a second failure:** serve the lesson-derived template text and don't cache it. Never loop.
- **Negative cache:** an in-memory map keyed by the cache key, with a TTL, records moves that failed validation twice; within the TTL they get the template at once, with no Claude call. Tested with a stubbed client and a fake clock.
- Log only in development (the API's dev flag), so the production console stays clean.
- Unit-test the validator on fixture outputs, and prove the single retry with a stubbed client. No network in tests.
- **No paid Claude call during development without Itai's explicit OK.** Demo Deep Dives are regenerated with `--template` only; Claude-written ones need his OK (decision 11).

### Level-dial labels (decision 2) *(PLAN 1b)*
**`L0 Original · L1 Inside · L2 Colour · L3 Bold · L4 Out`** (answered by Itai, 2026-11-20). The density moves into the tooltip, e.g. `L2 Colour: about 1 move per 4 bars`; phones keep showing only L0–L4.

Why these words:
- **They name how far from the written changes the move goes**, which is what the dial does together with `DENSITY`. They don't name a style the level doesn't contain: "Gospel" holds four modal moves; "Bebop" holds upper structures.
- **"Inside" and "out" are jazz vernacular** for the two ends of that scale, and they read correctly to an intermediate player.
- **L1 (Inside):** secondary dominants and ii–Vs stay inside the key's logic.
- **L2 (Colour):** tritone sub, upper structures, rootless voicings, passing °7 and the line cliché change colour more than function.
- **L3 (Bold):** borrowed and backdoor cadences, the mediant and the gospel slide redirect the arrival.
- **L4 (Out):** Coltrane, constant structure and one note on top leave the key or the voice-leading logic.
- The `L0`–`L4` prefixes that e2e asserts are kept. The words stay hidden below `sm`, as now.
- The `title` attribute becomes `L2 Colour: ${densityLabel}`.
- Rejected: "Mild … Extra hot" (cute, and close to the banned "spice up"); "Near/Far" (unclear without context).

---

## G. Open questions for Itai

Everything that needs Itai goes out in **one** message, `PLAN.md` "Gate 0", each item with a default. If he hasn't answered when a sub-phase needs one, the session proceeds on the default and notes it in the handoff. Only the hard stops (paid Claude calls, the og-card PNG re-render, the common-tone respelling) wait for an explicit yes.

**In Gate 0 (default in brackets):**
1. **Dial words:** Inside / Colour / Bold / Out, or your own? [these] *(1b)*
2. **Is Self-check the first *saved* rung?** Today self-checked runs are saved and scheduled; the alternative, an unsaved dry run, needs a new non-writing mode. [yes] *(3d)*
3. **Does finishing a lesson make a concept Familiar** (as `graph.ts` does now), or only "lesson done" until one clean key? [Familiar] *(3b)*
4. **Test-out details.** Listen only, two random keys, hard prerequisites only? [yes] *(3f)*
5. **Explanations default** for visitors: "Step by step", or "Just the rule" for the portfolio's 20-second look? [Step by step] *(3i)*
6. **"Recreate it" e2e:** keep the label, or change the assertion in 3g? [keep] *(3g)*
7. **Add `basics:sevenths` and `basics:numerals`** as optional tier-0 nodes? [add] *(2i)*
8. **Common-tone °7 spelling.** The engine builds Cdim7 as C E♭ G♭ B♭♭; "E♭ rises to E" sounds like a blue ♭3. Spell the leaning tones by direction, D♯/F♯ (symbol unchanged)? [D♯/F♯, teacher's advice; **hard stop**, since it changes golden tests] *(5c)*
9. **Demo "Erase runs"** also clears `reharm.lessons` and test-out flags? [yes] *(3b)*
10. **5f scope:** split by screen as listed? [yes] *(5f)*

**Hard stop outside the list:** og-card. `apps/web/scripts/og-card.html` says "11 rules" and "8 claims"; fixing it means re-rendering the OG PNG. *(flagged in 2g)*

**Resolved by the persona panel (pass 1):**
- `basics:dim7` is a **hard** prerequisite of the mediant dominant (teacher's advice; tritone sub becomes soft).
- Gospel voicing: the shown grip is LH D♭–C♭–F with the E♭ triad on top, resolving to Cmaj13.
- `basics:extensions` step 2: the natural 11 is an avoid note on a dominant; "raise it to C♯, or drop B and make it sus" covers the exception.

**Still open, with defaults (no need to ask):**
- **Coltrane centres:** keep the G♯/A♭ explanation in basics:symmetricOctave step 1; that lesson names the augmented triad. *(5b)*
- **Attributions** (Bill Evans, Shaun Martin): style tags only, not lesson text. *(5f)*
