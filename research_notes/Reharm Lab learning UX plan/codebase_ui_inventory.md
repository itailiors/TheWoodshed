# Reharm Lab: current UI structure and information density, screen by screen (codebase inventory)

Scope: read-only inspection of the repo at `main` = `19ddf67` (session 13 handoff; last code commit `41f2dae`). No server was started and no page was rendered, so element counts below are **estimates from the JSX**, not measurements. Source links are repo-relative paths (root `C:/Users/itail/Documents/claude-projects/TheWoodshed`). Note: `docs/STATE_OF_THE_UNION.md` §1 file tree is stale (dated 2026-11-11; it lists 3 modes and 11 rules). The code now has 5 modes and 17 rules.

## 1. Top-level modes, routing, and what each screen shows by default

### Takeaway
There's no router. `App.tsx` switches on a `mode` state (`study | practice | coach | changes | voicings`, persisted in `localStorage["reharm.mode"]`) and returns a different full-screen tree for each. Progress (passport), Setlist (library) and Engine X-ray are right-side modal drawers that can only be opened from Study. Study is by far the densest screen: an estimated **70–90 interactive controls plus ~15 distinct text/visual blocks** on first load (desktop, demo build, Co-op Blues, L2). Several controls appear twice on the same screen.

### Cited Findings
**Routing and modes**
- `AppMode = "study" | "practice" | "coach" | "changes" | "voicings"`. The tab labels are Study / Practice / Coach / Changes / Voicings, and each has a long `title` tooltip ("The reharm engine: the lead sheet, the dial and the theory", and so on). — [ModeSwitch.tsx:3-13](apps/web/src/components/ModeSwitch.tsx)
- `ModeSwitch` always renders `ThemeSwitch` (a 3-option colour-scheme radiogroup) next to the tabs, so every screen header carries 5 tabs + 3 theme buttons. — [ModeSwitch.tsx:19-26](apps/web/src/components/ModeSwitch.tsx), [ThemeSwitch.tsx:12](apps/web/src/components/ThemeSwitch.tsx)
- How a mode is restored: the initial mode comes from `localStorage["reharm.mode"]`. An unknown value falls back to `study`. A deep link opens on Study unless the saved mode was Practice. — [App.tsx:277-287](apps/web/src/App.tsx)
- How a mode switch runs: `setMode` uses `document.startViewTransition` (skipped under reduced motion) and preloads the lazy chunk of the target screen. A 400 ms fallback commits the switch even if no frame renders. — [App.tsx:295-323](apps/web/src/App.tsx)
- `App` returns early for voicings, changes, coach and practice, each wrapped in `Suspense` (an "Inking…" placeholder) and, except Practice, a `PanelBoundary`. Anything else renders Study. — [App.tsx:515-588](apps/web/src/App.tsx)
- The band stops when you leave Study or Practice for any other tab. — [App.tsx:510-513](apps/web/src/App.tsx)
- Drawers (Setlist/`LibraryDrawer`, passport/`PracticeDashboard`, `EngineXRay`) render only inside the Study tree, each in a `PanelBoundary`. — [App.tsx:603-634](apps/web/src/App.tsx)
- The Study `SideRail` (desktop `lg+` only) has 5 sketch icons: Reharm Engine (active), Comping Coach, Play/Stop, My progress, Setlist. — [SideRail.tsx:59-84](apps/web/src/components/SideRail.tsx)
- "Ghost Master" is not a mode. It's a call-and-response trading feature inside the Improv heatmap (Study and Practice): a "🎷 Trade 2s / 4s" toggle, then an instrument (Sax/Piano) and a personality picker (`GHOST_PERSONALITIES`, credited to real players). — [PracticeMode.tsx:217-275](apps/web/src/components/practice/PracticeMode.tsx), [ImprovHeatmap.tsx:718-751](apps/web/src/components/practice/ImprovHeatmap.tsx)
- "Proof" is a tab inside the Engine X-ray drawer ("How it decided" | "Proof"), not a mode. — [EngineXRay.tsx:71-113](apps/web/src/components/xray/EngineXRay.tsx)
- "Library" is the Setlist drawer, opened by "📚 Setlist" or the rail icon. — [App.tsx:670-677](apps/web/src/App.tsx)

**Study first load (desktop ≥ lg, demo, reference tune Co-op Blues)**

The default dial level is **L2** (`PATHWAY_EDITOR_START = { level: 2, … }`). — [pathwayEditor.ts:37](packages/theory-core/src/pathwayEditor.ts)

At L2, Co-op Blues has **3 moves**: secondary ii–V @2.1, tritone sub @8.3, tritone sub @10.1. Move counts by level: L1 = 1, L3 = 4, L4 = 12. — [coopBlues.golden.test.ts:34-45](packages/theory-core/test/coopBlues.golden.test.ts)

The first move is **expanded by default**: `selected = pathway.find(selectedId) ?? pathway[0]`, and a card renders its full body when `selected`. — [App.tsx:203](apps/web/src/App.tsx), [MoveCard.tsx:81](apps/web/src/components/MoveCard.tsx)

What Study shows, region by region:

