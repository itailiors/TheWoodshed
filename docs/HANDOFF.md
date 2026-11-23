# Handoff (2026-11-23, session 24)

## Goal (next session): Harmony Catcher
Itai picked Harmony Catcher, the "second delighter" (STATE_OF_THE_UNION §5; spec in README.md "Musician's Wishlist", Harmony Catcher section). Idea: while Itai comps or improvises freely, the engine recognises its own reharm moves in his playing and stamps them ("You just played a backdoor ii–V in E♭"). Over time this builds a harmonic fingerprint. No plan or spec exists yet: start by designing one with Itai, not by coding.

## Done this session
- 1c28b38 launch polish:
  - "Sound is paused · tap to enable" pill (`audio/audioGate.ts`, `components/AudioBlockedPill.tsx`, 700 ms grace);
  - Tone banner silenced in production (`audio/quietTone.ts`, the first import in main.tsx);
  - sustain pedal is sound-only, enforced by `midi/sustainPolicy.test.ts`.
- 0ab5de5: Claude-written demo Deep Dives. 18 Co-op Blues entries in `apps/api/demo/explanations.json` (`claude-opus-5-5`, spelling checked against `buildFacts`). Itai ran it himself; it **cost $1.20**. The static demo now shows ✍ Deep dive on a move card's last step.
- Heatmap shapes (23ddc09) and focus rings (948444d) had already shipped; marked done in STATE_OF_THE_UNION.
- Both commits are in PR https://github.com/itailiors/TheWoodshed/pull/14, with squash auto-merge on. At handoff: 1 check passing, 1 pending. Checks: typecheck clean; tests 1183 core + 54 api + 225 web.

## In progress
- PR #14 is waiting on CI. Once it merges, delete the local `feat/launch-polish` branch and pull main.

## Next 3 steps
1. Confirm PR #14 merged, then switch to main and pull.
2. Harmony Catcher design pass with Itai. Open questions:
   - Where does it run (Practice / Improv, a new tab, always-on)?
   - What counts as "played a move": the chord sequence alone, or the voicing too?
   - How tolerant is it of rootless voicings and the left hand alone?
   - Does a catch feed SM-2 history (server-graded, rule 10) or only the passport?
   - Demo mode needs seeded or no-op catches (rule 11).
3. Then write a short PLAN.md phase and build it test-first in theory-core (pure and deterministic, rule 1).

## Code to start from (verify before trusting)
- Chord strikes: `apps/web/src/midi/noteBus.ts` `useChordStrikes` (45 ms settle window; keys only, pedal ignored).
- Voicing recognition: `packages/theory-core/src/voicingForms.ts` `classifyVoicing` / `gradeShape`; `coach.ts` `diffStrike`; `melody.ts` `classifyNote`.
- A grep found no "notes → chord symbol" identifier in theory-core. That is probably the first real gap: strikes → chord symbols → match against rule patterns from `ruleset.ts` / `ruleKit.ts`. Rules are interval-relative to their local target, so matching can be key-free.
- The passport UI and practice history: `library/practice.ts`, `components/progress/PracticeDashboard.tsx`, `learn/progressStore.ts`.

## Decisions + why
- Sustain pedal = sound only: the Coach grades held keys, so a pedal smear can't pass a sloppy change (Itai's choice). Harmony Catcher should follow the same rule.
- The demo Deep Dives are Claude-written now. A `demo:generate -- --template` rerun overwrites them, so a new rule firing on Co-op Blues needs a paid rerun (~$1.20, ask first).

## Gotchas
- `.env` reads are permission-denied for Claude. Itai runs paid generation himself from PowerShell (`npm.cmd run …`).
- Scratch tsx scripts outside the repo need a `.mts` extension (top-level await), imported via `file:///` paths.
- Docs can list items as open after they've shipped. Grep and `git log -S` before building.
- Still waiting on Itai: the Warm club A/B (`exp/warm-band-tone`) and the ⚙ counters from ~2026-11-27.

## Suggested skills
- `mattpocock-skills:grilling` or `mattpocock-skills:domain-modeling` for the Harmony Catcher design pass.
- `mattpocock-skills:prototype` to sanity-check the recognition state model.
- `mattpocock-skills:tdd` for the theory-core recogniser.
- `ship` / "PR and merge" when a slice is done.
