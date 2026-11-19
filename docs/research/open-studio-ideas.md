# Open Studio material: what Reharm Lab could take from it (2026-11-19)

Sources read: Adam Maness, *The Harmony Games* workbook (9 games) and *Lead Sheet Breakdown*; the "Sugar Chords" sheet; Peter Martin's *All the Things You Are* lead sheet and "ATTYA MVP" (guide-tone) sheet.
All of it is © Open Studio. This file records **concepts** in our own words. No exercises, voicings or melodies are copied, and nothing from these PDFs may go into the repo as content.

## What the engine already covers
Before the gaps, here's what's already in the repo (13 rules in `ruleset.ts`):
- **The Family:** two of the three dominant subs are in. Tritone sub (♭II7) is `dominant.tritoneSub`; backdoor ♭VII7 is `modal.backdoorTwoFive`.
- **Backing up the circle:** `functional.secondaryTwoFive`.
- **Timeless chords:** the passing °7 between I and ii, and between IV and V, is `chromatic.passingDiminished`.
- **Heart melter (iv), Going Home (modal interchange):** the minor iv is `modal.borrowedIv`; ♭VI–♭VII–I is `modal.flatSixFlatSeven`.
- **Sus dominants:** sus colour already shows up inside `gospel.halfStepTurnaround`.
- **Guide tones:** Practice's ChordHUD shows the guide tones for each chord, and the Coach diff grades them.

## A. New reharm rules (theory-core, through `ruleKit.ts`, one property test each)
Interval-relative and melody-filtered, like the existing rules.

1. **`dominant.mediantDominant` (III7 → I), the last member of the Family.** Take the °7 a half step below the target (B°7 → C). Each of its four notes, read as a ♭9, gives a dominant: G7, B♭7, D♭7, E7. We have three; E7 → C is missing. Here the dominant's 3rd (G♯) resolves down by half step to G and its 7th (D) moves down a whole step to C, while the B and E carry over as common tones. L3–4, and the melody filter decides where it's legal.
   - *Shared colour axis:* the sheets play each Family member three ways: plain 7, 7sus4 and 7alt. A dominant-colour variant (plain/sus/alt) on every dominant-producing rule beats writing three rules each. The sus version suits a melody that sits on the 4th; the alt version goes wherever the melody isn't the natural 9 or 13.
2. **`pedal.upperTriadOverTonic` ("heart melter").** On a long tonic, keep the bass on 1 and move the hands to IV/1, iv/1, V/1 or v/1, then back. It's a neighbour-chord motion over a pedal, Peace Piece / gospel-plagal territory. It differs from `borrowedIv` because the bass never moves. L2 for IV/1 and iv/1, L3 for v/1 (it adds the ♭7 colour).
3. **`chromatic.slashConnector` ("chord connectors").** Put a secondary dominant in first inversion so the bass climbs chromatically: I – V7/ii over its 3rd (D7/F♯ in C) – ii, or IV – add2 over ♯IV (the B(2)/D♯ type) into iii. It works like `secondaryTwoFive`, but the point is the bass line. It could be a variant of that rule with an inversion flag rather than a new rule. L2.
4. **`cadential.walkUpToFive` ("timeless chords").** The bass climbs 1–3–4–♯4–5 as I – I/3 – IV – ♯iv°7 – I/5 – V7, ending on the cadential 6/4. Variants:
   - ii7 – ♯ii°7 – I/3 (the E°7-type passing chord in C, which is a different °7 from the one `passingDiminished` uses);
   - iv6 in place of IV;
   - a descending, all-flat version that walks down chromatically to I/5.
   
   The missing piece is the **I/5 → V** arrival with the walking bass. Today's `passingDiminished` only puts one °7 between two chords. L2.
5. **`plagal.doublePlagal` and `functional.backcycledNinths` ("going home").** These are two endings we don't have:
   - ♭VII – IV – I (B♭ – F – C);
   - II9 – V9 – I (D9 – G9 – C), a chain of dominant 9ths backing up the circle.
   
   Together with the existing ♭VI–♭VII–I, that's three ways to cadence: plagal, "perfect" and modal interchange. L3.
6. **`halfDim.sharpFourLeadIn` (♯ivø7 → IV or iv6).** In Lead Sheet Breakdown's *Over the Rainbow*, when the melody sits on the tonic, the ♯ivø7 (Aø7 in E♭) drops by half step into IV, or into iv6. The tonic is the ♭5 of the ø7, so the melody note stays legal. L3.
7. **`melody.oneNoteOnTop` (L4): reharmonize a held melody note over a moving bass.** The "One Note on Top" game holds one note on top while the bass walks down chromatically. The held note is heard as the root, then the 3rd, 5th, ♭9, 11, 13 of each new chord. The rule would generate candidates from a bass walk and then keep only the chords where the held note is a legal chord tone or tension. That's exactly what the melody filter is for. This is the move closest to Bill Evans's and Shaun Martin's vocabulary, and the most "Reharm Lab" item on this list.