| Region | Default content | Source |
|---|---|---|
| Side rail | 5 icons | [SideRail.tsx](apps/web/src/components/SideRail.tsx) |
| Banner | Tune title (h1), meta line "composer · key · meter feel · N bars", "Reharm Lab" wordmark | [App.tsx:639-656](apps/web/src/App.tsx) |
| Toolbar | Demo badge (demo only), 📚 Setlist, 📒 Progress, 5 mode tabs + 3 theme buttons, 🔬 Engine X-ray, 🔗 Share, ⌨ ?, KeyPicker (↓ / key / ↑), LevelDial (5 radios "L0 Original … L4 Modern"), 🦶 "Link to mod wheel / pedal", Original/Reharm toggle (2) | [App.tsx:659-731](apps/web/src/App.tsx), [LevelDial.tsx](apps/web/src/components/LevelDial.tsx), [tokens.ts:58-64](apps/web/src/design/tokens.ts) |
| Lead sheet box | "Lead sheet" h2; TransportBar (Play, beat pulse, TrioMixer, tempo label + slider, VolumeMixer, Count-in picker, "Loop selected move", Connect MIDI, ⌨ QWERTY pill, MIDI-monitor toggle once connected); LeadSheet SVG (staff, key signature, melody, chord symbols, coloured move washes with lane-packed move names, playhead, loop shading); category legend; help paragraph ("Click a coloured wash to open its move. Flip Original/Reharm or turn the dial while it plays…"); OriginalStamp (original tunes only) | [App.tsx:735-800](apps/web/src/App.tsx), [TransportBar.tsx:41-137](apps/web/src/components/TransportBar.tsx), [LeadSheet.tsx](apps/web/src/components/LeadSheet.tsx) |
| Chord by chord | Heading, help line, ‹ chord / chord › buttons with an aria-live status, then one row per chord that has ≥1 accepted move. Each row is a chord-name button plus a dropdown trigger showing "<move> · dial / kept / your pick" | [ChordMoveSelector.tsx:107-176](apps/web/src/components/ChordMoveSelector.tsx) |
| Improv heatmap (Study too, not only Practice) | Heading; "Record my line" checkbox; 🎷 Trade 2s/4s; a **second VolumeMixer**; Clear; an instructions paragraph; the SVG tape; a 5-item verdict legend (chord tone / tension / avoid / outside / guide-tone landing); a `<details>` "No MIDI? Play on the keys here" | [App.tsx:827-829](apps/web/src/App.tsx), [ImprovHeatmap.tsx:683-965](apps/web/src/components/practice/ImprovHeatmap.tsx) |
| Right panel "Reharm & tricks" | h2; "3 moves · <density> (turn the dial up for more, or swap one in from 'Also works here')"; 3 MoveCards (1st expanded); ImprovCard for the selected move; "Considered & rejected" box listing **every** rejected move with its first reason | [App.tsx:844-901](apps/web/src/App.tsx) |

- `STATE_OF_THE_UNION` reports **15 rejections** on Co-op Blues. The golden test doesn't pin the count. — [STATE_OF_THE_UNION.md:229](docs/STATE_OF_THE_UNION.md)
- Both the Study TransportBar and the Study heatmap header render `VolumeMixer`, so Study has two master-volume controls. — [TransportBar.tsx:79](apps/web/src/components/TransportBar.tsx), [ImprovHeatmap.tsx:752](apps/web/src/components/practice/ImprovHeatmap.tsx)
- Narrow phones get partial folding: the TransportBar hides the band, count-in, loop and inputs behind "▾ Band & input"; the LeadSheet shows 2 bars per line; the ImprovCard moves under the heatmap. — [TransportBar.tsx:45-90](apps/web/src/components/TransportBar.tsx), [App.tsx:761, 831-840](apps/web/src/App.tsx)

**Practice** ([PracticeMode.tsx](apps/web/src/components/practice/PracticeMode.tsx)):
- Locked to `h-dvh`. Header: 5 mode tabs + 3 theme buttons, title, Play, beat pulse, ⛶ Improv, ♩ tempo, VolumeMixer, 🎷 Trade (+ Sax/Piano + personality chips when on), TrioMixer, Count-in, KeyPicker, LevelDial + pedal link, a view label, MIDI status, QWERTY or monitor toggle, and an inline shortcut legend at `xl` (12 entries) or a "⌨ Shortcuts" button.
- Body: LeadSheet (8-bar pages for long tunes) + ChordHUD on top; heatmap tape at the bottom; full-screen ImprovMode overlay (F).
- On phones the extras fold behind "▾ Band, key & dial".
- Sources: [PracticeMode.tsx:187-405](apps/web/src/components/practice/PracticeMode.tsx), [Shortcuts.tsx:20-33](apps/web/src/components/Shortcuts.tsx)

**Coach** ([CoachPage.tsx](apps/web/src/components/coach/CoachPage.tsx)):
- Three columns at lg (270 px | drill | 330 px).
- Header: mode tabs + themes, "Comping coach · <12-Key Concept Drill | tune>", Connect MIDI, QWERTY.
- Left rail: scope tabs "🎯 Concept Drill (12 Keys)" / "🎵 In Tune"; "Due for review" (up to 5); then either "All 17 Jazz Concepts" (a flat list: swatch, name, "L# · formula · n/12 clean") or the tune's moves grouped "In your reharm" / "Also found in this tune".
- Centre:
  - ‹ Prev / Next ›;
  - the 12-Key Circle Ribbon (3 flow buttons + "Next key →" + 12 key buttons);
  - CoachDrill: title, meta, a 3-way grading switch, the "💡 Why this works" card, the chord sequence, the instruction, the keyboard, red-pen comments, Hear chord / Hear move / Restart, 🔀 Random key, two checkboxes, and a footer paragraph.
- Right rail: "<rule> · passport", the formula · whenToUse, KeyMatrix (12 keys), footer.
- Estimated **60–80 interactive elements**.
- Sources: [CoachPage.tsx:158-504](apps/web/src/components/coach/CoachPage.tsx), [CoachDrill.tsx:290-531](apps/web/src/components/coach/CoachDrill.tsx)

