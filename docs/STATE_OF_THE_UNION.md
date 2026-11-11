# Reharm Lab: State of the Union

> Context hand-off for a fresh session: paste it in as the opening context.
> Updated 2026-11-11, end of the "Co-op Blues + Expression Pedal" session.
>
> **Git state when this was written:** the Must-Be floor is committed as `7834922` on `main`. The Co-op Blues swap and the Expression Pedal (§4) were in the **working tree, uncommitted**. Run `git status` and `git log --oneline -5` first. If those files still show as modified or untracked, they still need committing (Itai commits and pushes himself).
>
> **Reharm Lab** is a jazz-piano reharmonization and practice app. It is the flagship portfolio piece of **ITAI LIOR // SOFTWARE & JAZZ CO-OP**: a genuine practice tool for advanced players, and a showcase of full-stack engineering. The goal of the current phase is a **public portfolio launch** aimed at **hiring managers at top-tier tech and music-tech companies**. The message is *"a product-minded full-stack builder who writes rigorous, edge-case-proof code."* It stands alone as its own link, inside the Software & Jazz Co-op brand. Only the **static, read-only demo** ships publicly, so there are no API costs.
>
> Repo root: `C:\Users\itail\Documents\claude\jazz_P`. Remote: `origin` → `github.com/itailiors/TheWoodshed`. Windows 11, Node 22.11, **npm workspaces** (pnpm isn't installed).

---

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

## 1. File tree (every source file; per-package tsconfig/package.json/index.html/vitest configs omitted)

`★` marks files added or changed in the Must-Be floor session.

```
.claude/launch.json               preview configs: web, api, web-demo-build
.github/workflows/ci.yml          npm ci → typecheck → test → Drizzle drift check → build → build:demo → upload demo artifact
.gitattributes  .gitignore        (ignores .env, apps/api/data/, .cache/, dist*/)
README.md                       ★ portfolio README; now has the QWERTY section, mobile audio/stuck notes, sample notebook, Roadmap + "Musician's Wishlist"
docs/STATE_OF_THE_UNION.md      ★ this file
package.json                      workspaces + scripts (dev, dev:demo, test, typecheck, build, build:demo)
tsconfig.base.json

packages/theory-core/             THE ENGINE: pure, deterministic TypeScript, no runtime dependencies
  package.json                    exports "." and "./testing" (the latter pulls in fast-check; app code never imports it)
  src/types.ts                    Tune, ChordEvent, Quality, ReharmMove, MelodyCheck, …
  src/pitch.ts                    spelled pitches (letter + accidental), transpose, chroma, midiOf, spellMidi, prettyNote/prettySymbol
  src/chords.ts                   QUALITY_FORMULA, chordTones, guideTones, symbol()
  src/time.ts                     absBeat, formBars, sortedHarmony, melodyIn
  src/melody.ts                   classifyNote: avoid-note logic
  src/voiceLeading.ts  src/voicing.ts   guide-tone motion; close-position voicings with minimum movement
  src/scales.ts  src/improv.ts    chord-scale suggestions; improvMap
  src/ruleKit.ts                  Rule/Proposal types and helpers (tidy, splitBeats, distribute, chain)
  src/rules.ts                    CORE_RULES: secondary ii–V (+ "add the related ii", L1), tritone sub, upper structure, gospel turnaround
  src/rulesAdvanced.ts            ADVANCED_RULES: passing °7, backdoor ii–V, ♭VI–♭VII–I, borrowed iv, common-tone °7, Coltrane, constant structure
  src/ruleset.ts                  RULES = [...CORE_RULES, ...ADVANCED_RULES]   (11 rules, L1–L4)
  src/engine.ts                   generateMovesTraced → generateMoves is a thin wrapper
  src/pathway.ts                  DENSITY caps; buildPathwayTraced → buildPathway wraps it; realize()
  src/band.ts                     walkingBass / twoFeelBass / humanizeWalk; drumPattern (ride/hat/snare/brush/kick)
  src/coach.ts  src/lineEval.ts   drillSteps, diffStrike, diffVoiceLeading; evaluateLineNote, chordAtBeat
  src/transpose.ts                KEYS (flat-side spellings: C Db D Eb E F Gb G Ab A Bb B), transposeTune (id → `${id}@${key}`)
  src/analysis.ts                 Roman numerals
  src/import/ireal.ts             iReal Pro irealb:// parser
  src/fixtures/coopBlues.ts     ★ "Co-op Blues" (Itai Lior): THE reference tune. Original 12-bar bebop blues in F, 4/4 swing, ♩=168, full head
  src/fixtures/standards.ts     ★ public-domain standards, CHORD CHANGES ONLY: sunnySide (C, AABA 32) and iGotRhythm (B♭, 32-bar jazz form),
                                  with rights {kind: "public-domain", note}. BUNDLED_TUNES = [coopBlues, sunnySide, iGotRhythm] (index.ts)
  src/fixtures/someday.ts         Someday My Prince Will Come, bars 1–8 (copyrighted melody): golden-test fixture only, no longer shipped in the app
  src/control.ts                ★ DIAL_CONTROLLERS {modWheel: 1, expression: 11}, pedalToLevel (hysteresis, PEDAL_MARGIN 6), levelBand
  src/testing/arbitraries.ts      fast-check generators
  src/testing/proofs.ts           PROOFS: 8 claims as executable properties, run by CI AND by the app's Proof tab
  src/testing/index.ts
  test/*.test.ts                  pitch, rules.property, advancedRules, someday.golden, coopBlues.golden ★, control ★, voicing, practice, ireal, band, proofs
  test/arbitraries.ts             re-export shim

apps/api/                         Hono on Node (tsx), SQLite via Drizzle on sql.js
  .env.example                    ANTHROPIC_API_KEY, EXPLAIN_MODEL, PORT (real .env is git-ignored and currently absent → key MISSING)
  drizzle.config.ts  drizzle/0000_init.sql  drizzle/0001_practice_history.sql
  demo/explanations.json        ★ pre-written Deep Dives for the demo, keyed by move id; "tuneId": "coop-blues"; "source": "template" (17 moves)
  scripts/generate-demo.ts        npm run demo:generate (Claude, costs Itai's budget: ASK first) / -- --template (free, engine text)
  src/index.ts                    loads .env; --demo flag; serve(createApp())
  src/app.ts                    ★ createApp({demo, dbFile?}): /health /tunes /setlists /import/ireal /explain /practice/*; seeds referenceTune into an empty DB;
                                  getTune falls back to the built-in referenceTune, so a library seeded before the swap still serves Co-op Blues
  src/explain.ts  src/prompt.ts   buildFacts → Claude structured output, disk cache; ExplainError codes no_key | bad_key | rate_limited
  src/demo.ts                     demo explanations (transposed tunes get the engine's text)
  src/db/client.ts                openDb/persist (writes ONLY to the opened file; temp file + rename)
  src/db/schema.ts                tunes, setlists, setlist_tunes, practice_sessions, coach_attempts, improv_runs, concept_reviews
  src/db/repo.ts                  library queries
  src/db/practiceRepo.ts          sessions, recordCoachAttempt (grade + SM-2 upsert), recordImprovRun, cleanKeys, dueConcepts (+lastPlace), lastPlaceFor
  src/practice/srs.ts             gradeAttempt (0–5); scheduleReview: miss → 10 min, reps 1 → 1 day, reps 2 → 3 days, then interval × ease (min 1.3)
  src/practice/routes.ts          zod-validated /api/practice/* (404 in demo)
  test/setup.ts                   REHARM_DB → a sentinel path that must never be created
  test/api.test.ts  test/srs.test.ts   (api.test uses referenceTune)

apps/web/                         React 19, Vite 6, Tailwind v4, Rough.js, Tone.js 15
  .env.demo                       VITE_DEMO_MODE=true (vite --mode demo)
  vite.config.ts                  /api proxy → :8787; manualChunks: react vendor chunk
  scripts/gen-demo-history.ts   ★ generates src/library/demoHistory.json from referenceTune (seeded RNG, SM-2-consistent); throws if a
                                  passport place isn't an accepted move. Run: npx tsx apps/web/scripts/gen-demo-history.ts apps/web/src/library/demoHistory.json
  src/main.tsx                  ★ installs installAudioUnlock(), installQwertyKeys() and installPedal() before render
  src/App.tsx                   ★ modes (study | practice | coach), tune + global key, dial (level state, changeLevel), pathway, drawers;
                                  the passport (📒 button, side rail, dashboard) is now open in the demo too
  src/lazy.ts                     lazyWithPreload + whenIdle
  src/demo.ts                     DEMO flag; lazy demo explanations
  src/index.css                   @theme tokens, fonts, keyframes, view-transition rules, reduced-motion
  src/design/tokens.ts            hex mirrors of the tokens, CATEGORY_WASH, VERDICT_COLOR, seedOf
  src/design/rough.tsx            useRough, useSize, SketchBox, SketchRule, SketchFilters
  src/audio/player.ts           ★ Player FACADE (no Tone import); noteOn(midi, velocity?) ; resume()
  src/audio/engine.ts           ★ AudioEngine (all Tone.js); live noteOn/noteOff on Tone.immediate(); resume() wakes a suspended context
  src/audio/unlock.ts           ★ iOS: navigator.audioSession.type="playback" + looping silent <audio> (in-memory WAV) on first gesture;
                                  every pointerdown/keydown/touchend → player.resume(); pauses the element when hidden
  src/audio/band.ts               sampled bass + GM drum kit, synth fallbacks, humanTime/humanVel
  src/audio/usePlayback.ts  src/audio/useMixer.ts
  src/midi/controlBus.ts        ★ every MIDI Control Change {cc, value, channel, device}; useControlBus
  src/midi/pedal.ts             ★ pedal store: opt-in link ("reharm.pedal"), CC1/CC11 → pedalToLevel, last-moved controller wins; usePedal, usePedalLevel
  src/midi/noteBus.ts           ★ NoteMsg.source: "midi" | "virtual" | "qwerty"; useNoteBus; useChordStrikes
  src/midi/useMidi.ts           ★ per-device held notes (heldBy: port id → Set); releases them on unplug / CC120 / CC123 / unmount,
                                  as note-offs on the bus, plus a toast; ignores offs for unseen keys; DEV-only console.debug logging; forwards every CC to controlBus
  src/midi/qwerty.ts            ★ computer keyboard → noteBus + player; e.code layout; Z/X octave; M toggle; capture-phase so it
                                  pre-empts page shortcuts while on; releaseAll on blur/hidden; state persisted in "reharm.qwerty"
  src/library/api.ts  src/library/apiStatus.ts
  src/library/practice.ts       ★ practice-history client; in DEMO, fetchProgress/fetchDue read the seeded history (writes stay no-ops)
  src/library/demoHistory.ts    ★ hydrates the fixture relative to now → Progress (same rules as the API: clean = cleanRuns > 0, due = dueAt ≤ now)
  src/library/demoHistory.json  ★ Co-op Blues: 31 reviews across 6 rules (5 due), 20 improv runs (45% → 75% chord tones), places → move ids
  src/components/
    LeadSheet.tsx  ChordName.tsx  DoodleKeyboard.tsx  ImprovCard.tsx  MoveCard.tsx  DeepDive.tsx
    OriginalStamp.tsx ★ Rough.js rubber stamp "ORIGINAL COMPOSITION © 2026 ITAI LIOR // SOFTWARE & JAZZ CO-OP", shown in Study's
                       lead-sheet footer when tune.rights.kind === "original" (not in Practice: it would cover the staff)
    LevelDial.tsx ★ the dial + PedalLink toggle ("🦶 Link to mod wheel / pedal"); red ink needle tracks the raw CC value, .dial-snap on level change
    TransportBar.tsx ★ (+QwertyToggle)  TrioMixer.tsx  BeatPulse.tsx  KeyPicker.tsx  ModeSwitch.tsx  SideRail.tsx
    QwertyToggle.tsx ★ the ⌨ pill: "No MIDI? Play with your keyboard (M)" / "Keys on · A = C4", Z−/X+ buttons, held notes, tooltip map
    LoadingLine.tsx  Toaster.tsx  OfflineBanner.tsx  PanelBoundary.tsx
    library/LibraryDrawer.tsx
    practice/PracticeMode.tsx ★ (+QwertyToggle when no MIDI; "M" in the legend; hides A/L while QWERTY is on)
    practice/ChordHUD.tsx  practice/ImprovHeatmap.tsx  practice/PenKeyboard.tsx
    coach/CoachPage.tsx ★ (+QwertyToggle; loads progress in the demo too)   coach/CoachDrill.tsx
    progress/PracticeDashboard.tsx ★ (red-pen "Sample notebook" notice in the demo)   progress/KeyMatrix.tsx
    xray/EngineXRay.tsx  xray/XRayPipeline.tsx  xray/ProofPanel.tsx  xray/proofs.worker.ts
```

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

## 3. Design-system constraints ("living lead sheet")

- **Look:** warm parchment paper, deep Blue-Note-style ink linework, earthy watercolour washes, red teacher's-pen corrections, everything hand-drawn. The name stays "Reharm Lab", since "Blue Note" is a trademark. ("Reharm Studio" was a slip; the product is Reharm Lab everywhere.)
- **Tokens:** Tailwind v4 `@theme` in `index.css`, mirrored as hex in `design/tokens.ts`.
  - paper `#f6e9c9` / light `#fbf3df` / shade `#ead7aa`
  - ink `#1e2a78` / soft `#3e4c9e` / faint `#8a93c4`
  - washes: blue `#5b85c2`, mustard `#e3b23c`, brick `#b9532f`, sage `#7e9c6b`
  - pen `#c2311f`
- **Fonts:**
  - Kalam (`font-marker`): headings, chords, buttons.
  - Architects Daughter (`font-hand`): body text.
  - Noto Music (`font-music`): ♭ ♯ 𝄞. The marker font has no accidentals.
- **Primitives:**
  - Rough.js via `useRough(ref, draw, deps)` with a stable `seedOf(id)` seed; `SketchBox`, `SketchRule`, `SketchFilters` (`#ink-wobble`, `#watercolor`).
  - Hand-authored SVG doodles use `stroke="currentColor"` + `filter="url(#ink-wobble)"`.
- **Visual language:**
  - Red pen for corrections and verdicts: circles, ✗, strikes, the CLEAN stamp, and notices like the demo's "Sample notebook".
  - Ink over a dashed ghost for now vs. before.
  - Watercolour wash for achieved or active states.
  - Pill buttons: solid ink border when on, dashed `ink-soft` when off. The MIDI and ⌨ QWERTY pills follow this.
- **Colour mappings:**
  - Categories: functional = mustard, dominant-sub/symmetric = blue, gospel = brick, voicing/modal = sage.
  - Heatmap: chord tone blue, tension mustard, avoid pen red, outside ink faint.
- **Lazy loading:**
  - Main chunk plus a React vendor chunk.
  - Tone.js, Rough.js, `LibraryDrawer`, `PracticeMode`, `CoachPage`, `PracticeDashboard` and `EngineXRay` are lazy (`lazyWithPreload`).
  - fast-check lives only in `proofs.worker`.
  - Demo-only data (`demoHistory`, the demo explanations) is dynamically imported, so normal builds don't carry it.
- **Layout:**
  - Study: two columns from `lg`.
  - Practice: locked to `h-dvh`.
  - Coach: three columns from `lg` (260 px | drill | 330 px).
  - Drawers: right-side sheets; Esc closes.
- **Motion and accessibility:**
  - Reduced motion disables animations and view transitions.
  - `aria-live` on the Coach prompt, audition caption, toasts and bar picker.
  - `data-midi` / `data-target` on keys, for future Playwright tests.

---

## 4. What works now (verified)

- **131/131 tests** (115 theory-core + 16 API) and a clean typecheck across all three workspaces. CI was green at `d81764b`; the Must-Be floor commit `7834922` and later work have not been checked in CI here.
- **Engine:** 11 rules (L1–L4), melody filter with reasons, voice-leading scores, density-capped pathways, scale map, voicings, Roman analysis.
- **Study, Practice and Coach modes** with continuity, which is unchanged from before.
  - **Shared across modes:** global key change, trio mixer, count-in, click and beat dot.
  - **Study:** the lead sheet, move cards, Deep Dive and "Practice this move".
  - **Practice:** HUD, heatmap and shortcuts.
  - **Coach:** strike and voice-leading diffs, the 12-key drill, and "hear the move" with chords moving.
- **Concept Passport:**
  - the SM-2 queue, where Practise → opens the Coach on the exact move and key;
  - 12-key pages;
  - a solo sparkline.
- **Engine X-ray:**
  - the per-bar decision pipeline;
  - the live Proof tab (8 × 200 fast-check cases in a Worker, with a SHA-256 handshake).
- **Library:** iReal Pro import, setlists, SQLite.
- **Resilience:** offline banner, no-key Deep Dive, deleted-tune toast, error boundaries, loading line.
- **The Must-Be floor** (the latest session; verified in the browser unless noted):
  - **QWERTY input.** Tested by injecting key events and watching the bus:
    - on/off messages go out with source `qwerty`;
    - a duplicate keydown is ignored;
    - after `X`, `K` plays C6 and the earlier notes release at their original pitch;
    - blur releases everything;
    - `M` toggles it, and `Z` is ignored while it's off.
  - **Stuck-note release.** Tested with a fake Web MIDI device:
    - hold C-E-G, unplug, and three note-offs reach the bus;
    - a stray note-off for an unseen key is dropped;
    - the toast reads "Fake Keystation 49 disconnected, so its 3 held notes were released."
  - **Seeded demo passport** (on `build:demo` at :4174):
    - the Coach shows the due queue and "7 of 12 keys" stamps;
    - the passport shows "Today's practice" (5 due, with overdue labels), 7 concept pages and the solo trend (45 → 75%);
    - Practise → opens the Coach on upper-structure triad in C;
    - zero `/api` requests, and a clean console.
  - **Not verified on a device:**
    - the iOS unlock (no iPhone available);
    - the latency improvement, by ear.
    - The code paths run without errors on desktop.

---

## 5. Exact next steps (in this order)

### Done in the last session (verify, then commit if needed)

**Co-op Blues** is the reference and demo tune.
- **The changes:** | F6 | B♭7 | F6 | Cm7 F7 | B♭7 | B°7 | F6 | Am7♭5 D7♭9 | Gm7 | C7 | F6 D7 | Gm7 C7 |
  - F6 on the tonic bars, because the tonic rules (gospel turnaround, backdoor ii–V, Coltrane, common-tone °7, ♭VI–♭VII) need a major-quality target. On an F7 tonic only three rules fired.
- **The head:** a full bebop line.
  - It uses the A♭→A blue-note slide, chromatic approach tones and anticipations across bar lines.
  - Over D7 it plays an altered line (F♯, E♭, B♭), and the 6th sits over the F6 bars.
- **How the dial builds:** L0 none → L1 1 move → L2 3 → L3 4 → L4 12. Six rules are accepted (secondary ii–V, tritone sub, upper structure, gospel turnaround, backdoor ii–V, constant structure), with 15 rejections that have audible reasons.
  - All of this is pinned in `coopBlues.golden.test.ts`.
- **Shipped files:** the demo bundle no longer contains "Someday My Prince Will Come" at all (grepped `dist-demo`).

**The Expression Pedal** drives the dial.
- **How it works:**
  - CC1 or CC11 travel through `controlBus` → `pedal.ts` → `pedalToLevel` (hysteresis) → `App`'s `usePedalLevel(setLevel)`. This keeps picks; clicking the dial still clears them.
  - It's opt-in with "🦶 Link to mod wheel / pedal" next to the dial, in both Study and Practice.
- **Verified with a fake MIDI device on the demo build:**
  - the CC was ignored until linked, and linking didn't jump the dial;
  - a 0→127 sweep went L0→L4 once each;
  - jitter at a band edge didn't flicker;
  - the mod wheel took over when moved;
  - **while the band played**, the lead sheet reharmonized at each pedal position;
  - the needle and snap render, and the console had no errors.
- **Not verified with a physical pedal yet.**

**The demo library and the Original Composition stamp** (the session after):
- **Itai's decision:** Co-op Blues stays the main tune. "On the Sunny Side of the Street" is public domain in the US only; under life + 70 (Israel, the EU, the UK) McHugh's melody is protected until the end of 2039.
- **What's bundled:**
  - Sunny Side and I Got Rhythm ship as chord changes only.
  - The Sunny Side changes were checked against an online chart. I Got Rhythm uses the standard 32-bar jazz form.
  - Sweet Georgia Brown and Bye Bye Blackbird were left out: no readable bar-by-bar source could be found.
- **In the demo:**
  - the Setlist drawer lists the three tunes, with no import or delete;
  - the demo history now spreads its passport places across the bundled tunes, and cross-chart "Practise →" was verified (Co-op Blues → Sunny Side's bar-2 ii–V in E♭);
  - the demo Deep Dive file is keyed by tune as well as move id, with an API test guarding the `functional.secondaryTwoFive@2.1` collision.
- **Ideas:** "Sunny Side" and "I Got Rhythm" melodies could be added only from the 1930 sheet music. Only Gershwin's is free under life + 70.

**Tests:** 132 (115 theory-core + 17 API); typecheck clean.

### Next: the launch track


- Deploy the static demo, plus a CI badge, OG/meta tags (`index.html` has none) and a 20-second README GIF: the dial turning, chords moving, proofs going green. This is higher ROI than any in-app onboarding, because many recruiters never click through.
- **Deep-link URLs:** `?tune=…&level=3&key=Bb&play=1`, with a ▶ overlay. These double as onboarding and as shareable reharm links.
- **Study-mode shortcuts** (Space, ← →, a `?` overlay) and showing the Practice legend below `xl`.
- **Second delighter:** Harmony Catcher (recommended), or the Reactive Rhythm Section.
- Smaller items:
  - a sustain-pedal policy;
  - an "audio blocked / tap to enable" status;
  - silence Tone's console banner (`TONE_SILENCE_LOGGING`);
  - heatmap shapes for colour-blind users;
  - focus rings;
  - Playwright golden paths, using the fake-MIDI recipe.

The **Musician's Wishlist** in the README holds the full set of ideas: Expression Pedal, Reactive Rhythm Section, Inner Voice Singing, Gig Mode and Harmony Catcher.

**Still open from before:**
- drag a bar range to loop it;
- Coach wait mode;
- tempo trainer;
- a swing slider and volume faders;
- band styles;
- MIDI melody capture;
- recording takes;
- a dark theme;
- Claude-written demo Deep Dives (ask before spending);
- real iReal testing at the piano;
- the Coach with a physical keyboard since it became a page.

---

## 6. Commands and endpoints

```bash
npm run dev            # web :5173 + api :8787
npm run dev:demo       # read-only demo (web + api)
npm test               # all workspaces (132 tests)
npm run typecheck
npm run build          # web → apps/web/dist
npm run build:demo     # static demo → apps/web/dist-demo
npm run db:generate -w @reharm/api                    # after editing apps/api/src/db/schema.ts
npm run demo:generate -w @reharm/api -- --template    # demo Deep Dives from engine text (free)
npm run demo:generate -w @reharm/api                  # Claude-written demo Deep Dives (costs API budget: ask)
npx tsx apps/web/scripts/gen-demo-history.ts apps/web/src/library/demoHistory.json   # demo practice history (validates move ids)
```

- **API:**
  - `GET /api/health`
  - `/api/tunes[/:id]`, `DELETE /api/tunes/:id`, `/api/setlists`
  - `POST /api/import/ireal {url}`
  - `POST /api/explain {tuneId (may be base@Key), moveId, fresh?}`
  - `/api/practice`: `POST sessions`, `POST sessions/:id/end`, `POST coach-attempts`, `POST improv-runs`, `GET progress` (concepts, places, cleanKeys, due, recentImprov), `GET due` (with `lastPlace`)
- **localStorage keys:** `reharm.tune`, `reharm.tune.title`, `reharm.mode`, `reharm.key:<tuneId>`, `reharm.mixer`, `reharm.countIn`, `reharm.qwerty` (`{enabled, base}`), `reharm.pedal` (`{linked}`).
- **Keyboard:**
  - Global: `M` toggles QWERTY. While it's on: `A`–`'` play notes, `W E T Y U O P` play black keys, `Z` / `X` change octave.
  - Practice: Space, ← →, A, L, `[ ]`, `, .`, 1–4, Esc.
  - X-ray: ← → and Esc. Drawers: Esc.
- **Sample sources:**
  - Salamander piano (tonejs.github.io);
  - `acoustic_bass` from gleitz/midi-js-soundfonts;
  - GM drum kits from surikov/webaudiofontdata (the base64 MP3 is decoded, the script is never executed);
  - check the licences before commercial use;
  - consider self-hosting the samples for the public demo.
