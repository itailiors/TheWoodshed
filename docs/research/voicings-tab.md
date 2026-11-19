# Voicings tab: requirements synthesis (2026-11-19)

Source: seven role-play agents (Sonnet), run read-only. Roles: 2-month beginner (BEG), intermediate player (INT), new app user (NEW), jazz piano teacher (TCH), UI/UX designer (UX), product manager (PM), senior engineer (ENG). Claude merged their reports and checked every code claim against the repo. Tags after each item show who asked for it.

## 1. What the tab is

**A fifth mode, "Voicings",** after Changes. It's a shape library: "what are my options on this chord, and how do I get to the next one?"
- Coach drills a *move* in 12 keys; Voicings *explores and grades shapes*.
- A one-tap "Drill this in 12 keys" feeds the shape forward so the two don't duplicate each other. (UX, NEW, PM)

**Primary user:** the intermediate player moving from shells to rootless voicings. It's the least-served group and the best fit for the app's grade + 12-key + SM-2 loop. (PM, INT, TCH)

**Beginners get an on-ramp, not a separate product.** (BEG, PM)

**Pitch:** *Learn the grip, then hear it in the tune.* Books are static, YouTube can't listen, and iReal Pro comps but doesn't teach. (PM, INT)

## 2. Where everyone agrees (build these)

| # | Requirement | Asked by |
|---|---|---|
| 1 | One chord, big keyboard, notes lit and labelled within two clicks of entering; works silent and with no MIDI (on-screen keys + QWERTY) | BEG NEW UX PM |
| 2 | Hear it: block, then arpeggiated low→high | BEG INT UX |
| 3 | Play it, graded, with feedback that names the part that failed ("3rd missing", "one key too high"), never just "wrong" | BEG TCH UX INT |
| 4 | LH/RH split shown (colour *and* shape), degree labels (R 3 5 ♭7 9 13), guide tones ringed | UX PM TCH BEG |
| 5 | Style pills with a one-line plain description each (`VOICING_STYLES[].hint` already exists) | NEW UX BEG |
| 6 | ii–V–I voice leading: common tones held, 7→3 resolutions highlighted, step badges | TCH INT UX PM |
| 7 | Correct enharmonic spelling everywhere | INT (engine rule 3 already guarantees this) |
| 8 | The engine decides every pitch; no LLM in the loop; the demo build works and writes nothing | PM ENG TCH (arch rules 1, 2, 11) |

## 3. Conflicts and how they're resolved

**Jargon vs real names** (BEG wants plain names; NEW, INT and TCH want the real ones).
- Pills use the real names, each with a plain one-liner underneath.
- A "Start here" marker sits on Shells.
- On first load only Shells, Close and Drop 2 are visible; the rest are behind "More shapes". (UX)

**Strict vs forgiving grading** (TCH wants the exact shape; BEG and PM want octave freedom).
- Explore mode grades the pitch-class set + guide tones + top note, with octave freedom, and *names the shape you played* (`classifyVoicing`).
- Exact-position grading stays in the Coach drill. (UX, ENG)

**Tab vs fold into Coach** (PM raised it).
- A separate tab wins: NEW and UX both expected one, and Changes already set the precedent.
- To avoid overlap, use the "Explore" vs "Drill" wording.

**Band piano style in two places** (NEW).
- The band piano style keeps one source of truth, `bandFeel`.
- "Use for band piano" in the tab writes the same setting the mixer shows, and says so in a toast.

## 4. Engine reality check (ENG, verified by Claude)

**`drop2`/`drop3` today aren't the textbook forms.**
- They drop a voice from the *rootless* 4-note upper structure: Dm7 drop-2 = 3-7-9-5 over a root bass (`voicing.ts`, `candidates`).
- Textbook drop-2 of the plain seventh chord (R-3-5-7 forms) is not generated.

**Rootless A/B exist only as hand-written hints** on `voicing.rootlessTwoFiveOne` (`coach.ts:39`, `rules.ts:339`), not as a voicing style.