**Changes** ([ChangesPage.tsx](apps/web/src/components/changes/ChangesPage.tsx)):
- A single centred `max-w-2xl` card. At idle: an optional "From your passport … Review it →" banner; an Intro paragraph; a "no keyboard?" hint; and SessionSetup (due-reviews note, 3 level cards with ✓ mastered / "next up", the mastery criterion text, stage selector Guided/Choices/Open, key select, Start).
- This is the **least dense and most scaffolded** screen.
- Sources: [ChangesPage.tsx:148-367](apps/web/src/components/changes/ChangesPage.tsx), [Controls.tsx:11-49](apps/web/src/components/changes/Controls.tsx)

**Voicings** ([VoicingsPage.tsx](apps/web/src/components/voicings/VoicingsPage.tsx)):
- A single `max-w-5xl` card.
- Source pills: One chord / ii–V–I major / ii–V–i minor / Voice the tune.
- Chord select, Key select, "Drill 12 keys →", "👂 Hear, hide, play".
- Style pills: only Shells (marked "· start here"), Close and Drop 2 show until "More shapes ▾".
- Then: a style hint line, the chord or progression cards, the form pills, the keyboard, an LH/RH + guide-tone line, actions, a feedback line.
- Sources: [VoicingsPage.tsx:95-96, 490-624](apps/web/src/components/voicings/VoicingsPage.tsx)

**Drawers**
- Passport (`PracticeDashboard`): "Today's practice" clipboard, "Passport pages" grouped by concept family with n/12 tabs, a KeyMatrix, and "Recent solos" sparkline. — [PracticeDashboard.tsx:92-274](apps/web/src/components/progress/PracticeDashboard.tsx)
- X-ray: bar stepper, "follow the playhead", the per-bar pipeline, the Proof tab. — [EngineXRay.tsx:52-118](apps/web/src/components/xray/EngineXRay.tsx)

### Inferences
- Study crams four jobs into one scroll: the engine showcase (dial, washes, X-ray), the theory reader (move cards, rejected list), the reharm editor (Chord by chord, picks, keeps) and soloing practice (heatmap, Ghost Master). A redesign can split by job or defer three of them behind progressive reveal.
- The duplicated controls are easy removals or refactors: a second VolumeMixer in Study; Trade/Ghost Master on Study (it belongs in Practice); a heatmap on both Study and Practice.
- The "Considered & rejected" list (~15 rows, always open) and the auto-expanded first move card are the largest text blocks at first load. Both are candidates for collapse-by-default.

### Gaps
- No rendered screenshot or DOM count was taken (constraint: no servers). Element counts are estimates from the JSX.
- The exact count of Chord-by-chord rows for Co-op Blues (chords with ≥1 accepted move) wasn't computed.

## 2. Study screen in detail

### Takeaway
A selected move card shows **up to 11 distinct blocks of text and controls at once**: title + meta, the chord route, a summary, a theory paragraph, melody-check chips, a voice-leading grid, a doodle keyboard, "Recreate it", an insight, two action buttons, a Deep Dive button, and "Also works here". On top of that, the ImprovCard and the "Considered & rejected" list sit in the same column. Chord by chord's dropdown options add formula + why + "Also replaces" + a red "Spicier than the dial" warning per option.

### Cited Findings
**What a move card shows**
- Collapsed card: a category swatch; the title "(Bar n)"; the line "Category · L# · style tags"; the struck-out original chords → new chords → target; and `move.text.summary`. — [MoveCard.tsx:44-79](apps/web/src/components/MoveCard.tsx)
- Expanded card (`selected`) adds, in order:
  - `move.text.theory`;
  - melody-check chips ("melody X = role ✓"), or a "⚠ no melody entered here" warning;
  - a "Voice leading" grid (from → to ±semitones);
  - a `DoodleKeyboard` of the voicing hint or last chord;
  - a "Recreate it" hachured box (`recreateRule`);
  - an optional 💡 `insight`;
  - "🎹 Practice this move" + "✍ Drill the voicing";
  - `DeepDive`;
  - "Also works here" alternative chips.
  - Source: [MoveCard.tsx:81-163](apps/web/src/components/MoveCard.tsx)
- `MoveText = { summary, theory, recreateRule, insight? }`. Rules also carry `RulePedagogy = { formula, whenToUse, whyItWorks, bandstandCue }`. — [types.ts:110-127](packages/theory-core/src/types.ts)
- All 17 rules define `pedagogy` (7 in rules.ts, 9 in rulesAdvanced.ts, 1 in rulesOneNote.ts; counted with grep).

**Deep Dive**
- It's a button until clicked.
- In the demo it reads the pre-written `apps/api/demo/explanations.json`, keyed by tune + move id, and falls back to the engine text.
- Live, it POSTs `/api/explain`. With no key it shows a "needs a Claude key" note.
- Once loaded: a bold summary, 150–260-word paragraphs, a "Rule of thumb", and a model credit.
- Sources: [DeepDive.tsx:17-114](apps/web/src/components/DeepDive.tsx), [demo.ts:26-39](apps/web/src/demo.ts)

**Levels**
- `LEVELS` = L0 Original, L1 Functional, L2 Bebop, L3 Gospel, L4 Modern. Each radio's tooltip adds `densityLabel`. — [tokens.ts:58-64](apps/web/src/design/tokens.ts), [LevelDial.tsx:45-68](apps/web/src/components/LevelDial.tsx)
- The 17 rules by level:
  - L1: secondary dominant; "Add the related ii" (a secondary ii–V variant).
  - L2: secondary ii–V, tritone sub, upper-structure triad, rootless ii–V–I, upper-structure II, passing °7, minor line cliché.
  - L3: gospel turnaround, backdoor ii–V, mediant dominant, ♭VI–♭VII–I, borrowed iv, common-tone °7.
  - L4: Coltrane, constant structure, one note on top.
  - Source: [rules.ts](packages/theory-core/src/rules.ts), [rulesAdvanced.ts](packages/theory-core/src/rulesAdvanced.ts), [rulesOneNote.ts](packages/theory-core/src/rulesOneNote.ts), [ruleset.ts](packages/theory-core/src/ruleset.ts)

