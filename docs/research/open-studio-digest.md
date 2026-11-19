# Open Studio PDF digest (2026-11-19)

A per-PDF digest of all 15 PDFs in Itai's **openstudio** Drive folder, kept as a research base. For what Reharm Lab should build from them, see `open-studio-ideas.md` (items A1–E). This file is the raw material behind that list.

**How it was made:** Antigravity (Gemini 4 Hydrogen) read every page and wrote one digest per PDF. Claude reviewed each digest, fixed one typo and generalised one transcribed exercise. Each digest's "Ideas for a reharm/practice app" bullets are Gemini's suggestions; none of them have been checked against the engine. Before building anything from them, grep `ruleset.ts` and `git log`, as `CLAUDE.md` §0 says.

**Rights:** every source is © Open Studio (or its artists). Like `open-studio-ideas.md`, this file restates **concepts** in our own words. No exercises, notated voicings or melodies are copied. The chord progressions are given only as Roman-numeral analysis, and none of this text may go into the repo as app content.

## Index

| # | PDF | Author | Pages | Already mined in `open-studio-ideas.md`? |
| --- | --- | --- | --- | --- |
| 1 | The Harmony Games (workbook v1.1) | Adam Maness | 19 | Yes (A1–A7, B4, C) |
| 2 | The Family (Harmony Games game 1) | Adam Maness | 3 | Yes (A1) |
| 3 | Sugar Chords | Adam Maness | 1 | Yes (B3) |
| 4 | All The Things You Are: lead sheet, ATTYA MVP, Worksheet 14 | Peter Martin | 8 | Partly: E and D's guide-tone drill. Worksheet 14 (LH/RH rhythm levels) is new. |
| 5 | Jazz Piano Basics Vol 1: Lead Sheet Breakdown | Adam Maness | 12 | Yes (A6, D) |
| 6 | Jazz Piano Basics Vol 2: Left Hand Voicings | Adam Maness | 16 | No |
| 7 | Genius Chord Warmups | Adam Maness | 100 | No |
| 8 | Jazz Chords for Beginners | Adam Maness | 9 | No |
| 9 | The Major Scale Course | Adam Maness | 40 | No |
| 10 | Jazz Glossary | Adam Maness | 31 | No |
| 11 | Open During Construction | Geoffrey Keezer | 193 | No. These are ensemble scores and transcribed solos, not a workbook. |
| 12 | Jazz Scales for Beginners | Adam Maness | 9 | No |
| 13 | Jazz Piano Jump-Start | Adam Maness & Peter Martin | 65 | No |

## New leads (not yet in `open-studio-ideas.md`)
Claude's cross-reading of the unmined PDFs (6–13 and Worksheet 14). These leads have since been checked against the code. The verified, ranked list is section **F** of `open-studio-ideas.md`; several items below turned out to be built already.

- **Voicing styles beyond B1:**
  - LH quartal stacks planed through the parent mode (§6);
  - close clusters with a 2nd rub (§6);
  - the 10th-spread texture: a LH 10th under a RH triad (§7);
  - drop-4 (§7);
  - two-hand 2+2 rootless A/B splits (§8).
- **Inner-voice "movers":** on a held chord, a guide tone walks: 7–♯6–6 on major, 3–♭3–3 or 3–4–3 on dominants, and the minor line cliché (§6). This could be a band or voicing option for chords that last 4+ beats.
- **"Mu" approach chords:** a first-inversion add2 chord whose bass sits a half step below the secondary ii, placed before every secondary ii–V (§7). It extends A3 (`slashConnector`). §7 also covers the escalation ladder: diatonic → V7 → V7/3rd → add2/3rd → secondary ii–V → mu-ii–V → ♭II9♯11. That ladder maps onto the L1–L4 pathway.
- **"The Mountain":** a practice mode that starts from I–V7–I and prepends one more step of the cycle of fifths on each clean loop (§7).
- **Hand-independence matrix:** 6 LH rhythm levels (half notes, Charleston, dotted-quarter 3-against-4, 2 & 4, and so on) crossed with 4 RH levels (chords → melody → riffs with space → lines) (§4, Worksheet 14). It's a candidate Practice/Coach ladder next to D's texture ladder.
- **"Gravity" line cells:** pickups on the V7 that target the next chord's 3rd. Each is drilled 4 ways (scale up/down, arpeggio up/down) from each chord tone (§12). The line evaluator could grade them.
- **Dominant scale colours:** Mixolydian, Phrygian dominant (VI7 → ii), H/W diminished, Lydian dominant and altered (§10, §12). They line up with A1's plain/sus/alt colour axis.
- **Avoid-tone table per chord quality (§8):** cross-check it against the melody filter's avoid notes.
- **Non-functional cycles and static top over a moving bass (§11, Keezer):** maj7♯11, 9sus4 and m9 chords linked by minor-third, tritone and half-step root motion. This is what A7 (`oneNoteOnTop`) does, taken further.
- **Blues:** ♭VII7 in bar 11 (*Freddie Freeloader*), and the 7-note blues scale with both ♭3 and 3 (§13).
- **Content and UX:**
  - glossary tooltips (§10);
  - a 12-key cycling scheduler weighted toward weak keys (§9);
  - a 7-pass "listening with purpose" checklist (§13);
  - a swing slider (already built in d505bfe) plus four syncopation cells for comping rhythms (§13).

---

## §1 · The Harmony Games
**Source file:** The-Harmony-Games-Workbook-v1.1.pdf · 19 pages
**What it is:** Adam Maness's intermediate-to-advanced jazz/gospel piano workbook teaching nine harmonic "games" (voice-leading, chord substitution, pedal-point reharmonization, and inner-voice movement).

**Curriculum sequence:**
1. **The Family** — Diminished-seventh symmetry generating four minor-third-related dominant substitutes (`V7`, `bVII7`, `bII7`, `III7`) across plain, `sus4`, and `alt` colors.
2. **Backing Up The Circle** — Progressive expansion of `I -> IV -> vi -> V7sus4` by inserting secondary dominants, secondary `ii-V`s, and chromatic/inverted passing chords.
3. **Cush Chords** — Paired diatonic and parallel-minor/modal-interchange 4-bar phrases using `add2` inversions and `bVI–bVII` resolutions.
4. **Timeless Chords** — Six harmonic/bass-line paths into the classic `I -> IV -> I/5 -> V7` gospel/standard cadence.
5. **Heart Melter Chords** — Tonic-pedal oscillations (`IV/1`, `iv/1`, `V/1`, `v/1`) practiced in alternating close and open textures.
6. **One Note On Top** — Holding a static upper-structure voicing while cycling a chromatic/diatonic bass line underneath to hear shifting harmonic functions.
7. **Chord Connectors** — Voice-leading connection study revisiting the paired diatonic/modal-interchange progressions from Game 3.
8. **Hinging** — Pivoting individual chord tones (`R`, `3`, `5`) within a `1-3-5-7` RH voicing—first as static shapes, then as active rhythmic motion, and finally in Drop-2.
9. **Going Home** — Three cadential exits (`bVII -> IV -> I`, `II9 -> V9 -> I`, `bVI -> bVII -> I`) returning to tonic after `I -> viiø7 -> III7 -> vi`.

**Core concepts:**
- **Diminished dominant family:** Lowering any one note of `vii°7` by a half step yields one of four dominant 7ths a minor third apart (`V7`, `bVII7`, `bII7`, `III7`). Used in `IV -> [dom] -> I` cadences across `7`, `7sus4`, and `7alt` qualities to swap between standard, tritone, backdoor, and chromatic-mediant resolutions.
- **Circle-of-fifths "backing up":** Any diatonic target (`IV`, `vi`, `V`) can be preceded by its own `V7` (`I7 -> IV`, `III7 -> vi`, `II7 -> V7sus4`), then expanded to a full secondary `ii-V` (`v7 - I7 -> IV`, `viiø7 - III7 -> vi`, `vi7 - II7 -> V7sus4`), and finally linked with first-inversion passing chords (`II7/#4`, `#IV(add2)/#6`) and `bVII9` chromatic approach before `vi7`.
- **Parallel-minor phrase answering (modal interchange):** Balancing a diatonic phrase (`ii7 - iii7 - IVmaj7 - V7sus4` or `I -> [ii/IV - V7/IV] -> IVmaj7`) with its parallel-minor / `bVI`-area mirror (`iv7 - v7 - bVImaj7 - bVII7sus4` or `I -> [ii/bVI - V7/bVI] -> bVImaj7`), or answering `I - vi - IV - V` with `I - i - bVI - bVII`.
- **Approach paths to `I/5 -> V7`:** Bridging `I` to `IV` (or `iv`) and into the `I/5` cadential 6/4 via: ascending chromatic passing (`I - I/3 - IV - #iv°7`), diatonic `ii7 - I/3 - IV`, `ii7 - iii°7 - IV6`, minor-borrowed `iiø7 - iii°7 - iv6`, `iv6/1 - vii°7 - iv6/b6` pedal/inversion exchange, or a chromatic `bVI7/b3 - bII/4 - bVI/b5` chain.
- **Tonic-pedal upper-structure triads:** Keeping `1` in the bass under `IV`, `iv`, `V`, and `v` triads creates major-11/6, minor-major/borrowed, `maj9`, and `9sus4` colors without changing the root.
- **Static-top bass recontextualization:** Holding a fixed `I`, `Imaj7`, or `V/1` shape in the RH over a bass that walks up and back down through diatonic and chromatic degrees turns one voicing into slash chords, `m11`s, altered dominants, and `maj7#11`s.
- **Chord-tone hinging:** Treating one tone of a `1-3-5-7` voicing as a movable pivot (`R -> 7`, `3 -> 9`, `5 -> 13/#5`) creates built-in inner-voice counterpoint and melodic comping over `I - IV7 - iii7 - VI7 - ii7 - V7`.
- **Three cadential exits ("Going Home"):** Following `I -> viiø7 -> III7 -> vi`, returning to `I` via double plagal (`bVII -> IV -> I`), double dominant (`II9 -> V9 -> I`), or Aeolian modal interchange (`bVI -> bVII -> I`).

**Practice methods / drills:**
- **Looped key cycling:** Most games use 2- to 4-bar repeat loops transposed across 2–4 flat-side keys (`C`, `F`, `Bb`, `Eb`), with Circle-of-Fifths diagrams provided as a mental map for transposing to all 12 keys.
- **Quality-variant cycling:** Practicing a single cadence (`IV -> dom -> I`) consecutively through `7`, `7sus4`, and `7alt` before shifting to the next family member.
- **Staged layering:** Building complexity in passes—first the bare skeleton, then secondary dominants, then `ii-V`s, then chromatic inversions; or first static hinged voicings, then rhythmic inner-voice motion, then Drop-2.
- **Texture alternation:** Practicing pedal-point oscillations in alternating close-position keys (`C`, `Bb`) and open-position keys (`F`, `Eb`) to internalize both tight and spread hand shapes.
- **Ear-training via static top note:** Looping a 4-bar wandering bass line under one unchanging RH triad/`maj7` to hear how bass motion alone redefines chord quality.

**Voicing & texture ideas:**
- **RH 4-note close `1-3-5-7` + Drop-2:** Start with `1-3-5-7` in RH over LH root; for Drop-2, drop the second-highest voice (`5` or `3`) to the LH alongside the bass/5th to open the middle register and free the top voice for hinged melodies.
- **Altered dominant shells:** Pair LH root + `7` (or `3`) with RH altered upper structures (`3-b13-b9` or `7-#9-b13`) that resolve by half step into `I(add2)`/`6/9` shapes.
- **Close vs. open pedal voicings:** Close voicings keep RH triads (`1-3-5` inversions) tight in the middle staff over a single LH bass note; open voicings spread LH roots/5ths (or 10ths) under wider RH intervals/octave-doubled triads.
- **Register discipline:** Keep RH close voicings and hinged shapes centered around middle C–C5 so inner-voice half-step hinges (`R-7`, `3-9`, `5-13`) speak clearly without muddying the LH bass (C2–G3).

**Tunes / progressions referenced:**
- No named jazz standards are cited; exercises use classic functional progressions:
  - `IV -> [V7 / bVII7 / bII7 / III7] -> I`
  - `I -> IV -> vi -> V7sus4` (expanded with secondary `ii-V`s)
  - `I -> IV -> I/5 -> V7` (gospel/standard cadence)
  - `I -> IV7 -> iii7 -> VI7 -> ii7 -> V7 -> I -> V7` (rhythm-changes/turnaround variant)
  - `I -> viiø7 -> III7 -> vi` followed by plagal, dominant, or modal-interchange exits

