# Handoff (2026-11-19, session 8)

## Goal
Voicings tab v2 (spec: `docs/research/voicings-tab.md` §6, decisions §8 items 6–8 are new this session). Visual polish and "Voice the tune" are done; next is the next v2 item.

## Done (all on `main`, NOT pushed: Itai pushes)
- `24bd1d9` Visual polish: guide-tone ink double ring (PenKeyboard `guides`), LH brick + square / RH blue + dot key washes (`hands`), bold guide-tone labels (`PenMark.strong`), legend line. Coach unchanged (passes none of these).
- `a5d43d6` Voice the tune. theory-core `voiceTheTune.ts` (`structuralTops`, `voiceTheTune`, `hasMelody`); `voiceLeadForms` takes per-chord `tops`. Engine fix in `voicing.ts`: a low pinned top no longer drops drop-3's voice under the bass (also the band's One Note on Top path). UI: "Voice the tune" source, lead sheet, step-through filing, "Hear the head" (`player.playScore`). On a melody-less chart the pill is dimmed; clicking it explains inline with "Open Co-op Blues →" (`onOpenReference`).
- `70c03af` Itai's review fixes: Stop for Hear the head (playScore schedules 0.35 s ahead; `stopScore`, engine `clock()`/`releaseAuditions()`), ◀ ▶ buttons + ←/→ keys, `LeadSheet` component with numbered lines of four bars.
- Checks at `70c03af`: typecheck clean; tests 267 theory-core + 21 API + 34 web. CI earlier commits (`d2483e1`) green; CI for these three not checked (unpushed).
- Browser: demo build (:4174) at desktop and 375 px; fake-MIDI step-through, Hear the head following, Stop, arrows, B♭ transposition, disabled-pill flow; zero `/api`, clean console. Audio cut-off at Stop was not heard (pane can't listen).

## In progress
Nothing. Only `docs/HANDOFF.md` is uncommitted (this file).

## Next 3 steps
1. Push (Itai) and check CI for `24bd1d9`, `a5d43d6`, `70c03af`.
2. Ask Itai to try Voice the tune with his keyboard: does Stop cut cleanly, and do the structural tops feel right on Co-op Blues?
3. Pick the next v2 item (spec §6): "Voice this" from a lead-sheet chord; hear-then-hide-then-play; compare pins; "Use for band piano".

## Decisions + why
- **Top note = structural melody note** (spec §8 item 6): longest note starting in the chord's span, an eighth anticipation belongs to the next chord, ties to the note nearest the attack. One voicing per chord, not block chords.
- **Melody tunes only** (§8 item 7). Only Co-op Blues (`referenceTune`) has a melody among bundled tunes; public-domain charts are changes only (rule 0). Never hard-code its id: the button uses `referenceTune`.
- **Step through untimed** (§8 item 8), filing each clean chord like the ii–V–I; Hear the head plays in time, swung, capped at 112 bpm.
- **Pill dimmed but clickable** (aria-disabled), not `disabled` with a tooltip: tooltips don't exist on touch.
- **Phone keyboard in tune mode spans this chord ±1**, not the whole head (16 chords made the keys tiny).

## Gotchas
- **Quartal rarely fits under a melody** (14/16 Co-op Blues chords fall back to close, labelled per chord). Building quartal stacks down from the melody note would be its own piece of work.
- **Grading is octave-free:** when the melody's pitch class is already in the shell, playing it on top isn't enforced.
- **Vitest won't run files outside `packages/theory-core`;** for scratch probes write a `.ts` script with absolute imports and run `npx tsx <file>`.
- **The repo doesn't use Prettier** (no config; files were never formatted). Don't reformat.
- **The demo's IndexedDB still holds test runs**; "Start over…" in the passport clears them.
- **Quartal G7♭9 still plays the ♯9.** Itai hasn't ruled on it.

## Suggested skills
- `mattpocock-skills:tdd` for any new theory-core function (tests first; see `test/voiceTheTune.test.ts`).
- The built-in browser on `web-demo-build` (`npm run build:demo` first) for UI checks.
- `ship` when Itai says "commit and push".