**ChordMoveSelector ("Chord by chord")**
- Each row's dropdown (a listbox) offers three kinds of choice: "Let the dial decide" (with "Right now: X"); "As written: <chord>" (roman · function word); then every accepted move.
- Each move option shows: title, L#, the chord route, `formula · whyItWorks`, "Also replaces …", and a red "Spicier than the dial (L#): it goes in because you picked it."
- The native `title` tooltips repeat formula / why / "When to use".
- Source: [ChordMoveSelector.tsx:298-357](apps/web/src/components/ChordMoveSelector.tsx)
- Function words: `T` "home: the chord at rest", `PD` "pre-dominant: leads toward the V", `D` "tension: wants to resolve", and passing / chromatic / modal. — [ChordMoveSelector.tsx:15-22](apps/web/src/components/ChordMoveSelector.tsx)

**Right panel when the chord cursor is on a bare chord**
- `ChordFactsCard` replaces the move's ImprovCard. It shows "bar n · as written, no move here", the big chord, roman · function, degree/note pairs, and an ImprovCard. — [ChordFactsCard.tsx:13-40](apps/web/src/components/ChordFactsCard.tsx), [App.tsx:252-257, 858](apps/web/src/App.tsx)

**ImprovCard ("Improvising (right hand)")**
- Per chord: the top scale name, "from <parent> · why", a scale keyboard with guide tones accented, "Land on: X → Y", and "also: …" alternative scales. — [ImprovCard.tsx:7-49](apps/web/src/components/ImprovCard.tsx)

**Heatmap legend and intro on Study**
- Intro: "Play single-note lines over the loop … Each note is judged against the chord sounding at that moment. Older passes fade."
- Legend: 4 verdict shapes plus "guide-tone landing", and 4 more Ghost Master legend items when trading.
- Source: [ImprovHeatmap.tsx:766-936](apps/web/src/components/practice/ImprovHeatmap.tsx)

**Study shortcuts**
- 10 entries: Space; ← → moves; ⇧ ← → chords; ↑ ↓ dial; A; L; [ ]; , .; M; ?. Shown in a modal from ⌨ ? (hidden on touch-first devices). — [Shortcuts.tsx:7-18](apps/web/src/components/Shortcuts.tsx), [App.tsx:704-714](apps/web/src/App.tsx)

### Inferences
- The move card already holds a natural 3-tier reveal ladder:
  1. summary;
  2. theory + Recreate it;
  3. voice leading, keyboard, melody checks, Deep Dive and alternatives.
  
  Today tiers 1–3 all open together on selection.
- `RulePedagogy` (formula / whenToUse / whyItWorks / bandstandCue) is key-agnostic and already exists for every rule. That's ready-made copy for concept lessons. Note: the Coach shows `bandstandCue`; Study never does.

### Gaps
- The length of each rule's `theory` / `insight` text wasn't measured.

## 3. Coach, drills, Changes, by-ear, and where a concept-lessons flow could fit; existing onboarding and disclosure patterns

### Takeaway
There's **no onboarding, tutorial, first-run state or "seen" flag anywhere** in the web app. The closest patterns:
- **Changes:** an Intro paragraph, Guided→Choices→Open stages with auto-promotion, and "next up" / mastery text.
- **Voicings:** a "start here" marker and a "More shapes ▾" reveal.
- **Coach:** an ungraded "📖 Study it" mode and a `<details>` "Why this works" on phones.

The Coach's "All 17 Jazz Concepts" list (flat, ordered by rule priority, no prerequisites) is the most obvious home for a concept-lessons path.

### Cited Findings
**Coach**
- Grading switch: "🎹 Play it here / Listening to MIDI", "✋ Self-check", "📖 Study it". Study is "Nothing is graded here: see each chord on the keys, hear it, then step to the next." — [CoachDrill.tsx:348-349, 686-709](apps/web/src/components/coach/CoachDrill.tsx)
- The grading mode persists in `reharm.coachGrading`. — [gradingMode.ts:26](apps/web/src/components/coach/gradingMode.ts)
- Study-it mode adds `StudyNav` (‹ Last · chord n of N · Next ›) and `StudyNotes`: LH/RH notes with degrees, "From X: <voice motion>", and the step's role/whyHere cue. — [CoachDrill.tsx:612-684](apps/web/src/components/coach/CoachDrill.tsx)
- The "💡 Why this works" card shows formula, replaces, whyItWorks, When to use, Bandstand cue, "In <key>: summary", and the active step cue. It's always visible on desktop and folds into a `<details>` on phones. — [CoachDrill.tsx:304, 520-594](apps/web/src/components/coach/CoachDrill.tsx)
- The concept list renders `RULES` in array order (priority), labelled "All {RULES.length} Jazz Concepts", with "L# · formula · n/12 clean". There's no grouping, recommendation or lock. — [CoachPage.tsx:246-282](apps/web/src/components/coach/CoachPage.tsx)
- The empty "In Tune" state offers a link to switch to Concept Drill. — [CoachPage.tsx:283-290](apps/web/src/components/coach/CoachPage.tsx)
- `useDrillSession` is the shared web hook over theory-core `drillSession` (Coach and Voicings). It owns timers and saving, and the `byEar()` option tags shape runs. — [useDrillSession.ts:16-40](apps/web/src/practice/useDrillSession.ts)

