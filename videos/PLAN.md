# Reharm Lab showcase clips: plan and shot scripts

Short silent clips (20–45 s) of the features that look best on screen, recorded from the **static demo build**. The demo makes zero `/api` requests and never writes, so the real practice database (`apps/api/data/reharm.sqlite`) is never touched. Every clip runs in a fresh browser profile. The harness also fails a clip if the page makes any `/api` request.

## Formats

- **Desktop:** 1440×900, H.264 MP4, CRF 18.
- **Phone:** a Pixel 5 viewport (393×727), upscaled 2× to 784×1452.
- **Silent:** Playwright records no audio. Clips that would normally make sound (▶ Before/After, Hear, Play with the band, the Changes prompts) show only the visuals. For a version with sound, record the screen with OBS while the scripts run headed, or add audio when editing.
- **On-screen help:** a red cursor dot with click ripples and a navy caption strip are drawn into the page, because headless video shows no cursor. These are recording overlays, not app UI.

## Running the scripts

```powershell
npm run build:demo
```
Then start the `web-demo-build` preview from `.claude/launch.json` (port 4174), and record:
```powershell
node videos/scripts/record-all.mjs
```
- **One clip:** `node videos/scripts/06-coach-learn.mjs`.
- **Contact sheet for review:** `node videos/scripts/frames.mjs 06-coach-learn 9` writes a 3×3 sheet to `videos/shots/`.
- **Output:** clips go to `videos/clips/`, which git ignores (`.gitignore`: `videos/*`, with `PLAN.md` and `scripts/` re-included).

## Shot list, strongest first

| # | Clip | What happens | What the viewer should notice |
|---|------|--------------|-------------------------------|
| 01 | `study-dial` | Co-op Blues at L0, then the dial clicks L1 → L4, a hover on the move count, then Original ↔ Reharm. | Coloured move patches spread across the lead sheet. The move count climbs from 0 to 12. Each level has its own density and name (Inside, Colour, Bold, Out). |
| 10 | `practice-heatmap` | Connect a (fake) MIDI keyboard, go to Practice, and press Play. An F blues line is sent through MIDI for about three choruses, then Stop. | The playhead moves, and the HUD calls each chord with its scale on a mini keyboard (B♭ Lydian dominant, A Locrian ♮2, C Phrygian dominant). The heatmap fills with chord-tone, tension and avoid colours under each chord. |
| 13 | `improv-fullscreen` | Practice, Play, then ⛶ Improv. A fake MIDI F blues line plays under each lens: Full → Guide tones → Simple → Blues. Esc goes back to Practice, with the heatmap full. | Everything but the chord and the piano drops away. The big chord name shows its scale ("C Dorian", "F blues"), with the next chord in the corner. Each struck key lights with its verdict: chord tone, tension, or a ✕ for a pass-through note. |
| 14 | `band` | Study: Play, then ▾ Band. Mute drums and bass, then bring them back. Drag tempo 168 → 120 → 182. Advanced: drag the bass fader, step through the band styles (As written → Walking → Bass in 2 → Ballad → Bossa), switch piano voicings, drag swing even → hard, then click to reset to 2:1. | Each player's doodle greys out when muted. The style hint and swing readout change ("50% · even" … "75% · hard"). All of it happens while the band keeps playing. |
| 06 | `coach-learn` | Coach opens on 7th chords (steps 1–3), then All concepts → Secondary ii–V. The prerequisite note appears; click Continue anyway and walk all 5 steps, including Show me. | The pen keyboard marks each key with its role. The prerequisite note recommends but never locks. Step 3's two-line labels show "V / 3rd", "ii / 7th" and the held "ii→V / 3→7". |
| 02 | `study-move-card` | Select the tritone sub card, open a chord chip's decoder, click ▶ Before / ▶ After, then walk "Why it works" (Show me, Next…) to "Recreate it". | Each chord symbol decodes to its spelling. The lesson steps light the keys and land on a rule you can reuse in any tune. |
| 08 | `changes-game` | Make the Changes → Guided → Start, four rounds, then why? on the first two. | The chord bubble lands on its target. A "Right" answer is explained; an "Also works" (the tritone sub) answer gets its own note. The points and streak counter ticks up. |
| 03 | `study-transpose` | Key picker (circle of fifths) → D♭, scroll, then up a half step twice (D, E♭), then back to F. | The whole chart respells correctly: flats in D♭, sharps in D (F♯, C♯). The reharm moves are kept in every key. |
| 04 | `engine-xray` | ⋯ More → Engine X-ray, step through bars 3–6, then the Proof tab. | Every rule is proposed, then rejected with a reason (strike-through, "A is the 5 of Dm7♭5…") or kept with a score. The proofs run live: 9 claims × 200 fast-check cases, all held. |
| 07 | `coach-ladder` | Tritone sub: finish Learn → Study it. Hover the ladder, the drill keyboard and the 12-key ribbon; click Next key (F → B♭). | The Learn → Study it → Self-check → Play it ladder. The drill shows left- and right-hand voicings on the keys. The ribbon reads 0/12 clean (your own runs only), with the sample passport labelled beside it. |
| 09 | `voicings` | Cmaj7 as Shells → Close (rootless) → Drop 2, then F7(♭9) in F, then ii–V–I major stepped Gm7 → C7 → Fmaj7, and Hear the ii–V–I. | Left and right hands are colour-coded, and each tone has its label (R, 3, 7, 9, ♭9). Very little hand movement between the shapes of the ii–V–I. |
| 11 | `passport-path` | Progress → Today's practice; click through three passport pages; Path tab; unfold Core colours; Practise → into the Coach. | SM-2 due items with overdue labels; 12-key stamp grids. The Path's tiers and "→ next" chips. The demo's sample notebook is labelled "Sample notebook" everywhere it appears (rule 11). |
| 05 | `go-deeper` | Walk the ii–V-into-the-I lesson to its end. | "Recreate it" (the rule), then "Go deeper": every melody note checked against the new chords (✓), and the voice leading (E → F ½ step, B♭ → A ½ step). |
| 12 | `phone` | Pixel 5: the dial L1 → L4, scroll the lead sheet, open a card's lesson, then the Coach opens on that move's lesson. | The layout reflows to one column, and the lesson keyboard still fits. |