**Ideas for a reharm/practice app:**
- **Diminished-Family Dominant Swapper:** Highlight any `V7 -> I` in a progression and let the user audition its 3 minor-third-related siblings (`bVII7`, `bII7`, `III7`) with a toggle for `7` / `7sus4` / `7alt` voicings.
- **Circle-Back Progression Expander:** A slider (Levels 1–4) that progressively expands a user's diatonic loop (`I - IV - vi - V`) into secondary dominants, secondary `ii-V`s, and chromatic passing inversions.
- **Hinge Generator & Drop-2 Toggle:** Given a `1-3-5-7` voicing sequence, let the user select which chord tone (`R`, `3`, or `5`) to hinge rhythmically, with a one-click Drop-2 split between LH and RH.
- **One-Note-On-Top Bass Explorer:** Lock a user-chosen RH chord shape (`I`, `Imaj7`, `V/1`) and step through all 12 bass notes, displaying the resulting chord symbol/function and ear-training prompt.
- **Going-Home Cadence Picker:** After any tonic-to-`vi` departure (`I - viiø7 -> III7 -> vi`), offer instant 2-chord exit templates: Double Plagal (`bVII -> IV`), Double Dominant (`II9 -> V9`), or Modal Interchange (`bVI -> bVII`).

---

## §2 · The Family
**Source file:** 1-The-Family-The-Harmony-Games.pdf · 3 pages
**What it is:** Adam Maness (Open Studio), intermediate-to-advanced jazz harmony/reharmonization drill sheet deriving and practicing the four minor-third-related dominant substitutions ("The Family") in `IV -> Dom -> I` cadences.

**Curriculum sequence:**
- Establish the tonic-resolving diminished 7th chord (`vii°7 -> I`) as the shared harmonic parent.
- Derive the four dominant 7th chords of the family by lowering each of the four diminished-7th chord tones by a half step (`V7`, `III7`, `bII7`, `bVII7`).
- Drill all four family dominants inside a repeating `IV -> [Dom] -> I` cadence in C major using plain `x7` voicings.
- Expand the same four `IV -> [Dom] -> I` cadences into `x7(sus4)` and `x7alt.` colors in C major.
- Transpose the complete 12-loop battery (`x7`, `x7(sus4)`, `x7alt.` across all four family roots) to Eb major.

**Core concepts:**
- **Diminished-to-dominant derivation (`vii°7 -> V7 / bVII7 / bII7 / III7`):** Lowering any single voice of `vii°7` by a semitone turns that voice into the root of a dominant 7th chord while the remaining three tones act as its `3–5–b7` shell. Used to generate four functionally interchangeable dominant chords sharing the same diminished symmetry.
- **Primary dominant (`IV -> V7 -> I`):** Standard authentic cadence; provides the baseline functional resolution.
- **Backdoor dominant (`IV -> bVII7 -> I`):** Dominant built a whole step below tonic; shares `IV` minor-like/subdominant color and resolves upward by whole step for a warm, gospel-inflected or modal-jazz cadence.
- **Tritone substitution (`IV -> bII7 -> I`):** Dominant a half step above tonic; preserves the `3`/`7` tritone of `V7` while creating chromatic bass motion (`bII -> I`) with tense, modern resolution.
- **Mediant dominant (`IV -> III7 -> I`):** Dominant on the major third above tonic; introduces the `#5`/`b13` and `3` of the tonic's relative/parallel color, yielding a bright, unexpected deceptive-turned-authentic pull into `I`.
- **Quality variants (`x7`, `x7(sus4)`, `x7alt.`):** Applying suspended (`11` replacing `3`) or altered (`b9/#9`, `#11/b13`) tensions across all four family roots keeps the upper-structure voice leading nearly identical while shifting bass gravity.

**Practice methods / drills:**
- Loop each `IV -> [Dom] -> I` cadence as a 2-bar vamp (2 beats on `IV`, 2 beats on the dominant, 1 bar on `I`) so the ear internalizes each root's pull before moving to the next family member.
- Cycle systematically through all four roots in ascending minor thirds (`V7`, `bVII7`, `bII7`, `III7`) rather than practicing substitutions in isolation.
- Run the full 4-root cycle through three harmonic qualities (`x7`, `x7(sus4)`, `x7alt.`) in one key, then transpose to a new key (demonstrated in C and Eb).

**Voicing & texture ideas:**
- **Compact 3-note RH shells over LH roots:** `IV` is voiced as a 3-note upper shell (`3–5–7`, creating a `IVmaj7` sonority) that voice-leads by step or common tone into 3-note dominant shells (`1–3–b7`, `b7–3–5`, or `3–b7–9`) and settles onto `I` (`5–1–3` or `3–5–7`).
- **Sus4 upper structures:** On `x7(sus4)`, the RH keeps a tight 3-note triad/quartal shape (`b7–11–5` or `11–5–b7`) that minimizes hand movement from `IV` and into `I`.
- **Altered textures:** `x7alt.` expands to 4-note RH shapes (`3–b13–b7–b9` / `b7–#9–3–b13` structures) and occasionally adds `5` or `b7` in the LH (around `Bb2–Ab3`) for thicker root-position weight, resolving to `Imaj7` or `I6/9`.
- **Register:** Keep LH roots in the `C2–Eb3` range and RH shells centered around `F3–Ab4` so voice-leading continuity remains audible across all four substitutions.

**Tunes / progressions referenced:**
- `vii°7 -> I` (diminished resolution)
- `IV -> V7 -> I`, `IV -> bVII7 -> I`, `IV -> bII7 -> I`, `IV -> III7 -> I` (in C major and Eb major)

**Ideas for a reharm/practice app:**
- **Diminished-Family Reharm Wheel:** Given any `V7` (or `vii°7`), highlight its four minor-third-related dominant siblings (`V7`, `bVII7`, `bII7`, `III7`) and let the user audition each in a `IV -> [Dom] -> I` loop.
- **Voice-Leading Continuity Visualizer:** Show how a single 3-note `vii°7` / `IVmaj7` upper structure stays nearly stationary while only the bass note jumps by minor thirds across the four family dominants.
- **Quality Toggle Matrix:** Pair the 4 family roots with a 3-way quality selector (`7`, `7sus4`, `7alt`) to generate 12-loop practice batteries in any chosen key or random key cycle.
- **Ear-Training Blind Cadence Drill:** Play `IV -> [random family dominant] -> I` and ask the user to identify whether the dominant root was `V`, `bVII`, `bII`, or `III` (and its quality: plain, `sus4`, or `alt`).

---

## §3 · Sugar Chords
**Source file:** Sugar+Chords+(Adam+Maness-Open+Studio).pdf · 1 page
**What it is:** A one-page Guided Practice Session sheet by Adam Maness (intermediate-to-advanced jazz piano) demonstrating Barry Harris 6th-diminished chord-scale harmonization voiced through closed, drop-2, drop-3, and mixed four-note textures.

**Curriculum sequence:**
1. Reference templates for a major-9th (`3-5-7-9`) voicing over a bass root in Closed, Drop-2, and Drop-3 configurations.
2. Lead-sheet melody and harmonic blueprint for a four-bar `ii7 -> V7 -> I` phrase using 6th-diminished (`6/Dim`) parent scales.
3. Full four-voice harmonization of that phrase in Closed position.
4. Re-voicing the same harmonization in Drop-2.
5. Re-voicing the same harmonization in Drop-3.
6. Combining Drop-2 and Drop-3 shapes ("Mixed") for smoother voice leading and register balance.

**Core concepts:**
- **Relative major `6/Dim` over `ii7`:** Function: diatonic `ii7` substitution/harmonization. Formula: `bIII6/Dim` over `ii7` (e.g., `Ab6/Dim` over `Fm7` in Eb). Used on minor-7th `ii` chords to harmonize passing melody notes with alternating 6th and diminished-7th chords. Sound/effect: lush, moving inner-voice counterpoint that turns a static `ii7` into a fluid chord-scale.
- **Half-step-above minor `6/Dim` over `V7`:** Function: altered dominant harmonization. Formula: `bii6/Dim` (or `bvi6/Dim` relative to `I`) over `V7` (e.g., `Bm6/Dim` over `Bb7` in Eb). Used on altered `V7` chords resolving to `I`. Sound/effect: supplies altered tensions (`b9`, `#5`/`b13`, `3`, `7`) while preserving smooth diminished-scale step-wise motion into the tonic.
- **Tonic `I6/Dim`:** Function: tonic major resolution. Formula: `I6/Dim` over `I`. Used on tonic major chords to allow melodic motion without losing harmonic clarity. Sound/effect: warm, classic bebop/swing tonic color.

**Voicing & texture ideas:**
- **Closed position (`3-5-7-9` over root):** Root anchored in the LH; all four upper-structure chord tones stacked within an octave in the RH. Best when the melody sits comfortably in the middle-upper register and the LH only needs to hold the bass.
- **Drop-2:** Take the second voice from the top of the four-note closed chord (e.g., the `7` in `3-5-7-9`) and drop it an octave into the LH alongside/above the root, leaving three voices (`3-5-9`) in the RH. Creates an open, resonant spread and activates a moving tenor/baritone line in the LH.
- **Drop-3:** Take the third voice from the top (e.g., the `5` in `3-5-7-9`) and drop it an octave into the LH, leaving `3-7-9` in the RH. Produces a wide, transparent shell-like spread with a strong guide-tone frame in the RH.
- **Mixed (Drop-2 + Drop-3):** Alternate between Drop-2 and Drop-3 shapes chord-by-chord across a phrase rather than locking into a single drop rule. Keeps the dropped LH voice in a smooth, singable register (roughly tenor/alto range) and avoids awkward leaps or muddiness in the low end.

**Tunes / progressions referenced:**
- "On Green Dolphin Street" (bars 9–12: `ii7 -> V7 -> I` turnaround)

**Ideas for a reharm/practice app:**
- **6/Dim scale mapper for `ii-V-I`:** Automatically map `ii7` -> `bIII6/Dim`, `V7` -> `bii6/Dim` (altered), and `I` -> `I6/Dim`, then harmonize any user-entered or generated melody note-for-note with alternating 6th and diminished-7th chords.
- **One-click voicing transformer (Closed / Drop-2 / Drop-3 / Mixed):** Given any four-note upper-structure chord stream, render and play back all three fixed drop modes plus an automated "Mixed" mode that chooses Drop-2 vs. Drop-3 per chord to minimize LH voice-leading distance and respect a user-set lower register limit.
- **Side-by-side texture comparison:** Let the user loop a four-bar `ii-V-I` and toggle between Closed, Drop-2, Drop-3, and Mixed in real time to hear how the inner-voice counterpoint and bass-to-tenor spacing change.

---

## §4 · All The Things You Are materials

**Source file:** `ATTYA-MVP.pdf` (1 page), `All-The-Things-You-Are.pdf` (1 page), `PDF-Worksheet-14.pdf` (6 pages) · 8 pages total

**What it is:** Intermediate-to-advanced jazz piano materials from Peter Martin's *Jazz Piano Method* (Open Studio), combining a 36-bar standard lead sheet, a minimalist two-handed shell-voicing map for "All The Things You Are," and a 6-level left-hand/right-hand rhythmic independence curriculum demonstrated over an "Autumn Leaves"-style progression.

**Curriculum sequence:**
1. **Lead-sheet melody & harmonic roadmap (`All-The-Things-You-Are.pdf`):** Internalize the 36-bar melody and multi-key modulation structure as guide-tone anchors before adding complex voicings.
2. **Minimalist two-handed voicing map (`ATTYA-MVP.pdf`):** Voice the entire 36-bar form using 3-note (and occasional 4-note) open shells (`1-3-7` / `1-7-3`) with smooth inner-voice leading.
3. **Left-hand rhythmic independence (`PDF-Worksheet-14.pdf`, LH Levels 1–6):** Anchor whole-note four-note voicings in the right hand while cycling the left hand through six progressively syncopated bass patterns: half notes (1 & 3) → Charleston → alternating 2-bar half notes / 2-bar dotted quarters → continuous dotted quarters → displaced half notes (2 & 4) → modified Charleston (1, &-of-2, 4).
4. **Right-hand independence & improvisation (`PDF-Worksheet-14.pdf`, RH Levels 1–4):** Layer the LH rhythmic patterns underneath RH whole-note chords → melody → riff-based soloing (short motifs with space) → continuous eighth-note/triplet straight-ahead improvisation.

