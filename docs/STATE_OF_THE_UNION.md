# Reharm Lab: State of the Union

> Context hand-off for a fresh session: use it as the system prompt.
> Snapshot of commit `a7da938` on `main`, pushed to `origin` (`github.com/itailiors/TheWoodshed`), CI green, working tree clean (2026-11-11).
>
> **Reharm Lab** is a jazz-piano reharmonization and practice app. It is the flagship portfolio piece of **ITAI LIOR // SOFTWARE & JAZZ CO-OP**: a genuine practice tool for advanced players, and a showcase of full-stack engineering.
>
> Repo root: `C:\Users\itail\Documents\claude\jazz_P`. Windows 11, Node 22.11, **npm workspaces** (pnpm isn't installed).

---

## 0. How to work on this repo

- **The user.** Itai is an advanced jazz pianist (Bill Evans and Shaun Martin vocabulary) and a developer. Explain moves musically and precisely; skip basic theory definitions. Away from his MIDI keyboard he asks for work that can be verified without one.
- **Check before building.** Several requested features already existed: the L3/L4 rules, CI, demo mode, the practice-history backend. Before writing anything, grep the repo and `git log`; say so if it's done, and build only the real gap.
- **Workflow:**
  - Run every command from the repo root. Run `npm run typecheck` and `npm test` before saying anything is done.
  - Verify UI in the browser preview. `.claude/launch.json` has `web` (:5173), `api` (:8787) and `web-demo-build` (:4174, serves `apps/web/dist-demo`).
  - Read data from the page with JavaScript; screenshots can fail while the browser pane is hidden.
- **Commits.** Itai usually stages, commits and pushes himself, and wants a list of changed files plus a suggested message. If asked to commit, end the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Protect Itai's data.** The running API writes to `apps/api/data/reharm.sqlite`, his real library and practice history.
  - Never run test POSTs (practice runs, imports, deletes) against it.
  - For end-to-end checks: take a `sha256sum` of the real database, copy it to the scratchpad, stop the `api` preview, and run a temporary API with `REHARM_DB=<scratch copy> npx tsx src/index.ts` from `apps/api`. When finished, kill the temporary process (see the next bullet), restart the `api` preview, and re-check the checksum.
  - Or test in the static demo build, which never writes.
- **Process gotcha.** Stopping a background `npx tsx` task can leave its child `node` process orphaned, still holding port 8787.
  - Find it with `netstat -ano | grep :8787`, then check its command line with `Get-CimInstance Win32_Process`.
  - A command line without `watch` is a temporary server, and safe to kill. The `api` preview's own server runs under `tsx watch`; leave that one.
- **Windows shells.** Don't use `VAR=x cmd` inside npm scripts; use flags (`--demo`) or Vite mode files (`--mode demo`). For Python edit scripts, use a `<<'PY'` heredoc; inline quoting breaks.
- **Vite HMR gotchas:**
  - If one edit *uses* a symbol and a later edit *adds* it, the page can crash in between. `PanelBoundary` now contains such crashes to one drawer; reload before deciding something is broken.
  - Every new copy of `player.ts` disposes the previous player through `globalThis.__reharmPlayer`, so stale Tone Parts can't keep playing. Vite runs `dispose` only on the module that accepts the update, so `import.meta.hot.dispose` wouldn't work here.
- **Hidden browser pane gotchas:**
  - `requestAnimationFrame` never fires, so `Tone.Draw` visuals (playhead, beat dot, count-in, Coach audition) and view transitions stall.
  - To test: override `window.requestAnimationFrame` with a 16 ms `setTimeout`, and call `Tone.getDraw().cancel(0)` to clear the stuck queue. Draw starts its loop only when an event joins an empty queue.
  - The `setMode` view transition has a 400 ms fallback that commits anyway.
- **React StrictMode** runs effects twice in dev. Async effects need a `live` flag (see "restore last tune" in `App.tsx`).

---

## 1. File tree (at `a7da938`; every source file, with per-package tsconfig/package.json/index.html/vitest configs omitted)

```
.claude/launch.json               preview configs: web, api, web-demo-build
.github/workflows/ci.yml          npm ci → typecheck → test → Drizzle drift check → build → build:demo → upload demo artifact
.gitattributes  .gitignore        (ignores .env, apps/api/data/, .cache/, dist*/)
README.md                         portfolio-grade README (features, stack, testing story, demo, roadmap)
docs/STATE_OF_THE_UNION.md        this file
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
  src/scales.ts  src/improv.ts    chord-scale suggestions (must contain every chord tone and melody note); improvMap
  src/ruleKit.ts                  Rule/Proposal types and helpers (tidy, splitBeats, distribute, chain)
  src/rules.ts                    CORE_RULES: secondary ii–V (+ "add the related ii", L1), tritone sub, upper structure, gospel turnaround
  src/rulesAdvanced.ts            ADVANCED_RULES: passing °7, backdoor ii–V, ♭VI–♭VII–I, borrowed iv, common-tone °7, Coltrane, constant structure
  src/ruleset.ts                  RULES = [...CORE_RULES, ...ADVANCED_RULES]   (11 rules, L1–L4)
  src/engine.ts                   generateMovesTraced (records every rule × chord attempt) → generateMoves is a thin wrapper
  src/pathway.ts                  DENSITY caps; buildPathwayTraced (one decision per candidate, with rank arithmetic) → buildPathway wraps it; realize()
  src/band.ts                     walkingBass / twoFeelBass / humanizeWalk (seeded triplet pickups, dropped beats, accents); drumPattern (ride/hat/snare/brush/kick)
  src/coach.ts  src/lineEval.ts   drillSteps, diffStrike, diffVoiceLeading; evaluateLineNote, chordAtBeat
  src/transpose.ts                KEYS (flat-side spellings), transposeTune (id becomes `${id}@${key}`), randomKey
  src/analysis.ts                 Roman numerals
  src/import/ireal.ts             iReal Pro irealb:// parser (unscramble, tokenize, repeats, qualities)
  src/fixtures/someday.ts         the reference tune (B♭, 3/4, bars 1–8 + resolution)
  src/testing/arbitraries.ts      fast-check generators (progressionArb, ROOTS, SPELLED)
  src/testing/proofs.ts           PROOFS: 8 claims as executable properties, run by CI AND by the app's Proof tab
  src/testing/index.ts
  test/*.test.ts                  pitch, rules.property, advancedRules, someday.golden, voicing, practice, ireal, band, proofs
  test/arbitraries.ts             re-export shim → src/testing/arbitraries

apps/api/                         Hono on Node (tsx), SQLite via Drizzle on sql.js
  .env.example                    ANTHROPIC_API_KEY, EXPLAIN_MODEL, PORT (the real apps/api/.env is git-ignored; currently absent → key MISSING)
  drizzle.config.ts  drizzle/0000_init.sql  drizzle/0001_practice_history.sql
  demo/explanations.json          pre-written Deep Dives for the demo (currently "source": "template", not yet Claude-written)
  scripts/generate-demo.ts        npm run demo:generate (Claude, uses Itai's key) / --template
  src/index.ts                    loads .env; --demo flag; serve(createApp())
  src/app.ts                      createApp({demo, dbFile?}): /health /tunes /setlists /import/ireal /explain /practice/*
  src/explain.ts  src/prompt.ts   buildFacts → Claude structured output, disk cache; ExplainError codes no_key | bad_key | rate_limited
  src/demo.ts                     demo explanations (transposed tunes get the engine's text instead)
  src/db/client.ts                openDb/persist (writes ONLY to the opened file; temp file + rename)
  src/db/schema.ts                tunes, setlists, setlist_tunes, practice_sessions, coach_attempts, improv_runs, concept_reviews
  src/db/repo.ts                  library queries
  src/db/practiceRepo.ts          sessions, recordCoachAttempt (grade + SM-2 upsert), recordImprovRun, cleanKeys, dueConcepts (+lastPlace), lastPlaceFor
  src/practice/srs.ts             gradeAttempt (0–5 from misses/leaps), scheduleReview (SM-2)
  src/practice/routes.ts          zod-validated /api/practice/* (404 in demo)
  test/setup.ts                   REHARM_DB → a sentinel path that must never be created
  test/api.test.ts  test/srs.test.ts

apps/web/                         React 19, Vite 6, Tailwind v4, Rough.js, Tone.js 15
  .env.demo                       VITE_DEMO_MODE=true (vite --mode demo)
  vite.config.ts                  /api proxy → :8787; manualChunks: react vendor chunk
  src/main.tsx  src/App.tsx       App: modes (study | practice | coach), tune + global key, dial, pathway, drawers, routing of entry points
  src/lazy.ts                     lazyWithPreload + whenIdle
  src/demo.ts                     DEMO flag; lazy demo explanations
  src/index.css                   @theme tokens, fonts, ink-in / beat-blot keyframes, view-transition rules, reduced-motion
  src/design/tokens.ts            hex mirrors of the tokens (Rough.js can't read CSS vars), CATEGORY_WASH, VERDICT_COLOR, seedOf
  src/design/rough.tsx            useRough (Rough.js loaded lazily), useSize (measures synchronously on mount), SketchBox(style?), SketchRule, SketchFilters
  src/audio/player.ts             Player FACADE (no Tone import): mix, count-in, load progress, listeners, playSequence(onStep); lazy-loads ./engine
  src/audio/engine.ts             AudioEngine (all Tone.js): piano Sampler, parts, count-in, click, atAudioTime, dispose
  src/audio/band.ts               sampled bass (midi-js-soundfonts) + GM drum kit (WebAudioFont base64 → buffers), synth fallbacks, humanTime/humanVel
  src/audio/usePlayback.ts        status, position, beatTick, count, countInBars, play/toggle (reads latest arrangement via ref)
  src/audio/useMixer.ts
  src/midi/useMidi.ts  src/midi/noteBus.ts      Web MIDI → noteBus; useChordStrikes
  src/library/api.ts              library client (LibraryError has .status / .unreachable)
  src/library/apiStatus.ts        shared /api/health poller: online/offline/demo + claudeKey; onceOnline, reportApiUnreachable
  src/library/practice.ts         practice-history client: lazy sessions, saveCoachRun, saveImprovRun, fetchProgress/Due, onPracticeSaved, chartId()
  src/components/
    LeadSheet.tsx  ChordName.tsx  DoodleKeyboard.tsx  ImprovCard.tsx  MoveCard.tsx  DeepDive.tsx  LevelDial.tsx
    TransportBar.tsx  TrioMixer.tsx (piano/bass/drums/click doodles)  BeatPulse.tsx (beat dot, CountInDisplay, CountInPicker)
    KeyPicker.tsx (circle-of-fifths global key)  ModeSwitch.tsx (Study | Practice | Coach)  SideRail.tsx
    LoadingLine.tsx  Toaster.tsx  OfflineBanner.tsx  PanelBoundary.tsx (error boundary for drawers/pages)
    library/LibraryDrawer.tsx
    practice/PracticeMode.tsx  practice/ChordHUD.tsx  practice/ImprovHeatmap.tsx (saves a run per loop pass)  practice/PenKeyboard.tsx (data-midi, data-target)
    coach/CoachPage.tsx           Coach mode: drill list (reharm moves, all other moves, due reviews) | CoachDrill | 12-key passport
    coach/CoachDrill.tsx          the drill: strikes, red pen, 12-key transfer, saves runs, audition with moving chords + voiceMotion caption
    progress/PracticeDashboard.tsx   Concept Passport: Today's practice clipboard (SM-2 queue), passport pages, recent-solos sparkline
    progress/KeyMatrix.tsx        12-key page (circle of fifths): CLEAN stamps, grades, due dots, current-key ring, compact mode
    xray/EngineXRay.tsx           X-ray drawer: "How it decided" + "Proof" tabs; follows the playhead or steps bars
    xray/XRayPipeline.tsx         per-bar pipeline: proposes → melody filter (red strike) → voice-leading bar → pathway verdict + rank formula
    xray/ProofPanel.tsx  xray/proofs.worker.ts   runs PROOFS live in a Web Worker (fast-check), SHA-256 determinism handshake
```

---

## 2. Architectural rules (do not break these)

1. **theory-core is deterministic and decides every pitch.** Harmony, voicings, scales, melody checks, coach diffs, line evaluation, bass lines and drum patterns are all pure, synchronous TypeScript. The browser runs the engine directly, so the dial, A/B switch and key changes recompute instantly. Anything "random" (bass variations, ghost snare notes) is **seeded** per tune, so it repeats.
2. **The LLM never computes notes.** `/api/explain` recomputes the move on the server and sends Claude only `buildFacts(tune, move)`. Claude writes prose only, as `{summary, deepDive, recreateRule}` enforced by Zod structured output. It must not invent pitches and must keep the facts' spelling.
   - Model `claude-opus-5-5` (env `EXPLAIN_MODEL`), `output_config {effort: "medium", format}`, `betas ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, `cache_control` on the system prompt.
   - Bump `PROMPT_VERSION` when the prompt changes; it's part of the cache key.
   - A transposed tune id `base@Key` is transposed server-side before the facts are built.
3. **Spelling matters.** Notes are letter + accidental (D7♯5 has A♯; B♭7(♭9) has C♭). `transpose()` keeps both letter steps and semitones.
4. **Rules are interval-relative** to their local target, never the global key.
   - That's why move ids (`ruleId@bar.beat`) survive transposition: picks, selection and loops carry across key changes.
   - New rules go through `ruleKit.ts` and register in `ruleset.ts`. Each rule's chords must sum to the replaced span (the engine throws otherwise), and each gets a property test of its musical invariant.
5. **The melody filter is authoritative.** A move with an avoid note under the melody is rejected with a reason. iReal imports have no melody, so they aren't checked.
6. **Pathway:** phrase windows with `DENSITY` caps (L1 1 per 8 bars, L2 1 per 4, L3 2 per 4, L4 uncapped). Rank = `level×2 + score − 1.5×(earlier uses of the rule)`. User picks are forced in and count toward their phrase's quota.
7. **Traces are the engine.** `generateMoves` and `buildPathway` are wrappers over their `…Traced` versions, so the Engine X-ray can't misrepresent decisions. The `trace-honest` proof enforces this. Never fork the logic.
8. **One definition of the claims.** `src/testing/proofs.ts` `PROOFS` run in CI (`test/proofs.test.ts`) *and* in the browser Proof tab. Add a claim there, not as a UI-only demo.
9. **Database:** SQLite through Drizzle on **sql.js** (WebAssembly). `better-sqlite3` segfaulted here; never reintroduce native drivers.
   - The database lives in memory; `persist()` writes it atomically to **the file passed to `openDb()`**.
   - A schema change requires `npm run db:generate -w @reharm/api` and committing `drizzle/`; CI fails on drift.
   - Tests run `createApp()` in-process on temp databases behind the `REHARM_DB` sentinel.
10. **Practice history:**
    - The **server** grades Coach runs (0–5 from misses and leaps) and schedules SM-2 reviews per `(ruleId, keyTonic)`; keys are normalised (A♯ and B♭ are the same).
    - The **client** sends `chartId(tuneId)`: a transposed id is reduced to its base chart.
    - Sessions open lazily and close on `pagehide` via `sendBeacon`. The demo build saves nothing.
11. **Demo mode spends nothing and writes nothing.**
    - API `--demo`: no database, 403 on writes, `/explain` serves the JSON or the engine template, `/practice` returns 404.
    - Static `build:demo` (`VITE_DEMO_MODE`): zero `/api` requests, no library, passport or offline banner. The X-ray, Proof tab and Coach all work.
12. **Audio:**
    - `player.ts` is a Tone-free facade, and `engine.ts` (lazy chunk) owns all of Tone.js. The engine is prefetched while idle, so the first Play still counts as a user gesture.
    - The parts are rebuilt on the Transport timeline, which is what makes A/B ghost switching seamless. The mix is read at every event, so mutes are instant.
    - UI sync is **only** through `Tone.Draw` (`onPosition`, `onCount`, `atAudioTime`) or `player.currentBeat()`, never independent timers.
    - The count-in is scheduled on the audio clock and the Transport is started at its end; `Clock.stop()` cancels a pending start.
13. **Input:** all notes (MIDI and on-screen) flow through `noteBus`. Tools subscribe there (`useChordStrikes` groups notes into chords), never to MIDI directly.
14. **Resilience:**
    - One `apiStatus` poller is the source of truth for online/offline/no-key.
    - Library errors carry an HTTP status (404 means a deleted tune, 0/502/504 means unreachable).
    - Drawers and pages sit inside `PanelBoundary`.
    - A transient view transition must never block a mode switch.

---

## 3. Design-system constraints ("living lead sheet")

- **Look:** warm parchment paper, deep Blue-Note-style ink linework, earthy watercolour washes, red teacher's-pen corrections, everything hand-drawn. The name stays "Reharm Lab", since "Blue Note" is a trademark.
- **Tokens:** Tailwind v4 `@theme` in `index.css`, mirrored as hex in `design/tokens.ts` (keep them in sync).
  - paper `#f6e9c9` / light `#fbf3df` / shade `#ead7aa`
  - ink `#1e2a78` / soft `#3e4c9e` / faint `#8a93c4`
  - washes: blue `#5b85c2`, mustard `#e3b23c`, brick `#b9532f`, sage `#7e9c6b`
  - pen `#c2311f`
  - Utilities: `bg-paper`, `text-ink`, `font-hand`, `font-marker`, `font-music`.
- **Fonts:**
  - Kalam (`font-marker`): headings, chord symbols, buttons.
  - Architects Daughter (`font-hand`): body text and notes.
  - Noto Music (`font-music`): ♭ ♯ 𝄞 glyphs. The marker font has no accidentals, so put accidentals in `font-music`.
- **Hand-drawn primitives:**
  - Rough.js draws through `useRough(ref, draw, deps)` and **always takes a stable `seed` (`seedOf(id)`)**. Primitives: `SketchBox` (border, fill, `style` for view-transition names), `SketchRule`, `SketchFilters` (`#ink-wobble`, `#watercolor`).
  - Hand-authored SVG doodles (mixer icons, metronome, red strikes, stamps, arrows) use `stroke="currentColor"` with `filter="url(#ink-wobble)"`.
- **Recurring visual language:**
  - **Red pen** for corrections and verdicts: circles for missing notes, ✗ for wrong ones, strikes through rejected moves, check stamps, the CLEAN stamp.
  - **Ink over a dashed ghost** for "now vs. before".
  - **Watercolour wash** for achieved or active states.
- **Colour mappings:**
  - Category washes: functional = mustard, dominant-sub/symmetric = blue, gospel = brick, voicing/modal = sage.
  - Heatmap verdicts: chord tone = blue, tension = mustard, avoid = pen red, outside = ink faint.
- **Lazy-loading rules:**
  - The main chunk is app code plus a cached React vendor chunk (about 109 kB + 223 kB).
  - Tone.js (the engine), Rough.js, `LibraryDrawer`, `PracticeMode`, `CoachPage`, `PracticeDashboard` and `EngineXRay` are separate chunks via `lazyWithPreload`, prefetched with `whenIdle` or on hover.
  - fast-check lives **only** in `proofs.worker`.
  - A new heavy screen must be lazy and wrapped in `Suspense` (an `Inking` fallback) plus `PanelBoundary`.
- **Layout:**
  - Study: two columns from `lg` up, `grid-cols-1` base, the sheet scrolls inside its own box.
  - Practice: locked to `h-dvh` with no page scroll.
  - Coach: three columns from `lg` up (260 px | drill | 330 px).
  - Drawers: right-side sheets with an `ink/20` overlay; Esc closes.
- **Motion and accessibility:**
  - `animate-ink-in`, `beat-blot` and view transitions are all disabled under `prefers-reduced-motion`.
  - `aria-live` on the Coach prompt, the audition caption, the toasts and the bar picker.
  - Every on-screen key carries `data-midi`; hinted keys carry `data-target` (hooks for future Playwright tests).

---

## 4. What works now (verified)

- **121/121 tests passing**: 105 in theory-core (property-based, golden, iReal round trips, band, 8 shared proofs) and 16 in the API. Typecheck is clean, CI is green on GitHub, and both builds work.
- **Engine:** 11 rules (L1–L4) including the full advanced pack, melody filter with reasons, voice-leading scores, density-capped pathways, scale map, voicings, Roman analysis.
- **Study view:** Rough.js lead sheet with washes, move cards (theory, melody check, Deep Dive, "Practice this move", "Drill the voicing", "Also works here"), improv card, rejected list, level dial.
- **Global key change:** a circle-of-fifths picker, ♭/♯ half steps, and `,` `.` in Practice. Everything transposes, including Deep Dive. The key is remembered per tune.
- **Audio:**
  - Salamander piano.
  - **Sampled upright bass and GM brush kit** with synth fallbacks: walking bass (triplet pickups, dropped beats) or two-feel, humanized with ±15 ms timing and velocity variation.
  - **Trio mixer** (piano, bass, drums, click). The piano drops its left hand while the bass plays.
  - **Count-in** (0, 1 or 2 bars of side-stick, cancellable), **click track** (woodblocks) and an ink **beat dot**.
  - A sketched **loading line** while the band loads.
- **Practice Mode:** `h-dvh` with a Current Chord HUD, compact heatmap, big count-in, and shortcuts: Space, ← →, A, L, `[ ]`, `,` `.`, 1–4, Esc.
- **Study ↔ Practice ↔ Coach continuity:**
  - The transport never stops when switching modes.
  - The lead sheet and title morph between modes via View Transitions, with a fallback.
  - "Practice this move" jumps into Practice Mode looping that move, with a count-in.
- **Comping Coach (its own page / mode):**
  - Drill list: the reharm's moves, every other move the engine found, and the due reviews.
  - Strike and voice-leading diffs in red pen; the 12-key transfer drill.
  - The 12-key passport page beside the drill, which stamps keys live.
  - "Hear the move" shows each chord as it sounds: a ringed chip, ink over the previous chord's ghost, and a voice-motion caption ("1 held · C→C♭ (−1) …").
  - Runs are saved, with the grade and next review shown.
- **Concept Passport:** the "Today's practice" SM-2 queue (Practise → opens the Coach on the exact move and key, loading the right chart), 12-key passport pages with CLEAN stamps, a recent-solos sparkline.
- **Improv Heatmap:** loop tape, passing-tone detection, guide-tone landings. It saves one history entry per loop pass.
- **Engine X-ray:**
  - A per-bar decision pipeline built from the real traces: proposals, red-pen melody strikes, voice-leading bars, and pathway verdicts with their rank formulas.
  - The **Proof** tab runs 8 × 200 fast-check cases live (about 1,600 in 3 s), with seed replay and a main-thread vs. worker SHA-256 handshake.
- **Library:** iReal Pro import (single songs and playlists that become setlists), SQLite, a Setlist drawer.
- **Resilience:**
  - An offline/API-down banner with Retry.
  - Deep Dive degrades calmly without a key.
  - A deleted remembered tune gets a toast and falls back to *Someday*; an offline API restores the tune once it returns.
  - Error boundaries on drawers and pages.
- **Demo:** API `--demo` and static `build:demo` (zero `/api` calls). Everything except the library, the passport and live Claude works in the demo.

---

## 5. Remaining roadmap (from the UX audit)

**Must-haves, still open**

1. **Deploy the static demo.** `npm run build:demo` produces `apps/web/dist-demo` with relative paths, ready for any static host or the portfolio site. Also add the CI badge to the README.
2. **Drag a bar range on the lead sheet to loop it** (Soundslice-style A–B loop). Today only a move can be looped.
3. **Mobile-safe demo and accessibility:**
   - the lead sheet scrolls sideways below 640 px; Practice Mode hides the sheet below `md`;
   - the heatmap needs shape encoding (● chord tone, ◆ tension, ✕ avoid) for colour-blind users;
   - `aria-live` for HUD chord changes;
   - visible focus rings everywhere.

**Fast-follows**

4. Foot-switch control with MIDI learn (soft pedal CC67 by default; sustain stays for playing). Today the sustain pedal is only logged, in `useMidi.ts`.
5. **Coach wait mode** (Flowkey-style): the transport waits until you strike the right voicing.
6. **Tempo trainer:** +N bpm every K clean loops, driven by Coach grades.
7. **Swing amount:** automatic by tempo plus a manual slider (the 2/3 offbeat is hard-coded in `engine.ts`). Also per-instrument volume faders (the mixer only mutes).
8. Richer band styles: a real bossa pattern, and ballad brushes.
9. **MIDI melody capture**, so imported iReal tunes get the melody filter.
10. Shareable reharm links (the pathway is deterministic, so a URL can carry it), then MusicXML/PDF export.
11. Record and replay your takes (MIDI).
12. **Playwright end-to-end tests** with a mocked Web MIDI device (`data-midi` and `data-target` hooks exist).
13. A "late set" dark theme.

**Other open items**

- **Claude-written demo Deep Dives.** `demo/explanations.json` is still `"source": "template"`. Run `npm run demo:generate -w @reharm/api`; it needs `ANTHROPIC_API_KEY` in `apps/api/.env`, which is currently absent, and it costs API budget, so ask Itai first.
- **Real iReal testing at the piano.** Known approximations: within-bar timing (2+1+1), D.C./D.S. imported in written order, "Last First" composer.
- **Untested paths:**
  - the passport's "Practise →" for a concept last practised on a *different* chart (the library only has *Someday*);
  - the Coach and MIDI with a physical keyboard since the Coach became a page.

---

## 6. Commands and endpoints

```bash
npm run dev            # web :5173 + api :8787
npm run dev:demo       # read-only demo (web + api)
npm test               # all workspaces (121 tests)
npm run typecheck
npm run build          # web → apps/web/dist
npm run build:demo     # static demo → apps/web/dist-demo
npm run db:generate -w @reharm/api   # after editing apps/api/src/db/schema.ts
npm run demo:generate -w @reharm/api # Claude-written demo Deep Dives (costs API budget)
```

- **API:**
  - `GET /api/health`
  - `/api/tunes[/:id]`, `DELETE /api/tunes/:id`, `/api/setlists`
  - `POST /api/import/ireal {url}`
  - `POST /api/explain {tuneId (may be base@Key), moveId, fresh?}`
  - `/api/practice`: `POST sessions`, `POST sessions/:id/end`, `POST coach-attempts`, `POST improv-runs`, `GET progress` (concepts, places, cleanKeys, due, recentImprov), `GET due` (with `lastPlace`)
- **localStorage keys:** `reharm.tune`, `reharm.tune.title`, `reharm.mode` (study/practice/coach), `reharm.key:<tuneId>`, `reharm.mixer`, `reharm.countIn`.
- **Sample sources:**
  - Salamander piano (tonejs.github.io);
  - `acoustic_bass` from gleitz/midi-js-soundfonts (MusyngKite → FluidR3 → FatBoy);
  - GM drum kits from surikov/webaudiofontdata (FluidR3 → JCLive → SBLive; the base64 MP3 is decoded, the script is never executed);
  - check the soundfont licences before any commercial use.
