# Handoff (2026-11-19, session 6)

## Goal
Build a Voicings tab: a shape library where you see every form of a voicing family for a chord, hear it, and play it with grading. The MVP is done. Next is v2 from the spec.

## Done
- `bd9c5b4` (pushed): F3, the `quartal` (with `plane` planing on chords of 4+ beats) and `spread` (LH 10th + RH upper structure) styles. Both are in the mixer's Piano voicings select.
- `9331581` (NOT pushed): the Voicings tab MVP. Read the commit body for the full list.
  - theory-core `voicingForms.ts`: `voicingForms`, `classifyVoicing`, `gradeShape`, `voiceLeadForms`.
  - web: `components/voicings/VoicingsPage.tsx`, mode `voicings` in `ModeSwitch.tsx` and `App.tsx`.
  - Fix: a shell could sit below its own bass.
  - `phoneKeyboardRows` moved to `components/practice/keyboardRows.ts`.
- Spec: `docs/research/voicings-tab.md`. It merges seven role-play agents (beginner, intermediate, new user, teacher, UX, PM, engineer); Itai's decisions are in §8, and §6 has the scope slices.
- Checks: typecheck clean; tests 251 theory-core + 20 API + 34 web passing.
- Browser checks in the dev app (:5173), at desktop and 375 px:
  - the ii–V–I path is A-B-A from A and B-A-B from B;
  - all three grading outcomes work (missing 3rd, wrong shape, correct, which advances to the next chord).
- Not checked: CI for both commits; real MIDI/QWERTY strikes on the tab (only on-screen tap-then-check was driven); Coach's phone keyboard after the helper move.

## In progress
Nothing. The tree is clean apart from this file.

## Next 3 steps
1. **Push `9331581`** (Itai pushes), then check CI.
2. **v2 history:** add a small rule-id prefix registry in theory-core, then route `shape:<style>:<quality>` ids. Today the `ear:` prefix is hard-coded in `App.tsx` `practiseConcept`, `CoachPage.tsx:152`, `PracticeDashboard.tsx:146-147` and `practice.ts` `fetchEarDue`. Then save graded runs (demo-aware) and add a Passport section. End-to-end checks must use the scratch-DB procedure in CLAUDE.md §0.
3. **v2 features (spec §6):**
   - a 12-key drill weighted toward weak keys;
   - "Voice this" from a lead-sheet chord;
   - "voice the tune" with the melody on top (`top` pinning);
   - compare pins;
   - "Use for band piano" (`setVoicingStyle`);
   - hand colour on the keys.

## Decisions + why
- **Drop-2/3 offer both forms:** the rootless drop the band plays, plus the textbook R-3-5-7 forms (ids `rootless-top-*`, `root-on-*`).
- **Rootless A/B are forms of `close`** (A = 3rd on the bottom, B = 7th on the bottom), not a new style. That keeps the mixer list as it is.
- **No practice history in the MVP.** It would have needed the prefix registry first, and the tab writes nothing.
- **The primary user is the intermediate player.** Beginners see Shells (marked "start here"), Close and Drop 2 first; the rest are behind "More shapes".
- **Forms are built from `voicing.ts`'s `styleOptions`,** so `forms[0]` always equals `voiceChord`'s pick (a test enforces it). Don't fork the layout logic.
- **`voiceLeadForms` scores movement voice by voice.** The engine's nearest-note `movement` picked 5-7-9-3 over A on Cmaj7.
- **Grading is octave-free with the bass optional.** It names the missing degree, the extra notes, or the shape actually played. Exact-position grading stays in Coach.
- **The phone layout docks the keys at the bottom** (only notes in play, no bass row), with Hear/Check on the bar and the ii–V–I as a one-row strip.
- **Quartal G7♭9 plays the ♯9, not the ♭9:** no stack of 4ths reaches A♭ with B and F. Itai hasn't ruled on it.

## Gotchas
- **Exporting from `voicing.ts`:** it now exports `candidates`, `styleOptions`, `layoutScore`, `bassOf`, `inversions`, `drop`, `CENTER`, `movement` and `ChordLike` for `voicingForms.ts`. Watch for name clashes through `index.ts`'s `export *`.
- **`useChordStrikes` needs 2+ notes, and repeats need a release.** On-screen keys on this tab toggle pending notes and don't emit on the bus, so they can't trigger a strike.
- **The dev app's 500s on `/api/health`** just mean the `api` preview isn't running.
- **The persona agents ran on Sonnet** via the Agent tool. Their raw reports aren't saved; the spec is the record.

## Suggested skills
- `mattpocock-skills:tdd` for the prefix registry and the `shape:` ids (property tests first).
- `ship` when Itai says "commit and push".
- `run`, or the built-in browser on `web` (:5173), to check the tab. It writes nothing, so the dev server is safe, but use Study mode or the demo build for anything that grades in Coach.
