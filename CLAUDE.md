# Reharm Lab (The Woodshed)

Jazz-piano reharmonization and practice app: npm workspaces with `packages/theory-core` (deterministic theory engine), `apps/web` (React/Vite UI) and `apps/api` (Hono proxy). Remote: `github.com/itailiors/TheWoodshed`.

Reference (read when relevant): `docs/STATE_OF_THE_UNION.md`: §1 file tree, §3 design-system constraints, §4 what works now, §5 the last recorded next steps, §6 commands and endpoints. Latest session handoff: `docs/HANDOFF.md`.

<!-- §0 and §2 below were moved verbatim from docs/STATE_OF_THE_UNION.md so they load in every session. -->

## 0. How to work on this repo

- **The user.** Itai is an advanced jazz pianist (Bill Evans and Shaun Martin vocabulary) and a developer. Explain moves musically and precisely; skip basic theory definitions. Away from his MIDI keyboard he asks for work that can be verified without one.
- **Check before building.** Several requested features already existed: the L3/L4 rules, CI, demo mode, the practice-history backend. Before writing anything, grep the repo and `git log`; say so if it's done, and build only the real gap.
- **Workflow:**
  - Run every command from the repo root. Run `npm run typecheck` and `npm test` before saying anything is done.
  - Verify UI in the browser preview. `.claude/launch.json` has `web` (:5173), `api` (:8787) and `web-demo-build` (:4174, serves `apps/web/dist-demo`; run `npm run build:demo` first).
  - Read data from the page with JavaScript; screenshots can fail while the browser pane is hidden.
- **Commits.** Itai usually stages, commits and pushes himself, and wants a list of changed files plus a suggested message. Only commit when asked; if you do, end the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Protect Itai's data.** The `api` preview writes to `apps/api/data/reharm.sqlite`, his real library and practice history.
  - Never send test POSTs (practice runs, imports, deletes) to it.
  - **Watch out:** if the dev app is on the Coach page and you inject fake MIDI or QWERTY notes, the Coach grades them. A *finished* run is saved to the real database. Test input in Study mode, in the static demo build (which never writes), or against a scratch database.
  - For end-to-end checks: take a `sha256sum` of the real database, copy it to the scratchpad, stop the `api` preview, and run a temporary API with `REHARM_DB=<scratch copy> npx tsx src/index.ts` from `apps/api`. When finished, kill it, restart the `api` preview, and re-check the checksum.
  - A read-only check of the real database: `curl -s localhost:8787/api/practice/progress`.
- **Process gotcha.** Stopping a background `npx tsx` task can leave its child `node` process orphaned, still holding port 8787.
  - Find it with `netstat -ano | grep :8787`, then check its command line with `Get-CimInstance Win32_Process`.
  - A command line without `watch` is a temporary server, and safe to kill. The `api` preview runs under `tsx watch`; leave that one.
- **Windows shells:**
  - Don't use `VAR=x cmd` inside npm scripts; use flags (`--demo`) or Vite mode files (`--mode demo`).
  - For multi-line Python edits, write the script to the scratchpad with the Write tool and run it. Bash heredocs containing backticks and quotes have failed here.
- **Vite HMR gotchas:**
  - If one edit *uses* a symbol and a later edit *adds* it, the page can crash in between. `PanelBoundary` contains such crashes to one drawer; reload before deciding something is broken.
  - Every new copy of `player.ts` disposes the previous player through `globalThis.__reharmPlayer`. `import.meta.hot.dispose` doesn't work here.
  - An edited module is served as `/src/x.ts?t=…`, so a console `import('/src/x.ts')` gets a *different* instance from the app's. To reach the live module, take its URL from `performance.getEntriesByType('resource')`.
- **Hidden browser pane gotchas:**
  - `requestAnimationFrame` never fires, so `Tone.Draw` visuals and view transitions stall.
  - To test: override `window.requestAnimationFrame` with a 16 ms `setTimeout`, and call `Tone.getDraw().cancel(0)`.
  - The `setMode` view transition has a 400 ms fallback that commits anyway.
- **React StrictMode** runs effects twice in dev. Async effects need a `live` flag (see "restore last tune" in `App.tsx`).
- **Testing MIDI without hardware:**
  - Replace `navigator.requestMIDIAccess` with a fake `{ inputs: Map, onstatechange }` and click Connect MIDI.
  - To send notes, call `input.onmidimessage({ data: Uint8Array, timeStamp })`.
  - To simulate an unplug, delete the input from the map, set `state = "disconnected"` and fire `onstatechange({ port })`.

---

## 2. Architectural rules (do not break these)

