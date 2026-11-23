# Harmony Catcher: plan (Phase 7)

While Itai comps over a chart in Practice, the engine notices when he plays one of its own moves that wasn't asked for, and stamps it: *"Caught: backdoor ii–V into E♭ (bar 7)."* The catches add up to a harmonic fingerprint: which moves he reaches for, in which keys.

## Decisions (Itai, 2026-11-23)

1. **Chart first.** v1 listens in the Practice tab while the tune loops. Free play (no chart) is a later phase.
2. **Evidence: guide tones, root optional.** A chord counts as played when its 3rd and 7th are present (for dim/sus, the defining tones) and every other pitch class is a chord tone or a legal tension. The root and 5th are optional, so rootless A/B forms and shells count.
3. **Fingerprint only.** A catch makes a stamp and a tally per `(ruleId, keyTonic)`. It never touches SM-2: scheduling stays with graded Coach drills (rule 10).
4. **Voicing rules in v1.** Upper structure ♭VI, upper structure II and rootless 2-5-1 are caught through `voicingForms.classifyVoicing`. `melody.oneNoteOnTop` stays out, because it depends on the melody.

## The core rule: the move must explain it, the original must not

The candidate moves are the tune's own: `generateMoves(tune)` (all levels, ignoring DENSITY caps), so the move ids, rules and keys are exactly what the rest of the app shows. A move is **caught** when, across its replaced span:

- every replacement chord is matched by a strike inside that chord's beats; and
- at least one of those strikes does **not** match the original chord at the same beat. This settles the tritone-sub case. Every tone of D♭9(13) (D♭ F A♭ C♭ E♭ B♭) is an altered tension on G7, so a rootless D♭7 voicing *is* G7alt. Such a strike fits both and goes to the original. The sub is caught only when the move's root is the lowest note, so rootless comping over a dominant is never mis-stamped as a sub. The same "lowest note decides" tie-break covers any move whose chord fits the original with alterations; and
- the move is **not** in the pathway the band is currently playing. Following the band's chart is reading, not discovery.

If two moves explain the same span, the one with the most matched chords wins, with ties going to the higher rule level. A strike up to an eighth note before a chord's start counts for that chord, so anticipated changes on the and-of-4 are caught.

## Slices (one commit each, test-first)

**7a. `matchChord` (theory-core, pure).** `matchChord(pcs: number[], chord: ChordShape): { ok, missing, foreign, rootPresent }`. A tension table per quality, reusing `QUALITY_FORMULA` and `ALTERATION_EXCLUDES`. *(Shipped. The table is stricter than `classifyNote`, which would pass E♭ over Cmaj7. Every form in the Voicings tab must match its own chord, which is why a ø7 needs its ♭5 only when rootless, and a 7sus4 takes the 3rd as a colour.)*

**7b. `catchMoves` (theory-core, pure).** `catchMoves(tune, strikes: {beat, notes}[], activeMoveIds): Catch[]`, with `Catch = {moveId, ruleId, keyTonic, bar, beat}`. It wraps a `…Traced` version so the Proof tab can show why each move was caught or rejected (rule 7 style). Tests:
- for each of the 13 harmonic rules on Co-op Blues, playing the move's `voicingHints` produces exactly that catch;
- playing the original changes produces zero catches (a property test over all bundled tunes);
- G7 versus D♭7 with and without the bass is caught or not, as the core rule says;
- an anticipation an eighth early counts; a quarter note early doesn't;
- the same strike as a move in the active pathway produces no catch.

*(Shipped. The tests forced three more rules:*
- *A chord must **land**: a strike by the and-of-1, with every strike under it fitting it. Otherwise one E♭9 late in a bar of C7 counted as a whole bar of A7(♭9), its tritone partner.*
- *The **bass decides per chord**: a strike that also fits the chart counts for a move chord on another root only when the move's root is lowest. Without this, C7 over C7 read as G♭13(♯11).*
- *A **slash chord needs its bass**, and in a tie, the move whose roots are in the bass wins. F–A♭–C–E♭–G over F is Fm9, not B♭9sus.)*

**7c. Voicing rules.** Add the 3 voicing rules through `classifyVoicing`: the chord matches *and* the shape key matches the rule's form. Tests use each rule's voicing hints, plus a near-miss (same chord, a different shape) that doesn't count.

*(Shipped differently. The move's own grip (`voicingHint(s)`) is the evidence, as in the Coach's drills, because none of `classifyVoicing`'s Voicings-tab styles is "triad on top".*
- *Upper structures need their triad as the top three pitch classes, in any inversion, over a strike that spells the chord.*
- *The rootless ii–V needs each grip bottom to top, with the root optional underneath. Only the move's own A→B alternation counts.*
- *A misplayed shape is traced as `wrong-shape`.*
- *Found on the way: the chart's slash bass (E7(♭9)/G♯) is the bassist's line, so the chart test ignores it. Otherwise E7 comped over it got credited as the B♭9 sub.)*

**7d. Live stamps in Practice (web).** A `useHarmonyCatcher` hook: `useChordStrikes` (keys only; the pedal is ignored, as the Coach does) → beat from `player.currentBeat()` → a rolling buffer of the last 2 choruses → `catchMoves`, deduplicated per move per chorus. Show a Rough.js passport stamp toast ("Caught: …") through the Toaster, with a click to open the move card. Make it opt-in from a "🕵️ Catcher" toggle in Practice, persisted in `reharm.catcher`. Verify in the preview with fake MIDI in Practice (never Coach).

*(Shipped: `practice/catcherSession.ts` (pure, 6 tests) plus the `useHarmonyCatcher` hook.*
- *A catch is stamped only once its span is behind the playhead, so a later strike can still veto it.*
- *A push in the loop's last eighth carries into the next pass.*
- *Verified in the demo build with fake MIDI: B♭m7 to E♭9 in bar 10 was stamped "Caught: Backdoor ii–V · bar 10, in F", and the band's own L2 tritone sub was not stamped.*
- ***Deferred:** the stamp is a plain Toaster note, not a Rough.js stamp, and clicking it doesn't open the move card yet. Practice has no move card to open, so that needs App routing into Study.)*

**7e. Fingerprint persistence.** Add an API table `catches(id, ruleId, keyTonic, tuneId, moveId, at)` and run `npm run db:generate`. `POST /api/catches` uses `sendBeacon` batching like sessions; `GET /api/catches/summary` returns counts per rule × key. The demo returns 403 on writes, and the static demo build reads a seeded `demoCatches.json`, labelled as a sample (rule 11). Tests run against a temp DB behind the `REHARM_DB` sentinel.

**7f. Fingerprint view.** Add a "Your vocabulary" panel in the passport drawer: a rule × key grid of catch counts, and a "never caught" list that links to the Coach drill. Add a PROOFS entry for "original changes are never caught" so it shows in the Proof tab.

## Out of scope for v1

- Free play without a chart.
- Reharm suggestions "in your own hand".
- SM-2 credit.
- Catching `melody.oneNoteOnTop`.
- Catching across key changes mid-tune, beyond what `transpose` gives.

## Checks

Run `npm run typecheck && npm test` after each slice. For 7d–7f, verify in the preview. Never let fake input reach the real DB: test 7e against a scratch copy (CLAUDE.md §0).