**Changes ("Make the Changes")**
- The game is Levels 1–3: The Landing (all 12 keys), The Setup (C F B♭), The Staircase (C F B♭ E♭ G). Each has a written mastery criterion. — [ears/motions.ts:276-297](packages/theory-core/src/ears/motions.ts)
- The approved rules (memory note, 2026-11-18):
  - stages Guided → Choices → Open auto-promote after 8 right in a row, with Undo, and never demote;
  - all levels are open, with a "next up" marker;
  - there's no test-out in v1;
  - only Open answers feed SM-2, as `ear:<motion>`;
  - messaging is "harmony/function training with sound", not "ear training";
  - By Ear and timers are v2.
  - Source: [changes-game-decisions memory](C:/Users/itail/.claude/projects/C--Users-itail-Documents-claude-projects-TheWoodshed/memory/changes-game-decisions.md)
- The "next up" level is the first not yet mastered. Session history lives in IndexedDB in every build; Open answers go through `saveCoachRun` as `ear:*`. — [useChangesProgress.ts:23-34](apps/web/src/components/changes/useChangesProgress.ts), [practice.ts:146-151](apps/web/src/library/practice.ts)
- The Intro copy: "You're on a chord. Play or pick the root it wants to go to next, hear the move, and learn why it works…" — [ChangesPage.tsx:356-367](apps/web/src/components/changes/ChangesPage.tsx)

**By-ear**
- Voicings has a "👂 Hear, hide, play" toggle. `coach_attempts.by_ear` was added in migration 0003, but no UI shows it yet. — [VoicingsPage.tsx:568-580](apps/web/src/components/voicings/VoicingsPage.tsx), [schema.ts:99-100](apps/api/src/db/schema.ts), [HANDOFF.md:13, 24](docs/HANDOFF.md)

**Disclosure patterns that exist**

| Pattern | Where | Source |
|---|---|---|
| `<details>` | Coach "Why this works" (phones only); heatmap "No MIDI? Play on the keys here" | [CoachDrill.tsx:522](apps/web/src/components/coach/CoachDrill.tsx), [ImprovHeatmap.tsx:961](apps/web/src/components/practice/ImprovHeatmap.tsx) |
| "More" toggles | TransportBar "▾ Band & input" (narrow); Practice "▾ Band, key & dial" (cramped); Voicings "More shapes ▾"; VolumeMixer "Advanced" popover | [TransportBar.tsx:81-90](apps/web/src/components/TransportBar.tsx), [PracticeMode.tsx:276-285](apps/web/src/components/practice/PracticeMode.tsx), [VoicingsPage.tsx:620-622](apps/web/src/components/voicings/VoicingsPage.tsx) |
| Native `title` tooltips | Everywhere (mode tabs, level radios, pedal link, chord options). The only tooltip mechanism; no custom popover component | — |
| Dismissible inline note | Voicings "Voice the tune" on a no-melody chart (✕); Toaster | [VoicingsPage.tsx:583-597](apps/web/src/components/voicings/VoicingsPage.tsx) |
| Empty states | Passport "No stamps yet. Open a move's ✍ Drill the voicing…"; "Nothing due…"; "No solo passes yet…"; Study L0 "Level 0 shows the tune as written. Turn the dial up…" | [PracticeDashboard.tsx:131-134, 200-203, 240-241](apps/web/src/components/progress/PracticeDashboard.tsx), [App.tsx:860-862](apps/web/src/App.tsx) |
| A "seen"/onboarding flag | **None.** A grep for onboard / tutorial / first-run / welcome / walkthrough / seen in `apps/web/src` finds only the deep-link comment calling a link "onboarding" | [deepLink.ts:6](apps/web/src/deepLink.ts) |

### Inferences
Two ways a concept-lessons flow could fit:
- **A new screen or tab state** that reuses Coach "Study it" (ungraded chord-by-chord), the "Why this works" card, then "Hear the move", then graded Play. The Changes Guided→Choices→Open ladder is the house precedent for scaffolded stages with auto-promotion and Undo.
- **A path layer over the Coach's concept list**: grouping, recommended order and "next up" markers, mirroring `useChangesProgress.nextUp`.

The Changes decisions (all levels open + a "next up" marker, never demote, no test-out in v1) amount to Itai already choosing **soft guidance over hard locks**. A redesign should probably follow that unless he reverses it.

### Gaps
- There's no written spec for a "concept lessons" flow in the repo docs. The only curriculum design is in the out-of-repo strategy doc (see §7).

## 4. Disclosure and state primitives available to a redesign

### Takeaway
State is plain React state in `App.tsx`, plus a pure theory-core reducer for the pathway, plus ~20 `localStorage` keys and one IndexedDB store. There's no global store or router. Demo-mode rules forbid any `/api` call or write in the static build, but IndexedDB writes are allowed and already used.