**Core concepts:**
- **Diatonic `vi–ii–V–I–IV` cycle with chromatic mediant pivot (ATTYA A1, bars 1–8):** `vi7 -> ii7 -> V7 -> Imaj7 -> IVmaj7` in the home key (I = Ab), then pivots directly to `V7 -> Imaj7` in the chromatic mediant key a major third up (III). Creates an expansive, singing modulation where the `IVmaj7` of the home key acts as a smooth harmonic springboard into the new `V7`.
- **Sequential transposition up a fifth & modal-mixture `iiø7–V7` (ATTYA A2, bars 9–16):** Repeats the `vi7 -> ii7 -> V7 -> Imaj7 -> IVmaj7` gesture transposed up a fifth (key of V), then uses a half-diminished `iiø7 -> V7(b9)` borrowed from parallel minor to resolve to a major `Imaj7` in the global `VII` key area (a half step below the home tonic). Gives a bittersweet minor-to-major surprise resolution.
- **Bridge `ii–V–I` chain down a minor third + `V7alt` turnaround (ATTYA B, bars 17–24):** `ii7 -> V7 -> Imaj7` in `VII`, shifting down a minor third to `ii7 -> V7 -> Imaj7` in `bVI` (enharmonic major), followed by a single-bar `V7(b13/#9)` functioning as `V7/vi` (or `V7/i` of the starting minor seventh). Bridges two distant major keys via symmetric minor-third root motion before snapping back to the home key's `vi7`.
- **Parallel minor subdominant & chromatic passing diminished turnaround (ATTYA C, bars 25–36):** Restates `vi7 -> ii7 -> V7 -> Imaj7 -> IVmaj7` in the home key, then drops `IVmaj7 -> ivm7` (modal interchange) into `iii7 -> bIII°7 -> ii7 -> V7 -> Imaj7`, closing with a `viiø7 -> III7` (`iiø7–V7/vi`) turnaround. The `IVmaj7 -> ivm7 -> iii7 -> bIII°7 -> ii7` chromatic bass/inner-line descent creates classic Golden-Age standard poignancy.
- **Guide-tone melody alignment:** In ATTYA, structural melody notes land on 3rds and 7ths of the underlying chords on strong beats, turning the melody itself into an ear-training map for every modulation.
- **Dotted-quarter cross-rhythm (`3-against-4`):** Playing continuous dotted-quarter bass notes against steady 4/4 RH voicings or melody trains internal pulse independence across barlines without losing the form.

**Practice methods / drills:**
- **Progressive rhythmic matrix (RH × LH):** Pair one RH texture (whole-note voicings, melody, riff-based soloing, or continuous lines) with one LH rhythmic level at a time; master the simplest LH (half notes on 1 & 3) before advancing to syncopated displaced half notes (2 & 4) and dotted-quarter cycles.
- **Alternating stability and syncopation (LH Level 3):** Practice 2 bars of grounded half-note time followed immediately by 2 bars of dotted-quarter syncopation to feel the tension/release of leaving and returning to the downbeat.
- **Riff-with-space improvisation (RH Level 3):** Improvise short, 1-to-2-beat rhythmic motifs separated by deliberate rests over steady LH half notes before attempting continuous eighth-note lines (RH Level 4).
- **Shell-first tune learning:** Play through a modulating standard using only root + 3rd + 7th in whole/half notes so harmonic guide tones and key-center shifts are internalized before adding upper extensions or busy comping.

**Voicing & texture ideas:**
- **Minimalist two-handed open shells (`ATTYA-MVP.pdf`):** Bass root in the LH (low-to-mid register) paired with `3-7` or `7-3` distributed across LH thumb and RH—typically `1-7-3` or `1-3-7` spanning a 10th to a 12th. Keeps the middle register uncluttered and highlights every modulation.
- **Selective altered color tones on dominants:** Keep major/minor seventh chords as pure `1-3-7` shells, adding `b9` or `b13` in the upper voice only on secondary/altered dominants (`V7(b9)`, `V7(b13)`), and using half-note harmonic rhythm for the `IVmaj7 -> ivm7` and `viiø7 -> III7` turnarounds.
- **Four-note rootless/close RH voicings (`PDF-Worksheet-14.pdf`):** Compact 4-note RH voicings (`3-5-7-9` / `7-9-3-5` and `3-b7-b9-13` / `1-3-5-b7` shapes depending on register) held as whole notes in the middle staff (`C4–G5`) while the LH plays independent rhythmic bass lines (`G2–G3`) using roots, 5ths, and chromatic/diatonic passing tones.

**Tunes / progressions referenced:**
- **"All The Things You Are" (Jerome Kern):** 36-bar `A1 (8) – A2 (8) – B (8) – C (12)` form traversing key areas `I` → `III` → `V` → `VII` → `bVI` → `I`.
- **"Autumn Leaves"-style 8-bar progression:** `ii7 -> V7 -> Imaj7 -> IVmaj7 -> iiø7/vi -> V7(b9)/vi -> vi7` (in major/relative minor), used as the vehicle for all 6 LH and 4 RH hand-independence levels.

**Ideas for a reharm/practice app:**
- **Key-area & pivot visualizer for ATTYA:** Color-code each bar of a 36-bar grid by local key center (`I`, `III`, `V`, `VII`, `bVI`) and highlight pivot chords (`IVmaj7` acting as springboard to `V7/III`, `V7alt` turnaround) so users can practice soloing by key area rather than chord-by-chord.
- **MVP Shell-Voicing Trainer:** A mode that strips any standard down to `1-3-7` / `1-7-3` two-hand shells with voice-leading distance scoring, prompting the user to add `b9`/`b13` only on designated altered dominants.
- **Hand-Independence Rhythm Matrix:** An interactive 2D practice grid (`RH Mode` × `LH Rhythm Level 1–6`) that generates an accompaniment/metronome track or MIDI guide for any 8-bar `ii–V–I–IV–iiø–V7–i` loop, unlocking continuous dotted-quarter and displaced `2 & 4` bass patterns progressively.
- **Riff-Space Metronome:** For RH Level 3, display visual "play / rest" windows (e.g., 2 beats on, 6 beats off) over the chord changes to enforce rhythmic phrasing and prevent continuous noodling.

---

## §5 · Jazz Piano Basics Vol. 1: Lead Sheet Breakdown
**Source file:** Jazz-Piano-Basics-Vol-1-Lead-Sheet-Breakdown.pdf · 12 pages
**What it is:** Adam Maness (Open Studio), beginner-to-intermediate solo/combo jazz piano guide on auditing stock lead sheets against original scores, layering basic textures, weaving in counter-melodies, and applying simple arrangement and reharmonization devices.

**Curriculum sequence:**
1. Auditing *Real Book* / fake-book charts against original scores and recordings, choosing piano-friendly keys, and assembling a custom lead sheet.
2. Layering a basic solo texture incrementally: root + melody -> two-feel bass -> rhythmic Root+Shell LH -> "Three-Zone connect" (adding upper extensions in RH).
3. Adding counter-melodies: borrowing from original orchestrations, surrounding target bass/inner notes, maintaining a quarter-note ballad pulse, and rolling bass arpeggios.
4. Personalizing arrangements: deriving thematic intros/outros from late-form tune material (with quality and meter shifts), adding rhythmic hits, and applying tritone and `#ivø7` substitutions.

**Core concepts:**
- **Source-score verification:** Stock lead sheets often garble composer intent. Cross-checking against original piano reductions/recordings recovers essential counter-lines and bass pedals (e.g., replacing a clunky `iii7 - I - iii7 - iii°7` bar in *Over the Rainbow* with the original descending counter-melody into `I7`, or restoring the `i6 - V7` bass oscillation in *Summertime* instead of a generic `i - bII7` sketch).
- **Incremental texture layering (Root + Shell -> Three-Zone Connect):** Build solo piano accompaniment from minimal root + melody, then add a two-feel, then break LH chords into syncopated Root + 3rd/7th shells, and finally fill the middle register in the RH under the melody with color tones (5, 9, 11, 13).
- **Target-note surrounding:** Over static harmony (e.g., `IV6/9`), pick a target chord tone in the LH/inner voice (such as the 6th) and approach it with stepwise/neighbor motion to create contrapuntal movement.
- **Quarter-note ballad pulse & bass arpeggiation:** Sustain steady quarter-note inner-voice or bass motion on ballads to establish pulse without a rhythm section, or roll up from the root through strong chord tones between changes.
- **Thematic intros/outros from late-form material:** Borrow a recognizable progression from near the end of the tune (such as the chromatic walk-down `iii7 - bIII7 - ii7 - bII7` in *Autumn Leaves*) and repurpose it as an intro/outro with upgraded chord qualities (`m11`, `7alt`, `Δ9`, slash-bass inversions) and metric displacement (recasting the 4/4 walk-down into 3/4 for the outro) to create unity with novelty.
- **Rhythmic hits:** Place coordinated syncopated accents (e.g., anticipated `&` of 2 or beat 4 hits across `ii - V - I` cadences) so a solo arrangement or rhythm section pops.
- **Tritone substitution on dominant (`V7` -> `bII7#11`):** Substitute `bII7(#11)` for `V7` (e.g., `Bb7#11` replacing `E7` on a beat-2 hit at the end of *Summertime* in A minor) for chromatic bass resolution (`bII -> i`) and heightened tension.
- **`#ivø7` (`bVø7`) lead-in to `iv` / `IV`:** In a `I -> IV` (or `I -> iv`) move where the melody sits on the key's tonic (`^1`), insert `#ivø7` (`bVø7`, with `^1` functioning as the `b5`) before resolving down by half step to `iv6` for a poignant ballad reharmonization.

**Practice methods / drills:**
- **Four-stage tune breakdown:** Practice a standard (*Autumn Leaves*) by cycling through: (1) melody + LH roots only, (2) melody + two-feel bass, (3) melody + syncopated Root+Shell LH, and (4) full Three-Zone connect with RH extensions.
- **Custom lead-sheet workflow:** Transpose to a comfortable piano key if needed (e.g., *Over the Rainbow* in Eb instead of Ab), verify changes against the original score, and mark only key counter-lines, hits, and reharms.
- **Ballad pulse exercise:** Practice maintaining unbroken quarter-note motion in the bass or inner voices beneath sustained melody notes.

**Voicing & texture ideas:**
- **Root + Shell (LH):** Anchor the root on strong beats and bounce the 3rd/7th guide-tone shell rhythmically to imply both bass and comping.
- **Three-Zone Connect:** Span three registers—LH bass/root, mid-register guide-tone shell, and RH melody supported underneath by "pretty notes" (5, 9, 11, 13).
- **Dominant suspension combo (`V7sus` -> `V7b9`):** Voice-lead upper/inner voices from `sus4` down to `b9` over a dominant root for smooth tension-to-resolution color.
- **Modernized walk-down sonorities:** Reharmonize standard chromatic descents (`iii7 - bIII7 - ii7 - bII7`) using `m11`, `7alt`, `m9`, slash chords (`VI/3rd`), and `Δ9` resolutions.

**Tunes / progressions referenced:**
- *Over the Rainbow* (Eb major; `I - vi - iii7 - I7 - IV - iv6`, `#ivø7 -> iv6` reharm)
- *Summertime* (A minor; `i6 - V7/5` oscillation, `iv - VI13 - iiø7 - V7(b9) - bII7(#11)`)
- *Autumn Leaves* (G major / E minor; `ii7 - V7 - IΔ7 - IVΔ7 - viiø7 - III7 - vi`, plus chromatic walk-down `iii7 - bIII7 - ii7 - bII7` adapted for intro/outro in 4/4 and 3/4)
- *Solar* (briefly shown as a *Real Book* example)

**Ideas for a reharm/practice app:**
- **Progressive Texture Mixer:** Allow users to toggle arrangement layers on any tune—Root+Melody, Two-Feel Bass, Root+Shell LH, Three-Zone RH Extensions, and Counter-Melodies—to practice or audition solo piano density step by step.
- **Thematic Intro/Outro Generator:** Detect distinctive 2–4 bar late-form progressions (like chromatic walk-downs) and auto-generate intro/outro variants with extended/altered qualities (`m11`, `7alt`, `Δ9`) and optional 4/4-to-3/4 meter shifts.
- **Melody-Aware Reharm Hints:** Detect `I -> IV` progressions where the melody holds `^1` and suggest `#ivø7 -> iv6`; flag `V7` cadences for `bII7(#11)` tritone-sub hits.
- **Fake-Book vs. Original-Score Diff Layer:** Provide an optional "Source Score" overlay on standards to highlight where *Real Book* charts drop original counter-melodies or bass pedals.

---

## §6 · Jazz Piano Basics Vol. 2: Left Hand Voicings
**Source file:** Jazz-Piano-Basics-Vol-2-Left-Hand-Voicings.pdf · 16 pages
**What it is:** A progressive left-hand voicing workbook by Adam Maness (Open Studio) moving from 2-note rooted shells to 4-note rootless extensions, quartal stacks, and close-position clusters, each paired with a standard/blues application worksheet and key.