## B. The voicing engine
`voicing.ts` only has one texture: a close-position upper structure (guide tones first) over a single bass note. Every source here is mostly about texture.

1. **`VoicingStyle`**, built the way `BandStyle` was:
   - closed; drop-2; drop-3; shell (root + 3/7);
   - three-zone: root, shell, and a "pretty note" (5, 9, 11 or 13) on top;
   - rootless A/B.
   
   It would be a pure function of the chord, the previous voicing and the style. It decides pitches, so it belongs in theory-core.
2. **Melody-on-top voicing ("4-way close" or drop-2 under the melody note).** This is needed for item 3, and also lets the Study playback sound like an arranged chorus.
3. **Sixth-diminished harmonization ("Sugar Chords", Barry Harris).** It harmonizes a moving melody over a static chord by alternating the 6th chord with the °7 a half step below it: the 8-note 6-dim scale, voiced closed, drop-2 or drop-3. The sheet also shows two less obvious pairings:
   - the 6/dim on IV over a ii7 (A♭6 over Fm7);
   - the minor-6/dim a half step above a V7 (Bm6 over B♭7). This gives an altered colour.
   
   It could be a rule (`voicing.sixthDiminished`, which needs melody notes on beats) or a Study "harmonize this line" view.
4. **Hinging (voice-leading drill).** Keep one common tone (the "hinge") and move the rest. Hinge on the R, then the 3rd, then the 5th, then move the hinge itself. `voiceLeading.ts` already finds the motions. A Study overlay could ring the hinge note and draw arrows for the voices that move, and a Practice drill could ask you to hold the hinge.

## C. Changes game (ears/), after Level 4 (minor ii–V)
- **"Family" round:** you're on the dominant slot and hear one of the four dominants resolve to I. Which one was it? Answers are root motions, so the existing judge works. A new motion id would be `ear:family:*`.
- **"Going home" round:** hear an ending and name it as plagal (♭VII–IV–I), perfect (II9–V9–I) or modal interchange (♭VI–♭VII–I).
- **Sus vs alt** as a colour-hearing round on the same V → I.

## D. Practice, Coach and arranging (from Lead Sheet Breakdown)
- **Texture ladder for Practice or Coach:**
  1. root + melody;
  2. a two-feel bass;
  3. root + shell, comped rhythmically;
  4. three-zone.
  
  Grading each step reuses the Coach diff (it already checks guide tones).
- **Guide-tone line drill (from the ATTYA MVP sheet).** Play one guide tone per chord, moving by the smallest step (3 → 7 → 3…), as a continuous half-note line through the whole form. HUD shows guide tones per chord today, but there's no *line* to follow and nothing grades it.
- **Intro/outro generator.** Lift a passage from the tune (e.g. a chromatic ii–V chain or its turnaround), recolour it (m11, 7alt, m9), and optionally put it in 3/4 for the outro. It's deterministic, built from the tune's own moves.
- **Hits.** Arranged band accents or stops on chosen beats, as a per-tune list in `band.ts`.
- **Bass roll-ups.** A bass-line style that rolls up from the root through strong chord tones into the next chord, for ballads.

## E. Content
- **All the Things You Are** would be an excellent test tune:
  - ii–V–I into five key centres (A♭, C, E♭, G, E);
  - a ♭5 turnaround to the bridge (C7♯9♭13 into Fm7);
  - a minor iv (D♭m7);
  - a °7 passing chord (B°7);
  - a ø7–7 turnaround.
  
  **Rights:** it was published in 1939, so it's US public domain only from 2035. Kern died in 1945, so it's free under life + 70 outside the US since 2016. Hammerstein's lyrics stay protected until 2031 under life + 70. So it would have to be **chord changes only**, and `Tune.rights` has no kind that fits ("public-domain" isn't true in the US). That's a decision for Itai.

## Suggested order
1. ~~A7 (`oneNoteOnTop`) plus B1/B2 (voicing styles and melody-on-top).~~ **Built 2026-11-19:** `rulesOneNote.ts`, `VoicingStyle` with `top`/`topVoice` in `voicing.ts`, and the mixer's "Piano voicings" select. Rootless A/B wasn't added as its own style: "close" already is a rootless 4-voice grip.
2. A1 plus the dominant-colour axis (plain/sus/alt). Small and well-defined.
3. A2, A4, A5. Each is a small, self-contained rule with a property test.
4. Changes "Family" round, after Level 4.