### Cited Findings
**Pathway, cursor, deep link**
- `usePathwayEditor` wraps theory-core `editPathway`, a pure reducer over `{level, picks, kept, selectedId}`. Its events: dial, pedal, pick, keep, release, select, link, newTune. — [pathwayEditor.ts:37-45](packages/theory-core/src/pathwayEditor.ts), [App.tsx:192-226](apps/web/src/App.tsx)
- The chord cursor is separate React state, not in the deep link (Itai's decision). — [HANDOFF.md:31](docs/HANDOFF.md)
- Deep link params: `tune key level move pick keep tempo play`. The address bar syncs via a debounced `replaceState`, and 🔗 Share copies it with `play=1`. The doc comment calls the link "onboarding (open the demo straight onto a turned-up dial)". — [deepLink.ts:3-32](apps/web/src/deepLink.ts), [App.tsx:425-463](apps/web/src/App.tsx)

**localStorage keys** (from a grep of `apps/web/src`):

| Group | Keys |
|---|---|
| Tune and mode | `reharm.tune`, `reharm.tune.title`, `reharm.key:<tuneId>`, `reharm.mode` |
| Audio and band | `reharm.mixer`, `reharm.countIn`, `reharm.masterVolume`, `reharm.channelVolumes`, `reharm.swing`, `reharm.bandStyle`, `reharm.voicingStyle` |
| Look | `reharm.theme` |
| Input | `reharm.qwerty`, `reharm.pedal`, `reharm.midiMonitor` |
| Per-screen settings | `reharm.coachGrading`, `reharm.changes`, `reharm.voicings`, `reharm.improvView`, `reharm.improvOctaves` |

Sources: [App.tsx:87-114, 279](apps/web/src/App.tsx), [bandFeel.ts:10-12](apps/web/src/audio/bandFeel.ts), [themes.ts:49](apps/web/src/design/themes.ts), [VoicingsPage.tsx:98](apps/web/src/components/voicings/VoicingsPage.tsx)

**IndexedDB, boundaries, transitions**
- IndexedDB `reharm-practice` has stores for reviews, attempts, improv and changes sessions. — [localPractice.ts:23, 130-136](apps/web/src/library/localPractice.ts)
- `PanelBoundary` is a class error boundary showing "This panel hit a wrong note." with a Close that calls `onClose`. — [PanelBoundary.tsx:13-47](apps/web/src/components/PanelBoundary.tsx)
- View transitions: `view-transition-name` `lead-sheet` and `tune-title` are shared by the Study, Practice and Coach frames. — [App.tsx:642, 736](apps/web/src/App.tsx), [CoachPage.tsx:163, 441](apps/web/src/components/coach/CoachPage.tsx)

**Demo constraints**
- `DEMO` = `VITE_DEMO_MODE`. The static build makes zero `/api` requests; practice history goes to the browser adapter (IndexedDB) with a seeded sample notebook (`demoHistory.json`) until the first run, and the sample must always be labelled. — [demo.ts:3-8](apps/web/src/demo.ts), [practice.ts:125-127](apps/web/src/library/practice.ts), CLAUDE.md §2 rule 11
- The passport shows a red "Sample notebook: three weeks of a made-up player's practice…" notice. — [PracticeDashboard.tsx:103-108](apps/web/src/components/progress/PracticeDashboard.tsx)

**e2e tests assert visible text**
- Examples: "Demo · saves in this browser", "Lead sheet", "Level 0 shows the tune as written.", the `^\d+ moves? · ` line, "Reharm & tricks", "Make the Changes", "Where does it want to go?", the "How much help" group, `Start`. Renaming or hiding these breaks `npm run e2e`. — [e2e/golden.spec.ts:9-122](e2e/golden.spec.ts)

### Inferences
- Onboarding or "seen" state fits the existing pattern of `reharm.*` localStorage keys, wrapped in try/catch like `store` in App.tsx. A per-concept "lesson completed" state could live in the IndexedDB store, which works in the demo too.
- Any hide/reveal redesign of Study must keep the e2e locators, or update them in the same change.

### Gaps
- Not checked: whether `LibraryDrawer` uses the same right-sheet shell as the passport and X-ray. Not read.

## 5. Progress, passport and history data: can it drive "recommended first" soft-locks?

### Takeaway
Mastery is tracked as SM-2 state per `(ruleId, keyTonic)` for three concept families (reharm rules, `ear:<motion>`, `shape:<style>:<quality>`), plus raw coach attempts and improv-run summaries. It's enough to compute per-concept "clean keys / attempts / due / last grade" and to drive a "next up" recommendation. But there's **no prerequisite graph and no mastery threshold** beyond "a key is clean after one clean run" (Changes levels excepted).

### Cited Findings
**Database tables**
- `practice_sessions`: mode `coach | improv`.
- `coach_attempts`: ruleId, keyTonic, clean, misses, leaps, gradedBy `engine | self`, byEar, grade 0–5.
- `improv_runs`: chord-tone / tension / avoid / outside %, guide-tone landings, held avoid notes.
- `concept_reviews`: PK (ruleId, keyTonic); reps, ease, intervalDays, dueAt, attempts, cleanRuns, lastGrade.
- Source: [schema.ts:58-153](apps/api/src/db/schema.ts)

**Grading and scheduling**
- Grades: 5 clean and smooth, 4 clean with a leap, 3 one miss, 2 a few misses, 1 struggled.
- Schedule: a miss comes back in 10 min; then 1 day, then 3 days, then interval × ease (min 1.3).
- `drillKeyOrder` puts keys in the order due → weak → new → solid.
- Source: [srs.ts:30-91](packages/theory-core/src/srs.ts)

**Progress summary and families**
- `summariseProgress` returns `{concepts, places, cleanKeys, due, recentImprov}`. A key is clean once it has a clean run. It's shared by the API and the demo. — [srs.ts:165-218](packages/theory-core/src/srs.ts)
- `CONCEPT_FAMILIES`: reharm (no prefix), `ear:` ("Changes · the harmony game"), `shape:` ("Voicings · shapes"). `conceptKind` routes "Practise →" to Coach, Changes or Voicings. — [concepts.ts:30-39](packages/theory-core/src/concepts.ts), [App.tsx:352-379](apps/web/src/App.tsx)

**Existing mastery and "next up" logic**
- Only in Changes (`masteryProgress` per level, with `nextUp` = the first unmastered level). — [useChangesProgress.ts:23-34](apps/web/src/components/changes/useChangesProgress.ts)
- No `prereq` / `requires` / `dependsOn` exists in theory-core (grep, no hits).

**Plans and real data**
- The strategy doc lists as not built: a "guided curriculum… no skill graph, unlock order or placement test". It plans "a skill unlocks when its prerequisites reach the mastery threshold; at most ~10 new items/day" and interleaving of ~70% reviews / ~30% new. — [04-the-woodshed.md:33, 334-335](C:/Users/itail/Documents/claude-projects/research/04-the-woodshed.md)
- Itai's real database at the session-13 migration held 3 tunes, 14 sessions, 8 attempts, 60 improv runs and 8 reviews. A recommendation engine must handle a near-empty history. — [HANDOFF.md:16](docs/HANDOFF.md)

### Inferences
- "Recommended first" is implementable from existing data: rule level (L1–L4) + `cleanKeys[ruleId].length` + `due`. That yields a per-rule state of new / in progress / clean-in-N-keys / due. Soft-lock as a *visual* order and "next up" marker, not a gate, matches the Changes precedent.
- A prerequisite map (e.g. secondary dominant → secondary ii–V → tritone sub → backdoor) would be new theory-core data. The CLAUDE.md architecture puts such pure data in theory-core.
- Today a single clean run stamps a key, which is weak evidence of mastery. Any "unlock" threshold needs a design decision. The strategy doc proposes ≥ 90% over the last 20 attempts.

### Gaps
- `KeyMatrix` and `localPractice.ts` internals weren't read in full.
- Not determined: whether the passport tracks Coach "Study it" (ungraded) views. It appears it doesn't: only finished runs are filed.

## 6. Design-system constraints a redesign must respect

### Takeaway
It's a "living lead sheet" hand-drawn system: parchment paper, Blue-Note-style ink, watercolour washes, red teacher's pen. Rough.js primitives use stable seeds, there are three fonts with fixed roles, and the pill and colour conventions encode state and meaning. Lazy-loading boundaries, a11y hooks and the demo/LLM rules are architectural, not cosmetic.

### Cited Findings
**Tokens** (Tailwind v4 `@theme` in `index.css`, mirrored in `design/tokens.ts`):

| Token family | Values |
|---|---|
| Paper | `#f6e9c9` / light `#fbf3df` / shade `#ead7aa` |
| Ink | `#1e2a78` / soft `#3e4c9e` / faint `#8a93c4` |
| Washes | blue `#5b85c2`, mustard `#e3b23c`, brick `#b9532f`, sage `#7e9c6b` |
| Pen | `#c2311f` |
| sage-ink | `#4a6a3a`, added for Changes "right" answers |
| Piano keys | separate `key-white` / `key-black` tokens, so a dark theme can't invert the keyboard |

Sources: [STATE_OF_THE_UNION.md:140-144](docs/STATE_OF_THE_UNION.md), [tokens.ts:11-23](apps/web/src/design/tokens.ts)

**Fonts and primitives**
- Fonts: Kalam (`font-marker`) for headings, chords and buttons; Architects Daughter (`font-hand`) for body; Noto Music (`font-music`) for ♭ ♯ 𝄞 (the marker font has no accidentals). — [STATE_OF_THE_UNION.md:145-148](docs/STATE_OF_THE_UNION.md)
- Primitives: `useRough(ref, draw, deps)` with `seedOf(id)`; `SketchBox`, `SketchRule`, `SketchFilters` (`#ink-wobble`, `#watercolor`); hand-authored SVG uses `stroke="currentColor"` + `filter="url(#ink-wobble)"`. — [STATE_OF_THE_UNION.md:149-151](docs/STATE_OF_THE_UNION.md)

**Visual language and colour meaning**
- Red pen = corrections, verdicts, CLEAN stamp, the "Sample notebook" notice.
- Ink over a dashed ghost = now vs. before.
- Watercolour wash = achieved or active.
- Pills: solid ink border when on, dashed `ink-soft` when off.
- Source: [STATE_OF_THE_UNION.md:152-156](docs/STATE_OF_THE_UNION.md)
- Categories: functional = mustard, dominant-sub/symmetric = blue, gospel = brick, voicing/modal = sage.
- Heatmap: chord tone blue, tension mustard, avoid pen-red, outside ink-faint. Verdicts also have shapes (● ◇ ✕ △) for colour-blind users.
- Source: [STATE_OF_THE_UNION.md:157-159](docs/STATE_OF_THE_UNION.md), [ImprovHeatmap.tsx:824](apps/web/src/components/practice/ImprovHeatmap.tsx)

**Themes, lazy loading, layout, motion and a11y**
- Themes: colour schemes (Northgate, Panam) via a 3-way theme slider. — [git log b97392c](https://github.com/itailiors/TheWoodshed/commit/b97392c), [ThemeSwitch.tsx](apps/web/src/components/ThemeSwitch.tsx)
- Lazy loading: Tone.js, Rough.js and every non-Study screen or drawer are `lazyWithPreload`. fast-check lives only in the proofs worker. Demo-only data is dynamically imported. — [STATE_OF_THE_UNION.md:160-164](docs/STATE_OF_THE_UNION.md), [App.tsx:67-74](apps/web/src/App.tsx)
- Layout: Study two columns from lg (`minmax(0,1fr) 420px`); Practice locked to h-dvh; Coach three columns (270 | drill | 330); drawers are right-side sheets, Esc closes. — [STATE_OF_THE_UNION.md:165-169](docs/STATE_OF_THE_UNION.md), [App.tsx:733](apps/web/src/App.tsx)
- Motion and a11y:
  - reduced motion disables animations and view transitions;
  - `aria-live` on the Coach prompt, captions, toasts and the bar picker;
  - `data-midi` / `data-target` on keys;
  - focus rings;
  - `scroll-padding` on scrollers;
  - lead-sheet moves are Tab stops, but chord symbols deliberately are not (45 extra stops would bury the moves).
  - Source: [STATE_OF_THE_UNION.md:170-173](docs/STATE_OF_THE_UNION.md), [HANDOFF.md:14, 30](docs/HANDOFF.md)

**Architectural limits (CLAUDE.md §2)**
- The LLM never computes notes, and theory-core decides every pitch.
- Demo mode spends nothing and writes nothing to a server.
- Seeded data is never presented as real.
- The production console stays clean.
- Every input source must release its notes.
- Source: root `CLAUDE.md` §2 rules 1, 2, 11, 13, 14

### Inferences
- New lesson or onboarding UI should be built from `SketchBox` cards, pill buttons (solid = on, dashed = off), red pen for verdicts or "you are here", and a mustard/sage wash for "done". A "locked/recommended" visual needs a new convention. The dashed-ghost "before" style is the nearest existing idiom.
- Any lesson content must come from theory-core (`RulePedagogy`, `MoveText`) or pre-written demo files, never live LLM calls in the demo.

### Gaps
- `index.css` keyframes and the theme definitions weren't read in detail.

## 7. Prior UX/onboarding plans and already-decided scope

### Takeaway
No in-repo document plans onboarding or a learning flow for Study.

Prior signals:
- the Voicings requirements doc's "Beginners get an on-ramp, not a separate product" (built as start-here + 3 visible shapes);
- the Changes decisions (scaffolded stages, soft "next up", no test-out);
- the out-of-repo strategy doc's "curriculum layer" priority (unlock order + placement test);
- the handoff's next task: a **wording pass** to make every phrase plainer.

### Cited Findings
**Recent work (git log)**
- The last ~60 commits are feature and refactor work: Make the Changes steps 1–10, the Voicings tab, deep links, Study shortcuts, the chord cursor, Playwright e2e, the heatmap colour-blind shapes. None mentions onboarding. — `git log --oneline -60` (read-only)

**Next steps already agreed**
- Next: "Wording pass (Itai's next task): make every phrase in the app plainer and more understandable. Re-run `npm run e2e` (golden tests assert visible text)…" — [HANDOFF.md:23](docs/HANDOFF.md)
- Leftovers: a small leak in Voicings "Start the X on:" while hidden; show `by_ear` somewhere (passport or history); a code review of `49a75d6..41f2dae`. — [HANDOFF.md:24](docs/HANDOFF.md)

**Voicings tab requirements doc**
- Primary user: the intermediate player moving from shells to rootless.
- "Beginners get an on-ramp, not a separate product."
- Real names with plain one-liners, a "Start here" marker on Shells, only Shells / Close / Drop 2 visible on first load.
- Source: [voicings-tab.md:11-35, 158](docs/research/voicings-tab.md)

**Open Studio research**
- It lists curriculum-style ideas that echo progressive reveal: a "progressive reharm layer slider" (Diatonic → Secondary V7 → … → Tritone sub), a "three-tier progressive unlock mode" for voicings, and a "Circle-Back Progression Expander". — [open-studio-digest.md:101, 372, 422](docs/research/open-studio-digest.md)

**Strategy doc (outside the repo)**
- Priority 4: "A curriculum over the existing concepts: an unlock order and a placement test… so the passport becomes a path."
- Skill graph Levels 0–11, with Levels 0–8 as "the gap a curriculum would fill".
- An experiment row: "Onboarding placement test vs. start at the passport".
- It's partly stale: it says the demo saves nothing, but the demo now saves to IndexedDB.
- Source: [04-the-woodshed.md:33, 56, 223, 403](C:/Users/itail/Documents/claude-projects/research/04-the-woodshed.md), [woodshed-strategy-vs-code memory](C:/Users/itail/.claude/projects/C--Users-itail-Documents-claude-projects-TheWoodshed/memory/woodshed-strategy-vs-code.md)

**Open decisions (unresolved per memory)**
1. Portfolio vs. paid product.
2. Public name Reharm Lab vs. The Woodshed.
3. Real musicians' names (the Ghost Master personalities credit real players).

Source: [woodshed-strategy-vs-code memory](C:/Users/itail/.claude/projects/C--Users-itail-Documents-claude-projects-TheWoodshed/memory/woodshed-strategy-vs-code.md), [04-the-woodshed.md:47-50](C:/Users/itail/Documents/claude-projects/research/04-the-woodshed.md)

**Product positioning and audience**
- The current phase is a public portfolio launch for hiring managers, and only the static demo ships. — [STATE_OF_THE_UNION.md:8](docs/STATE_OF_THE_UNION.md)
- The user is an advanced jazz pianist ("skip basic theory definitions"). — root `CLAUDE.md` §0

**Notion backlog (memory snapshot, 2026-11-19)**
- Open items include "easier reharm switching", "Standard of the Day", two-hand voicings, and more songs. — [notion-woodshed-page memory](C:/Users/itail/.claude/projects/C--Users-itail-Documents-claude-projects-TheWoodshed/memory/notion-woodshed-page.md)

### Inferences
- There are two audiences, and a learning-UX plan has to serve both:
  - hiring-manager visitors to the static demo: first-run clarity, a 20-second wow, Engine X-ray and proofs;
  - Itai himself, an advanced player: dense information is fine but should be on demand.
  
  That argues for progressive reveal with a fast path to "show everything", rather than hard locks.
- The wording pass already agreed in the handoff overlaps any copy-reduction recommendation. A report should sequence the two (hide/reveal first, then the wording pass, or together), because both touch e2e-asserted text.

### Gaps
- The Notion page wasn't re-read (memory snapshot only). Itai may have newer onboarding notes there.
- No user testing or analytics exist in the repo to show which Study elements are actually used.
