# Handoff (2026-11-23, session 22)

## Goal
Try an experimental band sound modelled on a reference track Itai supplied (a 210 BPM swing backing, "It Don't Mean a Thing"), then tidy up after PR #13.

## Done
- PR #13 (beginner nice 9–12) and #12 (session 20 handoff) are merged to main (0a402df). Local branches `fix/beginner-nice-9-12` and `docs/session-20-handoff` deleted; remotes pruned.
- dcc21fa on `exp/warm-band-tone` (pushed, **no PR yet**): Mixer › 🎷 Band › Sound = Clean (default, unchanged) | Warm club (experimental).
  - `apps/web/src/audio/bandTone.ts` (new, Tone, lazy chunk only): per-instrument low shelf / peak / high shelf / low-pass / trim for the backing piano, bass and drums, then a 2:1 glue compressor plus a make-up trim on the band bus. The player's piano has its own reverb and bypasses all of it.
  - The setting is `tone` in `bandFeel.ts` (`reharm.bandTone`); the engine applies it without re-laying parts; "Reset feel" resets it.
  - Measured in the browser at 210 BPM: Warm is within ~2 dB per band of the reference, centroid 443 Hz (ref 333, Clean 3.2 kHz), loudness matched to Clean (−25.5 vs −25.3 dB). Clean measures identical to the old sound.
- Checks: typecheck clean; test 1183 core + 54 api + 212 web.

## In progress
- Itai hasn't listened to Warm yet. He chose "keep as an option" (Clean stays the default).

## Next 3 steps
1. Itai: A/B Warm by ear; if it stays, open a PR from `exp/warm-band-tone` (auto-merge per the standing rule).
2. Read the ⚙ counters after a week of real use (STATE_OF_THE_UNION §5 item 2); 3f and "mark foundations known" stay parked until then.
3. Itai: og-card re-render (still says "11 rules" / "8 claims") and the paid demo Deep Dives (hard stops).

Previously listed as open, all already on main: the `missingInKey` notice was removed in 47eb468; UI/UX nice 10 (Path wall) and teacher N13 (mediant step 3) landed in ff9e242.

## Decisions + why
- Warm is an option, not the default (Itai).
- Plain biquads rather than Tone.EQ3: EQ3 loses ~1.3 dB at 0 dB gains (its crossovers don't sum flat), so Clean wouldn't have been the original sound.
- WebAudio's DynamicsCompressor adds its own make-up gain (~5 dB here); `glue.makeup: -4` takes it back so the A/B isn't won by loudness.
- The rest of the gap to the reference is the GM drum samples themselves; better ride/brush samples would be the next lever, not more EQ.

## Gotchas
- Tone can't ramp a dB param that sits at 0 (exponential ramps), nor a compressor threshold at 0 dB: use `linearRampTo` / `setValueAtTime` (see `bandTone.ts`).
- `toneIsolation.test.ts` lists every module allowed to import `tone`; `bandTone.ts` was added to it.
- Measuring the mix: connect an AnalyserNode to `Tone.getDestination().output` from the page (Tone module URL from `performance.getEntriesByType('resource')`), solo with `player.setMix`. Long measurements must run detached and be polled (javascript_tool times out at 45 s).
- The reference-analysis script (`analyze.py`, numpy/scipy via `uv run --with`) lives in this session's scratchpad only.

## Suggested skills
- `ship` / "PR and merge" once Warm is approved.
- `run` or the `web` preview (:5173, Study mode) to hear or re-measure the band.