**Curriculum sequence:**
1. **Root + Half-Shell:** 2-note rooted voicings (`1-3`, `1-7`, `1-6`) with chromatic/diatonic inner "mover" lines; applied to Rhythm Changes.
2. **Root + Shell:** 3-note rooted voicings (`1-3-7`, `1-7-3`, `1-3-6`, `1-6-3`) and inversions with inner-voice movers; applied to a 32-bar standard.
3. **Shell + Pretty:** 3- and 4-note rootless voicings combining guide tones with color extensions (`9`, `11`, `#11`, `13`, `b9`, `#9`, `b13`); applied to a minor standard.
4. **4ths (Quartal):** 3-note modal quartal shapes moving diatonically/chromatically through Lydian, Dorian, Mixolydian, and Altered scales; applied to an F Blues with tritone substitutions.
5. **Clusters:** 3- and 4-note close-position voicings featuring major/minor 2nd rubs; applied to a descending `ii-V-I` standard.

**Core concepts:**
- **Guide-Tone "Mover" Lines:** Treating the 7th, 6th, or 3rd in a rooted shell as a contrapuntal inner voice on static chords—e.g., `7 -> #6 -> 6` on `Imaj7`, `6 -> #6 -> 7` on `I6`/`i6`, `b7 -> 7 -> b7` or `b7 -> 6` on `i7`/`iiø7`, and `3 -> 4` or `3 -> b3 -> 3` on `V7`. Adds rhythmic/harmonic motion to multi-bar vamps without changing chord function.
- **Tritone Substitution in Blues & Rhythm Changes:** Replacing `V7` or `IV7` with `bII7` (e.g., `bII7 -> I7` in place of `V7 -> I7`, or `VII7` as a tritone sub for `IV7` in bar 2 of a blues) and chaining chromatic `III7 -> bVII7 -> VI7 -> bIII7 -> II7 -> bVI7 -> V7 -> bII7` on a Rhythm Changes bridge so guide tones resolve by half-step.
- **Modal Quartal Shifting:** Harmonizing `Imaj7(#11)` (Lydian), `i7` (Dorian), `V7` (Mixolydian), and `V7alt` (Altered) with diatonic 3-note 4th stacks, allowing the left hand to plane smoothly inside a single chord rather than staying frozen on one grip.
- **Rootless A/B Alternation:** Alternating 3rd-on-bottom and 7th-on-bottom rootless shapes across `ii7 -> V7 -> Imaj7` and `iiø7 -> V7alt -> i6/9` so all voices move by step or remain common tones.

**Practice methods / drills:**
- **Vocabulary-per-chord-quality drilling:** Learn each voicing family across all core qualities (`maj7`, `6`, `m7`, `m6`, `7`, `dim7`, `m7b5`) on a single root (`C`) in multiple inversions before applying to tunes.
- **Form-based application worksheets:** Fill in blank bass-clef lead sheets using only the target voicing vocabulary, then compare against the provided answer key for voice-leading efficiency.
- **Quartal scale-climbing:** Run 3-note quartal shapes stepwise up the parent mode (Lydian, Dorian, Mixolydian, Altered) on a single root to internalize shifting left-hand shapes.

**Voicing & texture ideas:**
- **Root + Half-Shell (2-note):** `1-7`, `1-6`, or `1-3` in the low-to-mid bass clef (`~C2–B3`). Alternate `1-3` and `1-7` across `ii-V-I` or cycle-of-5ths motion so the upper guide tone steps smoothly.
- **Root + Shell (3-note):** `1-3-7`, `1-7-3`, `1-3-6`, `1-6-3`, plus open/closed inversions (`3-7-1`, `7-3-1`). Keep roots below `~C3` and shells clustered around `E3–C4`; drop to 2-note half-shells on fast 2-beat harmonic rhythm.
- **Shell + Pretty (3- & 4-note rootless):**
  - *Major:* `3-7-9`, `7-3-13`, `3-13-7-9`, `7-9-3-13`, `3-5-6-9`, `6-9-3-5`.
  - *Minor:* `b3-b7-9`, `b7-b3-5`, `b7-b3-11-9`, `b7-9-b3-5`, `b3-5-6-9`, `6-9-b3-5`.
  - *Dominant (natural):* `3-b7-9`, `b7-3-13`, `3-13-b7-9`, `b7-9-3-13`.
  - *Dominant (altered/Lydian dom):* `3-b7-b9`, `3-b7-#9`, `b7-3-#11`, `b7-3-b13`, `3-13-b7-b9`, `3-b13-b7-#9`, `b7-9-3-#11`, `#11-b7-9-3`, `b7-#9-3-b13`.
  - *Half-diminished & Diminished:* `b3-b5-b7-11` / `b7-11-b3-b5` on `m7b5`; `b3-bb7-9` and upper-extension dim7 stacks (`1-b3-b5-bb7` with `9`/`11`/`b13` colors).
  - *Register:* Primarily `F2–G4` in bass clef; briefly revert to `Root + Shell` when a tonic minor-6th chord (`i-6`) sits too low or needs grounding.
- **4ths (3-note):** Stacked P4s (and occasional M3s/aug4s to fit the mode, e.g., `#11` in Lydian or `3`/`b7` tritone in Mixolydian/Altered), kept in the `F2–A4` range for clarity without muddiness.
- **Clusters (3- & 4-note):** Close-position rootless (and occasional rooted) groupings packing a major or minor 2nd between adjacent voices—e.g., `5-7-1-9` / `7-1-9-3` (`maj7`), `b7-1-9-b3` / `5-6-1-9` (`m7`/`m6`), `b7-1-9-3` / `b7-9-3-#11` (`7`/`7#11`), `b7-b9-3-5` (`7b9`), `b7-1-b3-b5` (`m7b5`).

**Tunes / progressions referenced:**
- *"Oleo"* (Bb Rhythm Changes) — Root + Half-Shell
- *"I Remember You"* (key of F) — Root + Shell
- *"Alone Together"* (key of Dm) — Shell + Pretty
- *"F Blues"* (two choruses with tritone subs) — 4ths
- *"Solar"* (descending `ii-V-I` cycle) — Clusters

**Ideas for a reharm/practice app:**
- **Texture-tier selector per progression:** Let the user toggle a single chart across all 5 left-hand textures (`Half-Shell` -> `Shell` -> `Shell + Pretty` -> `4ths` -> `Clusters`) with automatic register clamping (`F2–G4` for rootless/clusters, `C2–C4` for rooted shells).
- **Inner-voice "Mover" generator:** Automatically inject chromatic/diatonic guide-tone motion (`7 -> #6 -> 6`, `3 -> b3 -> 3`, `b7 -> 7 -> b7`) whenever a chord lasts 4+ beats.
- **Quartal scale-planing mode:** For modal or static dominant/minor bars, generate shifting 3-note 4th stacks along the chord's parent scale (Lydian, Dorian, Mixolydian, Altered) rather than a single static voicing.
- **Tritone-sub voice-leading visualizer:** Highlight half-step guide-tone resolution when substituting `bII7` into blues turnarounds or Rhythm Changes bridges.

---

## §7 · Genius Chord Workouts (Genius Chord Warmups)
**Source file:** Genius-Chord-Warmups-Workbook.pdf · 100 pages
**What it is:** A 100-page notation-only piano workbook by Adam Maness (Open Studio, 2023) presenting 12 progressive chord, voice-leading, and reharmonization workouts across major and minor keys.

**Curriculum sequence:**
1. **The Standard** (pp. 4–15, 12 keys): Ascending diatonic 7ths -> root-position secondary dominants -> 1st-inversion secondary dominants (chromatic bass) -> 1st-inversion `add2` ("mu") approach chords.
2. **The Hinge** (pp. 16–21, 12 keys): `ii7 - V7 - Imaj7` voice-leading around an inner-voice 2nd "hinge," adding top-voice neighbor motion, `1 -> 5` bass movement, and `V7(b9)`.
3. **The Spread** (pp. 22–27, 12 keys): Open-register 10th-in-LH + triad-in-RH voicings applied to diatonic scale triads, secondary dominants, and a descending-5ths turnaround chain.
4. **The Approach** (pp. 28–32, 10 keys): `I - vi - IV - V` embellished with 1st-inversion `add2` and `V7/3rd` passing chords.
5. **The Oblique** (pp. 33–44, 12 major + 12 minor keys): Ascending/descending scale bass against a static upper-voice pedal dyad/triad.
6. **The Sugar Chords** (pp. 45–50, 12 major + 12 minor keys): Gospel/neo-soul ballad turnaround with slash-chord inversions, `add2` colors, and `sus4`/`b9sus4` dominants.
7. **The Voice Leader** (pp. 51–57, 7 keys): Drop-2, Drop-3, and Drop-4 voicing permutations over the chromatic-bass secondary-dominant ascending scale.
8. **The Tritone Sub** (pp. 58–63, 12 keys): Parallel comparison of `V7(b13)` secondary dominants vs. `bII9(#11)` tritone substitutions targeting every diatonic chord.
9. **The Mountain** (pp. 64–75, 12 keys): Additive cycle-of-fifths pyramid building backward from `I - V7 - I` one secondary-dominant/diatonic step at a time up to `I - V7/vi - vi7 ... - I`.
10. **The Spider** (pp. 76–82, 7 minor keys): Natural minor diatonic triads up and down in close LH, open two-hand, and triplet arpeggiated textures.
11. **The Secondary 2-5** (pp. 83–94, 12 keys): Expands each 1st-inversion secondary dominant into a full secondary `ii - V/3rd` (using `iiø7` for minor targets, `ii7` for major/dominant targets).
12. **The Mu-2-5-1** (pp. 95–100, 12 keys): Inserts a 1st-inversion `add2` chromatic approach chord (`V(2)/3rd` a half-step below the secondary `ii`) before every secondary `ii - V`.

**Core concepts:**
- **1st-inversion secondary dominants (`V7/3rd -> target`):** Replaces root-position secondary dominants with 3rd-in-bass slash chords to create a smooth chromatic ascending bass line (`1 - #1 - 2 - #2 - 3...`) into every diatonic scale degree.
- **1st-inversion `add2` ("mu") approach chords (`X(2)/3rd -> target`):** Substitutes or precedes `V7/3rd` with an `add2` triad in 1st inversion; delivers a bright, modern gospel/contemporary-jazz color while preserving the chromatic leading-tone bass motion.
- **Secondary `ii - V` chains with quality matching:** Inserts `[iiø7 - V7/3rd]` before minor diatonic targets (`ii`, `iii`, `vi`) and `[ii7 - V7/3rd]` before major/dominant targets (`IV`, `V`, `I`), turning a simple diatonic scale into a dense bebop/standard harmonic sequence.
- **Mu-2-5-1 chromatic chain:** Precedes each secondary `ii - V` with a 1st-inversion `add2` chord whose bass note sits a half-step below the secondary `ii` root, connecting every diatonic chord via continuous stepwise/chromatic bass motion.
- **Tritone substitution with `#11` color (`bII9(#11)` for `V7(b13)`):** Swaps every secondary `V7(b13)` for a dominant `9(#11)` a tritone away, transforming the ascending chromatic bass into a descending-chromatic or stepwise-contrary bass line while keeping the `3–7` tritone shared.
- **The "Hinge" inner-voice 2nd:** Anchors `ii7 - V7 - Imaj7` around a `b7–1` (major 2nd) rubbing into `7–1` (minor 2nd) in the middle register, minimizing hand movement while maximizing harmonic tension and release.
- **Gospel/Sugar turnaround (`I - V(2)/7th - vi7 - I/5th - IV - I(2)/3rd - ii7 - V7sus4` and minor parallel):** Uses alternating root-position targets and 1st/2nd-inversion slash chords to keep the bass melodically active and the upper structure warm and suspended.
- **Additive cycle-of-fifths ("Mountain"):** Builds harmonic awareness of how turnaround chains (`III7 -> VI7 -> II7 -> V7 -> I`, etc.) nest backward from the tonic cadence.

**Practice methods / drills:**
- **Chromatic 12-key cycling:** Most workouts progress upward by half step through all 12 keys (with major/minor paired on the same page in *The Oblique* and *The Sugar Chords*, and 7-key subsets in *The Voice Leader* and *The Spider*).
- **Layered complexity on a single harmonic skeleton:** Repeats the exact same ascending-scale or turnaround progression across 3–4 passes, adding one device per pass (diatonic -> root-position secondary V -> `V7/3rd` -> `add2/3rd` -> secondary `ii-V` -> mu-`ii-V`).
- **A/B substitution comparison:** *The Tritone Sub* pairs the unaltered secondary-dominant chorus directly above the tritone-sub chorus in every key so the player hears the shared guide tones against the altered bass.
- **Textural & rhythmic isolation:** *The Spider* drills the same diatonic minor triad scale as block LH chords, two-hand open dyads, and triplet arpeggios; *The Oblique* isolates bass-line independence against a static RH pedal.

