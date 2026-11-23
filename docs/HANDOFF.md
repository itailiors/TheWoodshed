# Handoff (2026-11-23, session 20)

## Goal
Work the remaining STATE_OF_THE_UNION §5 items. The one Claude could take on was the known gap "on a 375 px phone, Study's first move card sits below the lead sheet".

## Done
- Merged to main: PR #11 (squash fbd2223, CI green; branch deleted locally and on GitHub). Study's lead sheet folds to bars 1–4 on phone width.
  - Itai picked "fold" from three mock-ups (moves first, fold, tools below the moves), faked in the dev page and screenshotted at 375 px.
  - `apps/web/src/leadSheetFold.ts` (`lastShownBar`, `foldable`, `forcedOpen`, `FOLD_BARS`) + unit test. App passes `lastBar={sheetLastBar}` to LeadSheet: a real cut, so the bar numbers, washes and playhead stay right.
  - "Show all 12 bars ▾" / "Show bars 1–4 ▴" (`data-lead-sheet-fold`, `aria-expanded`, `aria-controls="lead-sheet-bars"`).
  - Opens on its own, and the button goes, while the band plays or when the player opens a move or chord past bar 4. The default first move doesn't count.
  - First card on 375×812: y≈1760 → ≈1435. Desktop unchanged (checked at 1280: lines 1/5/9, no button).
  - e2e `learn.spec` "on a phone the lead sheet folds…" (both projects). PROGRESS row added; §5 known-gap line trimmed.
- The session-19 handoff edit went into the same commit (Itai asked for "the working tree changes").
- Checks: typecheck clean; test 1180 core + 54 api + 211 web; e2e 76/76.

## In progress
Nothing. Local `main` = origin/main at fbd2223. Uncommitted on main: this handoff and the STATE_OF_THE_UNION §5 item 4 edit (the spelling decision). Commit them as a docs commit (`/ship`, or a direct push to main: admins aren't held to the required check).

## Next 3 steps
1. Itai: beginner nice 9–12 wording (changes the api facts sha; needs `demo:generate -- --template`).
2. Read the ⚙ counters after real use; 3f and "mark foundations known" stay parked until then.
3. Itai: the og-card re-render (still says "11 rules" / "8 claims") and the paid demo Deep Dives.

## Decisions + why
- Flat-key rule chords keep readable enharmonic spellings (G♭ ♭VI–♭VII = Dmaj7 → E6/9, not E𝄫maj7 → F♭6/9): Itai's call; recorded in STATE_OF_THE_UNION §5 item 4 as decided, not a gap.
- Fold, not "moves first": Itai's pick; the tune stays the first thing on screen.
- The fold needs more than 6 bars: folding must hide at least one line.
- Only an *opened* move or chord past bar 4 unfolds the sheet; otherwise a tune whose first move is late would never fold.
- The fold state isn't reset on a tune change and isn't stored (same session only).

## Gotchas
- Resizing the browser-pane emulation doesn't fire `matchMedia` change events: reload after `resize_window` before reading layout.
- The browser pane itself is ~375 px wide, so preset "desktop" is still narrow; use a custom 1280×900 for desktop checks.
- The dev page (api off) shows a ~210 px "Can't reach the API" banner; the demo build doesn't, so measure positions there or subtract it.

## Suggested skills
- `ship` to commit and push the two uncommitted docs edits.
- `next-steps` once Itai sends the beginner 9–12 wording (it becomes a plan step).
- `run` or the `web-demo-build` preview (:4174) to check any Study layout change at 375 px; the dev page shows an API-offline banner.