**Silent fallback.** `voiceChord` falls back to close with no flag, so a tab could label a close voicing "Quartal" (CmMaj7 quartal, for one).

**Hidden logic.** There's no way to list *all* forms or inversions of a style; `candidates`/`inversions`/`drop` are private, and `voiceChord` returns one voice-led pick.

**No annotation.** No per-note degree or hand metadata; `chordTones` has what's needed to add it.

**Grading.** `diffStrike` is pitch-class-only against one target (`coach.ts:347`). Its `BASS_SPLIT = 55` (`coach.ts:332`) would misread low shells (from MIDI 47) and drop voicings (from 48) as "bass + upper". The new grader must not reuse that split.

**History prefixes.** `ear:` handling is hard-coded in `App.tsx:324`, `CoachPage.tsx:152`, `PracticeDashboard.tsx:146-147` and `practice.ts:170`.
- A new `shape:` prefix would be treated as a reharm rule and open the wrong Coach drill.
- Needs a small prefix registry first.

**App wiring.**
- Band stop on entry: `App.tsx:476` only stops the band for `changes`.
- Mode list: `ModeSwitch.tsx:5`.
- Lazy page: next to `App.tsx:62`.

**Reusable:**
- Keyboards: `ImprovKeyboard` (playable stage), `PenKeyboard` (target/played/missing/wrong/labels/rings), `DoodleKeyboard` (mini diagrams).
- Input and grading: `useChordStrikes` (`minNotes` = 2 by default; repeats need a release), `useGradingMode`, `SelfCheckPanel`.
- Helpers: `voiceMotion`, `KeyPicker`, `FeedbackLine`.
- Persistence: `saveCoachRun`'s demo-aware path.

## 5. Teacher's content map (what the tab teaches, in order)

1. Shells + the guide-tone line (7→3 by half step) through ii–V–I. *Built:* `shell`.
2. Rootless Type A (3-5-7-9 / 7-9-3-13) and B (7-9-3-5 / 3-13-7-9), alternating A/B so the hand stays in one register. *Gap.*
3. Altered dominants (♭9 ♯9 ♭13 ♯11) and tritone-sub voicings. *Partly built* (alterations flow through every style).
4. Drop-2, then drop-3, under a melody note. *Built as rootless drops*, with `top` pinning.
5. Upper-structure triads (II/7, ♭VI/7alt, ♭III/7♯9). *Partly built:* `spread` finds triads; there's a Coach drill for the UST rule.
6. Quartal / So What / planing. *Built* (`quartal` + `plane`); So What as a fixed 4-4-4-3 shape is a gap.
7. Spread / 10ths, and Evans' rootless voicing with the 5th on the bottom. *Spread built*; the Evans form is a gap.
8. Gospel / Shaun Martin clusters and moving inner voices. *Later* (F4).

**Common mistakes to detect:**
- the root in the right hand's bottom voice;
- mud below about E3;
- a jump of more than 4 semitones in one voice;
- a missing 3rd or 7th;
- a natural 9 on an altered dominant;
- a stretch of more than a 10th in one hand.

## 6. Scope slices

**MVP: "Explore + play one chord / one ii–V–I"** (about 2 sessions). **Built 2026-11-19:** `voicingForms.ts` (`voicingForms`, `classifyVoicing`, `gradeShape`, `voiceLeadForms`) and `components/voicings/VoicingsPage.tsx`. On a phone, the ii–V–I is a one-row strip, and the keys dock at the bottom: only the notes in play (the bass is left off because grading treats it as optional), with Hear and Check on the bar. Not done yet: hand colour on the keys (the hands are shown as text for now).

*theory-core (test-first):*
- `voicingForms(chord, style)`: every form, annotated `{midi, degree, name, hand}`, with `fellBack`.
- `classifyVoicing(notes, chord)`: names the shape played.
- `gradeShape(played, form)`: `{valid, missing, extra, wrongShape, hint}`.
- Rootless A/B as a style.