**Voicing & texture ideas:**
- **LH root + RH close triad (`1 | 3-5-7` and `1 | 5-1-2`):** Used in *The Standard*, *The Secondary 2-5*, and *The Mu-2-5-1*; when the 3rd moves to the bass (`V7/3rd` or `X(2)/3rd`), the RH drops the 3rd and voices `5-b7-1` or `5-1-2` to avoid doubling the leading-tone bass.
- **Shell + upper-structure (`1-3` or `3-7` in LH | `9-#11-13` / `b13-b7-9` in RH):** Used in *The Tritone Sub* and *The Mountain* to keep chord extensions clear in the mid-upper register without muddying the bass.
- **10th-spread voicings (`1-10th` or `1-b7` in LH | `5-1-3` triad in RH):** Used in *The Spread* for a wide, orchestral piano texture spanning roughly `C2` to `E5`.
- **Hinge cluster voicings (`1-3` / `1-b7` in LH | `b7-1-5` -> `3-5-1` -> `7-1-5` in RH):** Keeps the RH compact around middle C (`B3–A4`) with a deliberate 2nd interval (`C4–D4` / `B3–C4`) as the voice-leading pivot.
- **Drop-2, Drop-3, and Drop-4 permutations:** Applied systematically to the RH/upper-structure 4-note voicings over the chromatic bass line in *The Voice Leader*.
- **Pedal oblique dyads:** Static `1-5` or `1-3-5` in RH (`C4–G4` area) over a moving 2-octave-below bass scale.

**Tunes / progressions referenced:**
- No named jazz standards are cited; all material is built on idiomatic harmonic skeletons:
  - Ascending diatonic scale (`I - ii - iii - IV - V - vi - viiø7 - I`) with secondary dominants, tritone subs, and secondary `ii-V`s.
  - Standard `ii7 - V7(b9) - Imaj7` cadence.
  - Pop/gospel `I - vi - IV - V` and `I - V/7 - vi - I/5 - IV - I/3 - ii - V7sus4` turnarounds (major and minor).
  - Descending-5ths turnaround cycle (`I - V7/vi - vi - V7/V - V - V7/IV - IV - V7/iii - iii - V7/ii - ii - V7 - I`).
  - Natural minor diatonic triad scale (`i - ii° - bIII - iv - v - bVI - bVII - i`).

**Ideas for a reharm/practice app:**
- **Progressive reharm layer slider:** Let the user pick any diatonic progression (or ascending bass/melody) and toggle through Maness's exact escalation tiers: *Diatonic -> Secondary V7 -> V7/3rd -> add2/3rd ("Mu") -> Secondary ii-V -> Mu-ii-V -> Tritone Sub (`bII9(#11)`)*.
- **Additive "Mountain" cadence builder:** A practice mode that starts on `I - V7 - I` and automatically prepends one more cycle-of-fifths / secondary-dominant step each time the user completes a clean loop in a key.
- **Voice-leading & Drop-voicing visualizer:** Render a progression in Drop-2, Drop-3, Drop-4, and "Hinge" (inner-voice 2nd) voicings, highlighting common tones and half-step resolutions (especially `b7->3` and `3->7` across tritone subs).
- **Doubling-aware slash-chord voicer:** Automatically omit the 3rd from the RH upper structure whenever a chord is inverted to `V7/3rd` or `X(2)/3rd`, substituting `5-b7-1` or `5-1-2`.
- **12-key chromatic & oblique drill generator:** Pair a fixed RH pedal dyad or Hinge cluster with a moving bass or chromatic key-modulation prompt (with major/minor toggling per key).

---

## §8 · Jazz Chords for Beginners
**Source file:** Jazz-Chords-for-Beginners-Workbook-1.pdf · 9 pages
**What it is:** Beginner-level chord voicing workbook by Adam Maness (Open Studio) that bridges basic 7th-chord structures to two-hand and left-hand rootless voicings applied to `ii–V–I`s and a full standard.

**Curriculum sequence:**
1. **Six core chord families & tensions:** Root-position 7th chords (`Maj7`, `m7`, `7`, `dim7`, `m(maj7)/m6`, `m7b5`) paired with their available upper extensions and parenthesized avoid/conditional tones.
2. **Rooted 5-note two-hand voicings:** Redistributing chord tones and tensions across both hands with the root anchored in the bass (including both natural `13` and altered `b9/b13` dominants).
3. **Rootless 4-note two-hand voicings (A & B forms):** Dropping the root and splitting 4 notes (`2+2`) between hands in two inversions (3rd-on-bottom vs. 7th/6th-on-bottom).
4. **Rootless left-hand voicings (A & B forms):** Compressing the 4-note A/B structures into a single-hand close-position cluster to free the right hand.
5. **Major & minor `ii–V–I` voice leading:** Connecting the three voicing tiers through `ii9–V13–Imaj9/13` and `iiø7–V7(b13 b9)–i6` using alternating `A -> B -> A` and `B -> A -> B` paths.
6. **Full-tune application (*Autumn Leaves*):** Playing the complete 32-bar form three times—once in each voicing tier (5-note rooted, 4-note two-hand rootless, and LH-only rootless).

**Core concepts:**
- **Avoid-tone flagging in chord-scale extensions:** Distinguishes usable color tones (`9`, `13`, `#11`, altered `b9/#11/b13`) from conditional/avoid tensions (`11` on `Maj7` and `m6/m(maj7)`, `13` on `m7`, natural `11` on `Dom7`, `b13` on `m7b5`, `maj7` on `dim7`) right at the 7th-chord stage.
- **Minor-Major 7th / Minor 6th equivalence:** Groups `i(maj7)` and `i6` as one tonic-minor family, then standardizes on `i6` (`1-b3-5-6` + `9`) for practical voicings and minor `ii–V–i` resolutions.
- **Dual dominant colors (`V13` vs. `V7(b13 b9)`):** Teaches natural-extension dominants for major `ii–V–I`s (`ii9 -> V13 -> Imaj9`) and altered-extension dominants for minor `ii–V–i`s (`iiø7 -> V7(b13 b9) -> i6`) from the outset rather than deferring altered harmony.
- **A/B inversion alternation for voice leading:** Prevents hand jumping across progressions by alternating A-form (3rd on bottom) and B-form (7th/6th on bottom) across root motion in 4ths (`ii -> V -> I` moves as `A -> B -> A` or `B -> A -> B`).

**Practice methods / drills:**
- **Three-tier voicing graduation:** The workbook's core drill is cycling the same harmonic material (`ii–V–I`s, then a full 32-bar tune) through three progressively independent textures: (1) 5-note rooted two-hand -> (2) 4-note rootless two-hand -> (3) 4-note rootless LH-only (leaving the RH free for melody/soloing).
- **Inversion-pair drilling:** Every rootless chord quality and `ii–V–I` is drilled in both `A -> B -> A` and `B -> A -> B` starting positions so the player never relies on a single grip.
- *(Note: The workbook is purely notated reference/etude material and contains no explicit tempo targets, key-cycling routines, or ear-training instructions.)*

**Voicing & texture ideas:**
- **5-note rooted two-hand (`LH | RH`):**
  - `Maj9` / `m9`: `1-5-7 | 9-3` (places a whole- or half-step rub between `9` and `3` in the RH).
  - `V13` / `V7(b13 b9)`: `1-b7 | 3-13-9` / `1-b7 | 3-b13-b9` (stacked 4th/tritone-adjacent shapes in RH).
  - `m6`: `1-b3-6 | 9-5`; `m7b5`: 4-note rooted `1-b5 | b7-b3`.
- **4-note rootless two-hand (`2+2` split):**
  - `Maj`: A = `3-5 | 7-9`, B = `7-9 | 3-13` (swaps `5` for `13` in B-form).
  - `m7`: A = `b3-5 | b7-9`, B = `b7-9 | b3-5`.
  - `V13` / `V7(b13 b9)`: A = `3-13 | b7-9` (or `b13`/`b9`), B = `b7-9 | 3-13` (or `b9`/`b13`).
  - `m6`: A = `b3-6 | 9-5`, B = `6-9 | b3-5`; `m7b5`: A = `b3-b7 | 1-b5`, B = `b7-b3 | b5-1`.
- **Rootless LH-only close-position:** Compresses the exact `2+2` A/B formulas into a single-hand cluster centered around `C3–C5` (roughly an octave below to an octave above middle C), keeping `9` and `3` adjacent in the middle of the chord.
- **Voice-leading rule:** In `ii–V–I`, guide tones (`3` and `7`) hold as common tones or step by half step while upper extensions (`9` -> `13`/`b13`, `5` -> `9`) resolve downward by step.

**Tunes / progressions referenced:**
- Major `ii–V–I` (`ii9 -> V13 -> Imaj9/13`)
- Minor `ii–V–i` (`iiø7 -> V7(b13 b9) -> i6`)
- *Autumn Leaves* (full 32-bar form in G minor / Bb major, including the `i9 -> IV13 -> bVII9 -> bIII13 -> bVI13 -> V7(b13 b9) -> i6` turnaround/bridge cycle)

**Ideas for a reharm/practice app:**
- **Three-tier progressive unlock mode:** Let users practice any progression or standard in three linked stages—5-note rooted -> 4-note `2+2` rootless -> LH-only rootless—using the same A/B form logic so muscle memory transfers directly.
- **Auto A/B pathing visualizer:** Highlight `A -> B -> A` vs. `B -> A -> B` voice-leading chains across `ii–V–I`s and cycle-of-4ths progressions, showing which voices stay common tones and which step down.
- **Conditional extension ("avoid-tone") filter:** Tag tensions per chord quality (e.g., natural `11` on `Maj7`/`Dom7`, `13` on `m7`, `b13` on `m7b5`) as "avoid/passing" vs. "primary color" when generating beginner-friendly voicings.
- **Context-aware dominant toggle:** Default `V` chords in major `ii–V–I`s to `V13` and `V` chords in minor `ii–V–i`s to `V7(b13 b9)`, with a one-click toggle to swap between natural and altered dominant colors.

---

## §9 · The Major Scale Course

**Source file:** The-Major-Scale-Course-workbook.pdf · 40 pages
**What it is:** A 12-key jazz scale, arpeggio, and pentatonic workbook by Adam Maness (Open Studio), aimed at building fluent bebop/post-bop melodic vocabulary from major scales—rooted in Barry Harris's scale-mastery philosophy.

### Curriculum sequence
- **Key-by-key modular structure (12 keys × 3 pages each):** Cycles chromatically through all 12 major keys (`C`, `Db`, `D`, `Eb`, `E`, `F`, `Gb`, `G`, `Ab`, `A`, `Bb`, `B`), applying the exact same three-stage drill matrix in every key.
- **Stage 1 — The Basics (diatonic shapes):**
  - Linear 1-octave scale (`6/4` meter, continuous eighth notes up and down).
  - Diatonic 3rds (`4/4` meter).
  - Diatonic triads (`1-3-5` in continuous eighth notes, creating natural 3-over-4 barline displacement).
  - Optional rhythmic variation: triads in `3-over-4` phrasing.
  - Diatonic 7th-chord arpeggios (`IΔ7` through `viiø7`, `1-3-5-7` ascending and `7-5-3-1` descending, one chord per bar with a half-rest breathing space).
- **Stage 2 — Approach / Pivot (chromaticism & angularity):**
  - Chromatic lower-neighbor approaches into diatonic 3rds, diatonic triads, and diatonic 7th-chord arpeggios (ascending and descending).
  - Octave-displacement pivots on diatonic 7th-chord arpeggios (`1-3-5-7` alternating with root followed by `3-5-7` dropped an octave).
- **Stage 3 — Pentatonic Scale (5-note vocabulary):**
  - Linear major pentatonic (`1-2-3-5-6`) over 1 octave, then 2 octaves.
  - Interval-skipping pentatonic patterns (skipping adjacent pentatonic degrees).
  - 4-note pentatonic chordal shapes (`1-3-5-6`, `2-5-6-1`, `3-6-1-2`, `5-1-2-3`, `6-2-3-5`) ascending and descending.
  - Optional `3-over-4` rhythmic displacement on the 4-note pentatonic shapes.