### Not recorded, and why

- **✍ Deep dive (Claude's written explanation).** The demo build shows the button only when `apps/api/demo/explanations.json` is Claude-written. The shipped file says `"source": "template"`, so the button is hidden on purpose and the clip would be empty. Recording it needs either a Claude-written demo file (`demo:generate`, which spends API credit) or the dev app with a key (which risks the real database). Clip 05 shows "Go deeper" instead.
- **iReal Pro import / setlists.** They write to the library, so they don't belong in a demo recording.
- **Sound.** Covered above: every clip is silent.

## Notes from the recording run

- Headless Chromium drives Tone's transport and `requestAnimationFrame` fine: the Practice playhead, the HUD and the heatmap all animate.
- The heatmap clears at each chorus, so the end of clip 10 shows the start of a fresh chorus after Stop.
- **Captions:** clip 10 puts its captions at the top, so they don't cover the heatmap. Elsewhere the bottom caption sometimes sits over the third system of the lead sheet.
- **Clip 07:** the first second shows the concept rail scrolled down, from opening "All concepts".
- **Clip 13:** the recording stubs `requestFullscreen`. In headless Chromium, real fullscreen resizes the window past the recorded frame, so the clip only kept its top-left corner. The overlay fills the window anyway, so the clip looks the same as fullscreen in a real browser.
- **Clip 14 is the one that most needs sound:** muting, style, voicing and swing are all heard rather than seen. The Advanced popover's text is small at 1440×900, so crop or zoom in when editing.
- **Clip 12:** the phone clip is upscaled from CSS pixels, so it's a little soft. Playwright's screencast captures at the viewport size, not at the device pixel ratio.