*web:*
- `VoicingsPage` with the source picker (chord + key, or preset ii–V–I), style pills (3 visible + "More shapes"), and a stage keyboard with LH/RH colour, degrees and guide-tone rings.
- Hear (block / arpeggio); play it, graded through `useChordStrikes`.
- A Connect strip for the ii–V–I.

*Acceptance:*
1. Every quality × 12 keys × style renders an engine voicing (exhaustive test).
2. The keyboard, audio and grader read the same `Form`.
3. MIDI, on-screen keys and QWERTY all work, and every note-on gets a note-off.
4. Zero `/api` requests in the demo build.
5. `typecheck` and `test` pass.

**v2:**
- A `shape:<style>:<quality>` SM-2 history behind a prefix registry, plus a Passport section. **Built 2026-11-19:** theory-core `concepts.ts` (`CONCEPT_FAMILIES`, `conceptKind`, `conceptName`, `shapeRuleId`/`parseShapeRuleId`; alterations join with `+`, e.g. `shape:shell:7+b9`). The first clean voicing of each chord on the stage is filed under the chord's root with the wrong strikes before it as misses (chart `voicings`); the passport's "Voicings · shapes" section opens the tab on that chord, key and family.
- A 12-key drill weighted toward weak keys. **Built 2026-11-19:** theory-core `drillKeyOrder` (srs.ts) puts the 12 keys in the order due → weak (last grade < 4) → new → solid, with ties going round the circle of fifths from your key. "Drill 12 keys →" (one-chord source only) walks that order and files each key. A choice made by hand ends the drill, and the demo's sample notebook never sets the order.
- "Voice this" from a lead-sheet chord.
- "Voice the tune" in one style with the melody on top (INT's selling point).
- Hear-then-hide-then-play.
- Compare pins (up to 3).
- "Use for band piano".

**Visual polish (next):**
- **Guide-tone mark.** The mustard ring on the 3rd/7th is the same mark Coach uses for "a valid alternative", and it's easy to miss.
  - Give guide tones their own mark, e.g. an ink double ring or a filled watercolour wash on the key, plus a small legend.
  - Keep mustard for Coach's alternatives.
- **Hand colour on the keys** (spec §2 item 4): wash the left hand's notes brick and the right hand's blue, with a shape cue too (LH square tag, RH dot), so it isn't colour-only. Today the hands are only named in text.
- **Degree labels:** make the guide-tone labels (3, ♭7) bolder than the colour tones (9, 13), so the eye lands on the shell first.

**Later:**
- The voice-leading ghost (TCH's killer feature): replay your run against the minimal-motion path and show which change cost extra.
- Upper-structure, So What and Evans forms; clusters; block chords; F4 movers.
- A staff view; fingering / stretch warnings.

## 7. Don't build

- A chord-dictionary encyclopedia
- Video lessons
- Full notation engraving
- LLM-chosen voicings or grading
- Copied Open Studio exercises
- User-authored voicing libraries (for now)
- Acoustic audio input
- Streaks and badges (INT: "don't care")

## 8. Decisions (Itai, 2026-11-19)

1. **Drop-2/3: both, as forms.** Keep the rootless drop that the band plays, and add the textbook R-3-5-7 drop-2/3 inversions as selectable forms of the same style.
2. **Rootless A/B: forms of `close`,** not a new style. Close stays one mixer entry; the tab shows its A and B forms and an A/B-alternating ii–V–I.
3. **No practice history in the MVP.** Live grading only. The `shape:` prefix registry and Passport section come in v2.
4. **Primary user: intermediate.** Beginners get the 3-pill on-ramp.
5. **History counts the form, strictly.** Playing the right notes in another form of the same family (e.g. 3-♭7 when the stage shows ♭7-3) counts as a miss before the clean voicing. The live hint still names the shape you played.