### Core concepts
- **Chromatic lower-neighbor approach into diatonic structures:** Precedes the root of each diatonic 3rd, triad (`1-3-5`), or 7th chord (`IΔ7`, `ii7`, `iii7`, `IVΔ7`, `V7`, `vi7`, `viiø7`) by a half step below (e.g., `#I` -> `ii7`, `#II` -> `iii7`, `#IV` -> `V7`). On `IΔ7`, uses scale degree `2` as an enclosure/passing lead-in or half-step approach depending on direction; descending lines reverse the chromatic inflection into the top or target tone. Creates forward rhythmic drive and classic bebop tension-release without leaving the parent key's harmonic gravity.
- **Alternating octave-drop pivots (Barry Harris style):** Alternates a standard ascending `1-3-5-7` arpeggio on odd scale degrees (`IΔ7`, `iii7`, `V7`, `viiø7`) with a downward octave pivot on even degrees (`ii7`, `IVΔ7`, `vi7`), where the root is played in the upper register and `3-5-7` drops an octave below before rising back up. Keeps lines within a playable middle register while introducing wide, horn-like intervallic leaps.
- **3-over-4 metric displacement on triads and pentatonics:** Grouping 3-note diatonic triads (or 3-beat/syncopated pentatonic cells) in continuous eighth notes across `4/4` barlines shifts which chord tone lands on strong beats, breaking "square" on-the-beat phrasing.
- **4-note pentatonic chordal shapes:** Extracting 4-note groupings from the major pentatonic (`1-3-5-6` and its inversions/rotations across the 5 pentatonic modes) yields quartal/modern-sounding melodic cells (`2-5-6-1`, `3-6-1-2`, `6-2-3-5`) that work over `IΔ7`, `ii7`, `iii7`, `vi7`, and `V7sus4` without sounding strictly scalar.

### Practice methods / drills
- **Chromatic 12-key cycling:** Every pattern is written out in all 12 keys in ascending chromatic order (`C` up to `B`), forcing equal facility in flat and sharp keys rather than staying in comfortable keys.
- **Scaffolded complexity per key:** Each key moves strictly from *diatonic familiarity* (Basics) → *chromatic & intervallic tension* (Approach/Pivot) → *modern 5-note abstraction* (Pentatonics), so the ear and hands anchor the parent scale before adding chromaticism or octave leaps.
- **Built-in rhythmic rest/reset bars:** Arpeggio and pivot drills alternate 2 beats of eighth-note motion with 2 beats of rest (or 5-note approach arpeggios + quarter rest), giving the player time to hear the harmonic target and mentally prep the next scale degree.
- **Optional polymetric/displacement pass:** Triads and pentatonic chordal shapes include an optional `3-over-4` pass to train rhythmic independence once the notes are under the fingers.
- **Long-term cyclical mastery:** Closing pedagogy emphasizes returning to the workbook repeatedly over time ("lifelong pursuit")—prioritizing consistency and comfort across all 12 keys rather than expecting one-pass perfection.

### Voicing & texture ideas
- **Diatonic 7th-chord arpeggio palette:** `1-3-5-7` ascending and `7-5-3-1` descending across all 7 modes of the major scale (`IΔ7`, `ii7`, `iii7`, `IVΔ7`, `V7`, `vi7`, `viiø7`).
- **4-note pentatonic cells:** `1-3-5-6` and its modal rotations (`2-5-6-1`, `3-6-1-2`, `5-1-2-3`, `6-2-3-5`), useful both as single-note modern lines and as 4-voice upper-structure/so-what-adjacent shapes.
- **Register management via pivots:** Alternating ascending `1-3-5-7` with octave-dropped `1-[3-5-7 ↓ 8vb]` keeps 7th-chord sequences inside roughly a 1.5–2 octave range instead of climbing off the keyboard.

### Ideas for a reharm/practice app
- **3-Stage Drill Generator per Key:** Let users pick any key (or auto-cycle chromatically / around the cycle of 4ths) and step through *Basics → Approach/Pivot → Pentatonic* with a toggle for `3-over-4` rhythmic displacement.
- **Configurable Pivot Rule Engine:** Implement an arpeggio/line transformer that applies the alternating octave-drop pivot (`odd degrees ascend 1-3-5-7`, `even degrees drop 3-5-7 down 8vb`) to any user-selected chord progression or scale, keeping generated lines within a user-defined MIDI range.
- **Chromatic Approach Wrapper:** Add an "Approach Mode" toggle to standard diatonic exercises that automatically prepends a half-step lower neighbor (or chromatic enclosure) to each target root/chord tone.
- **Breathing-Space Metronome Mode:** Support call-and-response / rest-bar practice (e.g., 2 beats play / 2 beats rest, or 1 bar play / 1 bar rest) so players can audiate the next diatonic degree or reharmonization target before playing.
- **Pentatonic Cell Extractor:** Given any chord symbol or parent major scale, display and drill the 5 rotated 4-note pentatonic shapes (`1-3-5-6`, `2-5-6-1`, etc.) as melodic motifs or upper-structure voicings.

---

## §10 · The Jazz Glossary
**Source file:** Jazz-Glossary-Workbook-V1.1.pdf · 31 pages
**What it is:** A quick-reference workbook by Adam Maness (Open Studio, beginner-to-intermediate) covering jazz chord-scale relationships, common piano voicings, and core jazz terminology.

**Curriculum sequence:**
- **Scale Glossary (pp. 4–19):** Major/Ionian, Dorian, Mixolydian, Lydian, Phrygian, jazz Melodic Minor and its modes (Altered, Lydian Dominant), Bebop scales (Dominant, Major, Minor), Pentatonics (Major, Minor 6), symmetrical scales (Half-Whole Diminished, Whole-Half Diminished, Whole Tone), and Chromaticism.
- **Voicing Glossary (pp. 20–25):** Triads, 7th chords, and extended/altered two-hand and rootless-style piano voicings across Major, Minor, Dominant, Augmented, Diminished, and Half-Diminished families.
- **Term Glossary (pp. 26–27):** Essential jazz performance, rhythm, and form vocabulary (comping, changes, groove, head, outside, syncopation, standards, trading, two-feel).

