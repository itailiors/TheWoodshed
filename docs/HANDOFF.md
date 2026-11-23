# Handoff (2026-11-23, session 25)

## Goal
Harmony Catcher (Phase 7). While Itai comps over a chart in Practice, the engine stamps any of its own moves he plays without being asked. Spec and slices 7a–7f: `docs/plans/harmony-catcher.md`, linked from PLAN.md. Itai's decisions:
- chart-first (Practice), with free play later;
- guide tones required, root optional;
- catches feed the fingerprint only, never SM-2;
- voicing rules included in v1, one-note-on-top left out.

## Done this session (branch `feat/harmony-catcher`, not pushed)
- PR #14 merged, `feat/launch-polish` deleted. Local main has a no-op merge commit (561b2a3) whose tree matches origin/main.
- a339376, 7a–7c in theory-core (`src/harmonyCatcher.ts`):
  - `matchChord`: guide tones required, per-quality tension table, slash basses required;
  - `catchMoves` / `catchMovesTraced`;
  - voicing moves caught by their own grips.
- 28b30a3, 7d: live stamps in Practice. `apps/web/src/practice/catcherSession.ts` (pure, 6 tests), the `useHarmonyCatcher` hook, and a "🕵️ Catcher" toggle in the Practice header (`reharm.catcher`, off by default).
- Verified in the demo build with fake MIDI: B♭m7 to E♭9 in bar 10 was stamped "Caught: Backdoor ii–V · bar 10, in F". The band's own L2 tritone sub was not stamped.
- Checks: typecheck clean; tests 1211 core, 54 api, 231 web.

## In progress
- Nothing uncommitted. The branch needs a push / PR when Itai is ready.

## Next 3 steps
1. 7e: a `catches` table plus `db:generate` and committing `drizzle/`.
   - `POST /api/catches` batched via sendBeacon; `GET /api/catches/summary`.
   - Demo: 403 on writes, and a seeded `demoCatches.json` labelled as a sample.
   - The hook's `onCatch` is the place to post from.
2. 7f: a "Your vocabulary" panel in the passport (rule × key counts, never-caught links to the Coach), plus a PROOFS entry: "the written changes are never caught".
3. Deferred from 7d:
   - a Rough.js stamp in place of the plain toast;
   - clicking the stamp should open the move card in Study (needs App routing).

## Decisions + why
- A move is caught only when the original chord can't explain the strike. Every tone of D♭9(13) is an altered tension of G7, so a sub needs its own root lowest. Otherwise rootless comping gets mis-stamped.
- A chord must land by the and-of-1 and hold: every strike under it fits. Otherwise one E♭9 late in a bar of C7 counted as 4 beats of A7(♭9).
- Ranking: more chords first, then roots in the bass, then level. F–A♭–C–E♭–G over F is Fm9, not B♭9sus.
- The chart's own slash bass is ignored (the bassist's line). A move chord's slash bass is required.
- Voicing moves are judged by their `voicingHint(s)` grip, not `classifyVoicing`: no Voicings-tab style is "triad on top". Rootless ii–V counts only the A→B alternation the move teaches.
- The tension table is stricter than `classifyNote`, which would pass E♭ over Cmaj7. Every Voicings-tab form must match its own chord (exhaustive test): a ø7 needs its ♭5 only when rootless, and a 7sus4 allows the 3rd on top.

## Gotchas
- Pass `moves` (precomputed `generateMoves(tune).accepted`) to `catchMoves` in loops; regenerating per call timed out a test. One call costs about 3 ms.
- Fake MIDI in the static demo build works for live checks. Wait on the HUD's "NOW" chord to hit a bar's downbeat; timers run normally even with the pane hidden.
- `.env` reads are permission-denied for Claude; Itai runs paid generation himself.
- Still waiting on Itai: the Warm club A/B (`exp/warm-band-tone`) and the ⚙ counters from ~2026-11-27.