0. **Bundled tunes and rights.** `BUNDLED_TUNES` (theory-core) is the demo library and what a fresh database is seeded with, and the API's `getTune` falls back to it. `Tune.rights` records who owns a tune: `original` shows the stamp; `public-domain` means **chord changes only**, never a melody unless it's verified against the original sheet music AND free under life + 70. Move ids are positional, so anything keyed by move id (the demo Deep Dive file) must also check the tune id.
0. **The reference tune is `referenceTune` (Co-op Blues), exported by theory-core.** The app, the API seed, the demo explanations and the demo history all derive from it; never hard-code a tune id. Changing the tune means: golden test, `demo:generate -- --template`, and the history generator.
1. **theory-core is deterministic and decides every pitch.** Harmony, voicings, scales, melody checks, coach diffs, line evaluation, bass lines and drum patterns are pure, synchronous TypeScript. Anything "random" is **seeded** per tune.
2. **The LLM never computes notes.** `/api/explain` recomputes the move and sends Claude only `buildFacts(tune, move)`. Claude writes prose only (`{summary, deepDive, recreateRule}`, Zod structured output), keeping the facts' spelling.
   - Model `claude-opus-5-5` (env `EXPLAIN_MODEL`), `output_config {effort: "medium", format}`, `betas ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, `cache_control` on the system prompt.
   - Bump `PROMPT_VERSION` when the prompt changes. A transposed id `base@Key` is transposed server-side.
3. **Spelling matters.** Notes are letter + accidental; `transpose()` keeps letter steps and semitones.
4. **Rules are interval-relative** to their local target. That's why move ids (`ruleId@bar.beat`) survive transposition. New rules go through `ruleKit.ts`, register in `ruleset.ts`, must fill the replaced span exactly, and get a property test.
5. **The melody filter is authoritative.** A move with an avoid note under the melody is rejected with a reason.
6. **Pathway:**
   - Phrase windows with `DENSITY` caps (L1 1 per 8 bars, L2 1 per 4, L3 2 per 4, L4 uncapped).
   - Rank = `level×2 + score − 1.5×(earlier uses of the rule)`.
   - User picks are forced in.
7. **Traces are the engine.** `generateMoves` and `buildPathway` wrap their `…Traced` versions; the `trace-honest` proof enforces it. Never fork the logic.
8. **One definition of the claims.** `PROOFS` in `src/testing/proofs.ts` run in CI *and* in the browser Proof tab.
9. **Database:** SQLite through Drizzle on **sql.js** (never native drivers).
   - `persist()` writes only to the file passed to `openDb()`.
   - A schema change requires `npm run db:generate -w @reharm/api` and committing `drizzle/`.
   - Tests use temp databases behind the `REHARM_DB` sentinel.
10. **Practice history:**
    - The **server** grades and schedules SM-2 per `(ruleId, keyTonic)`; the client sends `chartId(tuneId)`.
    - Sessions close on `pagehide` via `sendBeacon`.
11. **Demo mode spends nothing and writes nothing.**
    - API `--demo`: no database, 403 on writes, `/practice` returns 404.
    - Static `build:demo` makes **zero `/api` requests**. Writes are no-ops, and **reads of practice history come from the seeded `demoHistory.json`**, which the UI always labels as a sample.
    - Never present seeded data as real.
12. **Audio:**
    - `player.ts` is Tone-free; `engine.ts` (lazy) owns Tone.js.
    - The band is scheduled with look-ahead. **Live notes use `Tone.immediate()`**, never `Tone.now()` (+100 ms).
    - UI sync goes only through `Tone.Draw` or `player.currentBeat()`.
    - The count-in is on the audio clock.
    - `audio/unlock.ts` is installed once in `main.tsx`; it must stay Tone-free (it only calls `player.resume()`).
13. **Input: notes go through `noteBus`, controllers through `controlBus`.**
    - Sources: MIDI (`useMidi`), on-screen keys (`virtual`) and the computer keyboard (`qwerty`). Tools subscribe to the bus (`useChordStrikes`, the heatmap), never to a source directly.
    - **Every source must guarantee a note-off for every note-on:**
      - MIDI releases per device on unplug, All Notes Off, or unmount;
      - QWERTY releases everything on blur, a hidden tab, or switching off.
    - Controller features subscribe to `controlBus`, never to MIDI. The pedal only *sets the level*; it must not clear picks or selection (`changeLevel` does that for clicks), and it must stay opt-in.
    - QWERTY sounds its own notes through the player. MIDI is sounded by `midi/monitor.ts` (a noteBus + controlBus listener): on by default and persisted in `reharm.midiMonitor`, with the sustain pedal (CC64) honoured. "🔊 Hear it in the app" / "🔇 Keyboard speakers only" shows next to the MIDI pill once a keyboard is connected. Clicking Connect MIDI warms up the audio engine, because MIDI messages aren't user gestures and can't unlock audio themselves.
14. **Resilience:**
    - One `apiStatus` poller is the source of truth.
    - Library errors carry an HTTP status.
    - Drawers and pages sit inside `PanelBoundary`.
    - A view transition never blocks a mode switch.
    - Production console stays clean; debug logging is `import.meta.env.DEV` only. Tone's version banner is the only log.

---

## Definition of done

- `npm run typecheck && npm test` from the repo root, both passing. A Stop hook runs them automatically when `.ts`/`.tsx` files changed. Report the result; never say "done" without it.
- UI changes: verify in the browser preview (see §0 for the launch configs and how to read the page with JavaScript).
- Never send writes to the real database while verifying (see §0 "Protect Itai's data").

## Sessions

- One task per session. When it's done: `/handoff` (saves to `docs/HANDOFF.md`), then `/clear`. A SessionStart hook loads the handoff, branch and recent commits into the next session, so nothing needs pasting.
- For multi-step plans, `/next-steps N` runs N steps with the checks above and a commit after each. Per §0, it commits but does not push; Itai pushes.