| Term | Meaning in one line (own words) | Relevance to reharm/practice |
| --- | --- | --- |
| Dorian | 2nd mode of major (1-2-b3-4-5-6-b7); the default jazz minor sound with a natural 6th. | Primary scale/color for ii7 in ii-V-I and modal minor vamps (m7, m9, m11, m13). |
| Mixolydian (Dominant) | 5th mode of major (1-2-3-4-5-6-b7); unaltered dominant 7th sound. | Baseline scale for V7 in ii-V-I and dominant tonic chords in blues; reference for altered dominants. |
| Lydian | 4th mode of major with a #4/#11; bright major sound without avoid notes. | Standard on IVmaj7 and a go-to reharm/sub for Imaj7 (`maj7(#11)`, `maj9(#11)`). |
| Phrygian | 3rd mode of major (1-b2-b3-4-5-b6-b7); dark minor sound. | Specifically used on iii7 within a diatonic iii-VI-ii-V turnaround rather than standalone minor chords. |
| Jazz Melodic Minor | Ascending-only melodic minor (1-2-b3-4-5-6-7), identical ascending and descending. | Tonic minor color (`m6`, `m(maj7)`) and parent scale for Altered, Lydian Dominant, and Locrian #2. |
| Altered Scale | 7th mode of melodic minor (melodic minor up a half step); packs b9, #9, #11/b5, b13/#5. | Maximum-tension V7alt sound resolving to I or i in ii-V-I / ii-V-i cadences. |
| Lydian Dominant | 4th mode of melodic minor (Mixolydian with #11); dominant 7th without avoid notes. | Ideal for secondary/chain dominants, tritone subs, and non-resolving `7(#11)` chords. |
| Dominant Bebop Scale | 8-note Mixolydian with a natural 7 passing tone between b7 and root. | Aligns chord tones on downbeats in 8th-note lines over V7 -> I; practice starting from every chord tone. |
| Major Bebop Scale | 8-note major scale with a #5/b6 chromatic passing tone between 5 and 6. | Keeps `maj7` and `6` chord tones on strong beats in ascending/descending 8th-note lines. |
| Minor Bebop Scale | 8-note jazz melodic minor with a #5/b6 passing tone between 5 and 6. | Aligns chord tones on downbeats over tonic minor `m(maj7)` and `m6` chords. |
| Major Pentatonic | 5-note scale (1-2-3-5-6) omitting half-step tensions from the major scale. | Versatile upper-structure tool: C pentatonic fits `Cmaj7`, `Fmaj7`, `Bbmaj7(#11)`, and `Dm7`. |
| Minor 6 Pentatonic | 5-note scale (1-2-b3-5-6); major pentatonic with a b3. | Fits `m6`, `m(maj7)`, `viø7`, and `maj7(#11)` built on its b3 (e.g., C m6 pentatonic over `Ebmaj7(#11)`). |
| Half-Whole Diminished | Symmetrical 8-note scale (H-W alternating); only 3 distinct transpositions exist. | Suits `13(b9)` and `13(#9,#11)` dominants combining altered 9ths/#11 with a natural 13th. |
| Whole-Half Diminished | Symmetrical 8-note scale (W-H alternating); only 3 distinct transpositions exist. | Primary scale for `°7` chords, supplying whole-step upper extensions above any diminished chord tone. |
| Whole Tone Scale | Symmetrical 6-note scale of whole steps; only 2 distinct transpositions exist. | Creates floating tension on V7 chords with #11/b5 and b13/#5 alongside a natural 9th. |
| Locrian #2 | 6th mode of melodic minor (Locrian with a natural 2/9). | Preferred modern upgrade over standard Locrian for `iiø7` in minor ii-V-i progressions. |
| Major 6 / 6/9 Voicings | Tonic major structures using 6 and 9 (e.g., 1-5-3-6-9 or 3-5-6-9) instead of maj7. | Cleaner, less dissonant tonic resolution when the melody sits on the root or needs a classic color. |
| Major 7(#11) Voicings | Major voicings highlighting #11 (e.g., 1-7-3-#11-5 or upper-structure II triad over I). | Adds Lydian shimmer to IVmaj7 or reharmonized Imaj7 endings. |
| Minor 11 / 13 Voicings | Extended minor voicings stacking 3-5-b7-9-11(-13) or quartal shapes. | Expands `ii7` and modal minor vamps beyond basic 7th shells. |
| Minor 6 / Minor(maj7) Voicings | Tonic minor structures pairing b3-5 with 6, 9, or natural 7. | Essential for minor-key tonic stability (i6, i(maj7)) and melodic-minor reharms. |
| Dominant 13(#11) Voicings | Unaltered 3-b7-9-13 dominant shell paired with #11. | Concrete voicing realization of Lydian Dominant for secondary dominants and subV7s. |
| Dominant 13(b9,#11) Voicings | Dominant voicing mixing b9 and #11 with a natural 13th. | Concrete voicing realization of the Half-Whole Diminished sound on V7. |
| Dominant 7alt Voicings | 3-b7 tritone shell topped with b9/#9 and b13/#5 (or #11). | Core left-hand/two-hand cadence voicing for tense V7alt -> i/I resolutions. |
| Augmented Triad (+) | Symmetrical 1-3-#5 chord; each inversion is enharmonically another root's `+` triad. | Useful as a passing/reharm sonority and for symmetrical voice-leading across major-3rd cycles. |
| Diminished-for-V7/I Sub | Using a `°7` chord in place of a dominant or tonic chord. | Classic reharm move (e.g., `#i°7` or `biii°7` passing, or `vii°7` for V7b9) paired with W/H diminished. |
| Secondary / Chain Dominants | Non-diatonic V7 chords targeting scale degrees other than I, often linked in cycles. | Drives bridge sections (e.g., III7 -> VI7 -> II7 -> V7) and invites Lydian Dominant color. |
| iii-VI-ii-V Turnaround | Four-chord cadential loop resetting to I at the end of a form. | Standard turnaround framework; highlights Phrygian on iii7 before shifting into VI7-ii7-V7. |
| Comping | Syncopated chordal accompaniment supporting a soloist or rhythm section. | Practice goal for placing voicings rhythmically behind melodies and bass lines. |
| Changes | Shorthand for the harmonic chord progression of a tune. | Core unit of reharm and solo-practice drills ("playing the changes"). |
| Head | The composed main theme of a tune, framing solos in head-in / solos / head-out form. | Structural anchor for melody-led reharmonization and arrangement practice. |
| Outside / Playing Out | Deliberately playing melodic or harmonic material outside the given chord changes. | Tension-building improv/reharm technique that requires clean resolution back "inside." |
| Syncopation | Shifting rhythms off the beat (often by an 8th note) and resolving back to a downbeat. | Key rhythmic concept for jazz comping and phrasing—tension only works when resolved. |
| Two-Feel | Half-note bass pulse on beats 1 and 3 with hi-hat/ride accents on 2 and 4. | Contrasts with 4-feel walking bass for laid-back A sections or head-in choruses. |
| Trade 2's / 4's / 8's | Alternating 2-, 4-, or 8-bar improvised exchanges among band members. | Form-awareness drill for locking into short phrase lengths and clear cadences. |
| Standards | Shared jazz repertoire adapted from popular/jazz tunes and passed down aurally. | Source material for applying chord-scale, voicing, and turnaround substitutions. |

**Tunes / progressions referenced:**
- *So What* (Miles Davis) — Dorian modal tune
- *Impressions* (John Coltrane) — Dorian modal tune
- *Softly, as in a Morning Sunrise* — Melodic minor tonic key
- *Autumn Leaves*, *When The Saints Go Marching In*, *I Wish* (Stevie Wonder) — Referenced as standards
- Progressions: `ii-V-I`, `ii-V-i`, `iii-VI-ii-V` turnaround, Blues, Rhythm Changes bridge (chain dominants)

**Ideas for a reharm/practice app:**
- **Chord-scale & upper-structure mapper:** Given any chord symbol (e.g., `maj7(#11)`, `7alt`, `ø7`), display compatible parent scales, pentatonic upper structures (e.g., `m6` pentatonic from `b3` for `maj7(#11)`), and avoid-note warnings.
- **Bebop downbeat-alignment trainer:** Highlight chord tones vs. chromatic passing tones in 8th-note lines across all 12 keys, starting from 1, 3, 5, and 7 to verify downbeat landing.
- **Symmetrical-scale transposition filter:** Group `H-W`, `W-H`, and `Whole Tone` exercises by their 3 or 2 unique parent collections so users practice the minimal set of shapes across all 12 roots.
- **Turnaround & bridge reharm sandbox:** Let users swap `iii7` (Phrygian vs. `III7`), `V7` (Mixolydian, Lydian Dominant, H-W Dim, Altered, Whole Tone), and `iiø7` (Locrian vs. Locrian #2) in `iii-VI-ii-V` and Rhythm Changes bridges with instant voicing previews.
- **Feel & trading metronome:** Include a two-feel vs. four-feel backing toggle and a "Trade 4s/8s" mode that mutes/unmutes accompaniment on alternating phrases to drill form awareness.

---

## §11 · Open During Construction
**Source file:** Open-During-Construction-Workbook.pdf · 193 pages
**What it is:** Advanced contemporary jazz ensemble full scores and transcribed solo improvisations by GRAMMY-winning pianist/composer Geoffrey Keezer (featuring his piano, Fender Rhodes, horn, vocal, and string arrangements).

**Curriculum sequence:**
- **Meet Your Instructor (p. 3):** Artist bio and stylistic background (Art Blakey, Wayne Shorter, Hawaiian/Okinawan/Afro-Peruvian influences, modern solo and trio jazz).
- **Chapter 01 — *Bowline* (pp. 4–35):** Med-down swing septet/nonet score with Bass Clarinet/arco Bass contrapuntal intro, piano vamp, chromatic/slash-chord theme, and transcribed Plunger Trumpet, Trombone, Acoustic Bass, and Soprano Sax solos.
- **Chapter 02 — *Open During Construction* (pp. 36–53):** Ballad-to-double-time-to-half-time quintet score featuring a solo piano sus4/9th intro, a 24-bar non-functional modulating progression, mixed-meter double-time Tenor Sax solo, and a virtuosic half-time piano cadenza/feature.
- **Chapter 03 — *Na Kohola (The Whales)* (pp. 54–97):** Rubato/freely-to-in-tempo score for Voice, horns, Piano, E. Piano, and Bass; guitar-like contrapuntal piano intro, tremolo-textured modal/slash harmonies, D-major folk-like ostinato, and open piano/E. piano/horn solos.
- **Chapter 04 — *Tea and Watercolors* (pp. 98–163):** Light-time octet score with syncopated `G`-modal ostinato, Piano/Guitar collective trading over `G`-over-chromatic-bass slash chords, dense `sus4`/altered-dominant/diminished-passing bridges, Trumpet/Alto collective trading, and a staggered-horn shout outro.
- **Chapter 05 — *Back to You* (pp. 164–192):** Straight-8ths quartet score (Violin, Acoustic Guitar, Piano, Bass) built on a `B`-pedal ostinato, `Gm(maj7)/B`–`Bm` modal interchange, `4:3` polyrhythmic polychordal hits, `3/8`–`2/4` metric shifts, and transcribed Piano and Violin solos over an expanded non-functional slash-chord cycle.

**Core concepts:**
- **Common-tone / pedal-point slash reharmonization:** Holding a static upper triad or `maj7(#11)` sonority while shifting the bass chromatically or by thirds/steps (e.g., *Tea and Watercolors*: `I/3 -> I/#4 -> I/6 -> I/5 -> I/b3 -> I/b2` as `G/B -> G/C# -> G/E -> G/D -> G/Bb -> G/Ab`; *Back to You*: `bvi(maj7)/1 -> i` as `Gm(maj7)/B -> Bm` and `VImaj7(#11)/1 -> i` as `Gmaj7(#11)/B -> Bm`). Creates harmonic motion and tension without abandoning a tonal anchor.
- **Non-functional / multi-tonic cycling:** progressions that link unrelated major, minor-7th, and Lydian (`maj7#11`) centers by minor thirds, tritones, or half-steps rather than `ii–V–I` cadences (e.g., *Open During Construction*: `Em7 -> Bmaj7(#11) -> Abm13 -> Ebmaj7 -> Dm7 -> Amaj7`, cycling continuously through distant keys).
- **Alternating `sus4` and `maj9`/`m9` colors:** Pairing `9sus4` / `13sus4` voicings with `maj9` or `m9` chords on non-diatonic roots (e.g., *Open During Construction* intro: `A9sus4 -> Fm9 -> Dbmaj9 -> F#9sus4 -> Amaj13 -> D9sus4 -> Ebmaj9 -> Ab9sus4`) to create floating, ambiguous harmonic momentum.
- **Altered-dominant & chromatic bass-line chains:** Connecting dominant chords with `#9`, `#5`, and `b9` alterations via stepwise/chromatic bass motion and `sus4` delays (e.g., *Bowline*: `A13(b9) -> D7Alt -> G7(b9) -> Em9(b5) -> D7/Eb Db7(b9) Cm7`; *Tea and Watercolors*: `F#dim7 -> Fm -> C(2)/Eb -> C#dim7 -> Cm -> Bm -> Bbsus4`).
- **Polychordal & half-step slash-chord hits:** Placing major or dominant chords over a half-step-clashing bass note in odd-meter/polyrhythmic (`4:3`) hits (e.g., *Back to You*: `Emaj7/F -> F7/Gb -> Eb/E`) for sharp, percussive dissonance before resolving back to a pedal ostinato.
- **Metric & tempo-feel modulation over a fixed form:** Reinterpreting a single harmonic cycle across radically different feels—ballad, double-time with shifting meters (`3/8`, `4/8`, `5/8`, `6/8`, `7/8`), and half-time (*Open During Construction*)—or toggling between `4/4` and `3/8`–`2/4` riffs (*Back to You*).

**Voicing & texture ideas:**
- **"Guitar-like" contrapuntal piano texture:** Broken, syncopated bass-clef arpeggios and open-fifth/tenth inner lines (*Na Kohola* intro/outro) that imitate acoustic guitar fingerpicking.
- **Tremolo / rolling pad textures:** Two-hand tremolos on `m(b6)`, `m11`, `maj7(#4)`, and `m(maj7)` voicings (*Na Kohola* "Freely" sections) to sustain orchestral weight without drums.
- **Close-register `add2` / `maj7(2)` & `maj7(b5)` slash voicings:** Stacking `1-2-3-5` or `1-3-#4-7` upper structures over non-root bass notes (*Back to You*: `A(2)/C#`, `D(2)/F#`, `Bbmaj7(b5)/A`, `Amaj7(b5)/G#`) for crystalline, modern-chamber sonorities.
- **Two-hand interlocking & octave/unison 16th-note runs:** Splitting rapid tuplet lines (`6`-, `9`-, `11`-, `12`-, `15`-tuplets) either in parallel octaves/unisons across hands (*Back to You* piano solo, *Tea and Watercolors* trading) or alternating hands against sustained left-hand vamp chords (*Open During Construction* half-time feature).
- **Dual-keyboard layering:** Pairing Fender Rhodes (`E. Pno`) sustained upper-register pads/melodies against acoustic piano rhythmic vamps and fills (*Na Kohola* solo section).
- **Staggered / contrapuntal ensemble layering:** Pairing arco Bass + Bass Clarinet in octaves against horn pads (*Bowline*), or staggering horn entrances over a static piano/guitar 8th-note ostinato (*Tea and Watercolors* outro).

**Tunes / progressions referenced:**
- *Bowline* (Geoffrey Keezer) — original modern swing/blues-inflected septet/nonet composition.
- *Open During Construction* (Geoffrey Keezer) — original multi-tempo, non-functional modulating ballad/double-time piece.
- *Na Kohola (The Whales)* (Geoffrey Keezer) — original rubato/modal vocal-and-ensemble piece.
- *Tea and Watercolors* (Geoffrey Keezer) — original light-time `G`-modal/slash-chord octet piece.
- *Back to You* (arr. Geoffrey Keezer) — straight-8ths chamber-jazz quartet arrangement with `B`-pedal ostinato and expanded slash-chord solo form.

**Ideas for a reharm/practice app:**
- **Static-Top / Moving-Bass Slash Generator:** Given any held triad or `maj7(#11)` voicing, generate chromatic or modal bass-line progressions (`I/3 -> I/#4 -> I/6 -> I/5 -> I/b3 -> I/b2` as in *Tea and Watercolors*) for comping and soloing practice.
- **Non-Functional Progression Builder:** Create random or curated 8–24 bar chord cycles that avoid `ii–V–I` by linking `m7`, `maj7(#11)`, `9sus4`, and `m(maj7)` chords via minor-third, tritone, and half-step root motion (*Open During Construction* / *Back to You*).
- **Metric-Displacement & Feel-Shift Trainer:** Play a fixed chord cycle while randomly or sequentially switching time signatures (`3/8`, `4/8`, `5/8`, `6/8`, `7/8`, `4/4`) or toggling between Ballad, Double-Time, and Half-Time feels.
- **Polychord & Half-Step Bass Clash Voicing Explorer:** Practice `maj7/b2`, `7/b2`, and `add2/3` slash voicings (`1-2-3-5` or `1-3-5-7` over foreign bass notes) with voice-leading constraints.
- **Ostinato + Staggered-Cue Loop Mode:** Lock in a rhythmic left-hand ostinato (like *Na Kohola* or *Tea and Watercolors*) while the app triggers staggered harmonic/rhythmic cues (`4:3` hits or `sus4` breaks) to test independence.

---

## §12 · Jazz Scales for Beginners
**Source file:** `Jazz-Scales-for-Beginners-workbook.pdf` · 9 pages
**What it is:** A beginner-to-intermediate jazz improvisation workbook by Adam Maness (Open Studio, 2022) that maps core chord-scale choices onto Rhythm Changes, minor ii–V–i progressions, and *Autumn Leaves*.

### Chord-to-Scale Quick Reference

| Chord quality / function | Scale(s) taught | Usage note |
| --- | --- | --- |
| `Imaj7` | Ionian | Home major tonic in I–vi–ii–V and Rhythm Changes A-sections. |
| `IVmaj7(#11)` | Lydian | Major IV chord in diatonic mode survey and *Autumn Leaves*. |
| `ii7` / `vi7` | Dorian / Aeolian | Dorian on `ii7` (`Cm7`); Aeolian on `vi7` (`Gm7`) in diatonic I–vi–ii–V. |
| `iiø7` (`m7b5`) | Locrian | Half-diminished `iiø7` in minor ii–V–i. |
| `i6` / `im(maj7)` | Melodic Minor | Tonic minor resolution (`Gm6`) at the end of a minor ii–V–i. |
| `V7` (diatonic / secondary) | Mixolydian | Unaltered dominant sound (`V7`, `I7` -> `IV`). |
| `VI7(b9,b13)` / `V7(b9,b13)` | Phrygian Dominant | 5th mode of harmonic minor; used on `VI7 -> ii` and minor-key `V7 -> i`. |
| `V7(b9)` | Half/Whole Diminished | Symmetrical 8-note dominant scale; shares pitch collection with its tritone sub (`bII7`). |
| `#iv°7` / passing `°7` | Diminished (Whole/Half) | Used over passing diminished chords (`Eo7` in Rhythm Changes, `Bo7` in *Autumn Leaves*). |
| `III7`–`VI7`–`II7`–`V7` & tritone subs | Lydian Dominant | Bright `#11` dominant color on non-resolving/chain dominants and `bII7` tritone subs. |
| `V7alt` (e.g., `IV7alt` / `II7alt`) | Altered (Super Locrian) | Applied on `C7alt` in the *Autumn Leaves* bridge for maximum altered tension. |
| General / bluesy inflection | Blues scale | Relative minor/major blues collection (`F` blues over `Bb` / `Gm`) as an all-purpose melodic anchor. |

### Curriculum sequence
- **Diatonic modes in two keys:** Introduces all seven major-scale modes with root-position 7th chords in `C` and `Eb`.
- **Linear scale running:** Connects adjacent chord changes (`I–vi–ii–V`) with continuous eighth-note scales.
- **Gravity & voice-leading cells:** Shifts from root-to-root running to short directional pickups (ascending/descending scales and arpeggios) that resolve across barlines into `I` (`ii–V–I–vi`).
- **Phrygian Dominant (`b9, b13`):** Introduces harmonic minor's 5th mode for `VI7 -> ii` and applies the same four gravity cells.
- **Half/Whole Diminished:** Covers `V7(b9)` and demonstrates tritone-related dominant symmetry (`V7` and `bII7` sharing one scale), followed by gravity drills into `I`.
- **Rhythm Changes A-section integration:** Combines Ionian, Mixolydian, Lydian/Diminished, Dorian, Phrygian Dominant, and H/W Diminished over `Bb` Rhythm Changes changes.
- **Lydian Dominant & tritone substitutions:** Applies `1–2–3–#4–5–6–b7` to the `III7–VI7–II7–V7` Rhythm Changes bridge, then inserts tritone subs (`bVII7`, `bIII7`, `bVI7`, `bII7`) every second bar.
- **Full Rhythm Changes recap:** 32-bar AABA chart synthesizing all A and B section concepts.
- **Minor ii–V–i & *Autumn Leaves* + Blues:** Adds Locrian, Melodic Minor (`i6`), passing diminished, Altered (`V7alt`), tritone-subbed major ii–V, and the `F` blues scale.

### Core concepts
- **Gravity (voice-leading across barlines):** Rather than starting every scale on the root, phrases use short scalar or chordal pickups on `V7` (or `VI7`) that target a chord tone (especially the 3rd) of the following chord, creating forward harmonic pull.
- **Phrygian Dominant (`V7(b9,b13)`):** Derived from the 5th mode of harmonic minor; functions on `VI7 -> ii` in major keys (`G7 -> Cm7`) and `V7 -> i` in minor keys (`D7 -> Gm6`), giving a dark, minor-inflected dominant pull. Even when a chart reads `vi7`, it can be treated as `VI7` (`Phrygian Dominant`) to strengthen motion to `ii7`.
- **Half/Whole Diminished symmetry:** Used on `V7(b9)` resolving to `I`; because the scale repeats every minor third/tritone, one H/W diminished collection covers both `V7` and its tritone substitute (`F7` and `B7`).
- **Lydian Dominant (`#11`) & tritone-sub chains:** Used on secondary/chain dominants (`III7–VI7–II7–V7`) and their tritone substitutions (`bII7` substitutes inserted on the back half of each 2-bar dominant). Keeps the `#11` brightness while creating chromatic root motion (`D7 -> Ab7 -> G7 -> Db7 -> C7 -> Gb7 -> F7 -> B7`).
- **Minor ii–V–i scale pairing:** Maps `iiø7` -> Locrian, `V7(b9,b13)` -> Phrygian Dominant, and `i6` -> Melodic Minor (raising the 6th and 7th for a modern minor-tonic color).
- **Altered scale on `V7alt`:** Introduced in the *Autumn Leaves* bridge (`C7alt`) to supply `b9`, `#9`, `#11/b5`, and `b13` tensions against a dominant chord.

### Practice methods / drills
- **4-way "Gravity" permutation matrix:** Every dominant-to-tonic/ii cell (`V7 -> I`, `VI7 -> ii`, `V7(b9) -> I`) is drilled in four directional contours—Scales Down, Scales Up, Arpeggios Up, Arpeggios Down—starting from four different chord-tone positions (1, 3, 5, 7) to eliminate root-bound habits.
- **Continuous eighth-note scale running:** Playing unbroken eighth-note lines across 1-bar or 2-bar harmonic rhythm to build real-time scale-switching fluency.
- **Key-center & progression cycling:** Starts in `C` and `Eb` for modal orientation, then anchors all applied drills in `Bb` major / `G` minor (Rhythm Changes and *Autumn Leaves*).

### Tunes / progressions referenced
- **Rhythm Changes (in `Bb`):** Both `I–VI7–ii–V` and `I–I7–IV–#iv°7–I/5–VI7–ii–V` A-sections, plus `III7–VI7–II7–V7` bridge (with and without tritone subs).
- ***Autumn Leaves* (in `G` minor / `Bb` major):** Standard changes plus tritone-substituted major ii–V (`ii7 -> bII7 -> V7 -> bV7 -> Imaj7`) and bridge with `C7alt`.

### Ideas for a reharm/practice app
- **4-contour "Gravity Cell" generator:** Given any `V7 -> target` pair, generate ascending/descending scalar and arpeggiated pickups starting from each chord tone (1, 3, 5, 7) that resolve by half-step or whole-step into the target's 3rd or 7th.
- **Tritone-sub chain toggle:** On 2-bar dominant cycles (`III7–VI7–II7–V7`), let users toggle a split-bar tritone-sub overlay (`D7 | Ab7 | G7 | Db7 ...`) and automatically highlight the shared Lydian Dominant / H/W Diminished pitch sets.
- **Dominant color switcher:** Allow users to audition `Mixolydian` vs. `Phrygian Dominant` vs. `H/W Diminished` vs. `Lydian Dominant` vs. `Altered` on any `V7` or `VI7` slot in a progression, showing which tensions (`b9`, `#9`, `#11`, `b13`) each scale introduces.
- **Minor ii–V–i & *Autumn Leaves* drill mode:** Highlight the shift between major-key `ii–V–I` and minor-key `iiø7–V7(b9,b13)–i6` (Locrian -> Phrygian Dominant -> Melodic Minor) with optional `bII7` tritone-sub insertions.

---

## §13 · Jazz Piano Jump-Start
**Source file:** Jazz-Piano-Jump-Start-workbook.pdf · 65 pages
**What it is:** A 7-week foundational jazz piano course workbook by Adam Maness and Peter Martin (Open Studio), covering ear training, shell voicings, swing/syncopation, blues, AABA/Rhythm Changes, technique, and active listening.

**Curriculum sequence:**
1. Core learning principles (Listen, Patience, Routine, Feedback) and keyboard/speaker setup.
2. Major (diatonic) and minor (chromatic) intervals via song mnemonics, ear-training drills, and an interval etude.
3. Triad qualities, core 7th chords (`maj7`, `7`, `min7`), and `3–7` shell / `1–3–7` root+shell voicings.
4. Swing feel (triplet-based ride/hi-hat spectrum) and four foundational syncopation cells.
5. 12-bar blues in Roman numerals (`I7–IV7–V7`), ensemble roles (*Freddie Freeloader*), and the 7-note major/minor blues scale.
6. 32-bar AABA form and Rhythm Changes (`I–ii–V–I`, tonicization of `IV`, `iii–vi–ii–V`, and `III7–VI7–II7–V7` bridge).
7. Tension-free posture/technique, chromatic scale, major scale with LH root+shell comping, and `1–3–5–7–9` jazz arpeggios.
8. Seven-element active listening ("Listening with Purpose") away from the keyboard.
9. Capstone 4-chorus *Jump-Start Blues* etude (head, written solo, improvised solo, head out).

**Core concepts:**
- **12-bar blues architecture:** Treated as three 4-bar phrases—`I7` (home, bars 1–4), `IV7 -> I7` (departure/return, bars 5–8), and `V7 -> IV7 -> I7` (turnaround tension/resolution, bars 9–12).
- **`bVII7` blues turnaround sub:** Used in bars 11–12 of *Freddie Freeloader* in place of `I7` (`bVII7 -> I7`), adding a hip, unexpected dominant color before the top of the chorus.
- **7-note "secret" blues scale:** Standard minor blues scale plus the major 3rd (`1–b3–3–4–#4–5–b7`); used over every chord in a dominant blues for major/minor tonal duality. Taught both radially (intervals from `1`) and linearly (`1–b3` m3 leap, `b3–3–4–#4–5` chromatic walk, `5–b7` m3 leap, step to `1`).
- **Rhythm Changes A-section:** `Imaj7 | ii7 V7 | Imaj7 | ii7 V7 | ii7/IV V7/IV | IVmaj7 | iii7 vi7 | ii7 V7` (substituting `Imaj7` at the end of the second A). Demonstrates `ii–V–I` as a modulation bridge to `IV` and `iii–vi–ii–V` as a turnaround, while highlighting that A-section endings vary across a form.
- **Rhythm Changes B-section (Bridge):** Chain of resolving secondary dominants (`III7 -> VI7 -> II7 -> V7`, 2 bars each) leading back to `Imaj7`.
- **Extended jazz arpeggios:** Compact `1–3–5–7–9` arpeggio segments (crossing into extensions rather than repeating multi-octave triads) to cover harmonic ground quickly in improvised lines.
- **Four syncopation cells:** Downbeat 8th pair, upbeat 8th pair (`&` of 1), downbeat Charleston (dotted quarter + 8th), and upbeat Charleston (`&` of 1 + 3), linked with quarter notes to build swinging phrases.
- **Swing feel spectrum:** Continuum between straight 8ths and strict triplet swing, shaped by personal/regional taste and drummer ride-cymbal phrasing.

**Practice methods / drills:**
- **4-session weekly routine:** Each week prescribes four structured sessions pairing a tempo-metered Chromatic Warm-Up (ramping across weeks from 60 to 126 bpm, with periodic slow-downs for control), targeted Ear Training, an Etude/Play-Along at target tempos (66–120 bpm), prior-etude review, and Free Play.
- **Interval ear training:** Song mnemonics for all 12 intervals paired with daily web-app drills (ToneDear, Teoria, ToneSavvy).
- **Hand-independence scale comping:** Playing a 2-octave RH major scale over LH `1–3–7` `Imaj7` comping.
- **Blues-scale hand-position anchors:** Trading phrases over a blues play-along using three RH thumb-anchor positions (`1`, `4`, or `5`).
- **7-pass "Listening with Purpose" protocol:** Away from the piano, isolating one layer per listen on a recording—Form, Bass Line (two-feel vs. walking, section markers), Melody phrasing, Harmony/chord qualities, Intervals/range, Syncopation phrasing differences across soloists, and Instrument Roles/comping register.
- **Room-speaker play-along & self-recording:** Practicing with external speakers (avoiding isolated headphones) to blend with recordings in the room, and recording oneself for objective feedback.

**Voicing & texture ideas:**
- **Guide-tone shells (`3–7` and `7–3`):** Omitting root and 5th to define `maj7`, `7`, and `min7` qualities cleanly in both inversions; highlighted in Rhythm Changes bridges where dominant `3–7` shells step down chromatically (`III7 -> VI7 -> II7 -> V7`).
- **Root + shell (`1–3–7` / `1–7–3`):** Grounding the shell with the root (split across hands or in LH/RH) for punchy solo-piano comping without the 5th.
- **Technique & register:** Keeping wrists level and avoiding thumb-on-black-keys; shifting body weight along the bench rather than contorting arms ("economy of motion").

**Tunes / progressions referenced:**
- *Freddie Freeloader* (Miles Davis, *Kind of Blue* — Bb blues with `bVII7` sub)
- *Pfrancing (No Blues)* (Miles Davis, *Someday My Prince Will Come* — two-feel blues listening study)
- *I Got Rhythm* (George Gershwin — 32-bar AABA Rhythm Changes)
- *So What* (Miles Davis — modal `min7` reference)
- *Second Balcony Jump*, *Sister Sadie*, *Sandu*, *On the Sunny Side of the Street* (Listening with Purpose assignments)
- Interval mnemonic standards/melodies (*Somewhere Over the Rainbow*, *Greensleeves*, *The Entertainer*, *Somewhere*, *When the Saints Go Marching In*, etc.)

**Ideas for a reharm/practice app:**
- **Chromatic guide-tone chain visualizer:** Animate how `3–7` shells descend by half-step through `III7 -> VI7 -> II7 -> V7` (and extend to tritone-subbed or altered dominant chains).
- **Syncopation cell mixer & swing slider:** Let users combine the 4 core syncopation cells with quarter-note connectors to generate comping/phrasing rhythms over any chart, with a continuous straight-to-triplet swing slider.
- **7-layer active listening mode:** A guided listening/stem-focus workflow (Form, Bass, Melody, Harmony, Intervals, Syncopation, Roles) for looping choruses and tagging observations away from the keyboard.
- **4-session weekly routine builder:** Auto-generate progressive 4-session practice plans with BPM tracking across warm-ups, ear training, etudes, and free play.
- **Blues turnaround & scale-duality toggle:** Highlight `bVII7` (and other bar 11–12 subs) on a blues chart and toggle between 6-note minor blues and 7-note major/minor blues (`+3`) overlays.

---

