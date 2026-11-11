# Reharm Lab: State of the Union

> Context hand-off for a fresh session. Snapshot as of commit `287d650` on `main` (2026-11-11).
> Project: **Reharm Lab**, a jazz-piano reharmonization and practice app. It is the flagship piece of
> **ITAI LIOR // SOFTWARE & JAZZ CO-OP**. Repo root: `C:\Users\itail\Documents\claude\jazz_P` (Windows 11, Node 22.11, npm workspaces).

---

## 0. How to work on this repo

- Run every command from the repo root. Run the tests and the typecheck before saying anything is done. Verify UI changes in the browser preview (`.claude/launch.json` has `web`, `api` and `web-demo-build`).
- Commit only when asked. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. There is **no git remote yet**, so CI has never actually run on GitHub.
- The user (Itai) is an advanced jazz pianist and a developer. Explain moves musically and precisely; skip basic theory definitions.
- Vite HMR caveat: if one edit *uses* an import and a later edit *adds* it, the page can crash between the two. Reload before concluding something is broken.
- Windows shells: avoid `VAR=x cmd` in npm scripts. Use flags (`--demo`) or Vite mode files (`--mode demo`).

---

## 1. File tree (tracked files)

```
.
├── .claude/launch.json              # preview configs: web (5173), api (8787), web-demo-build (4174)
├── .gitattributes                   # * text=auto eol=lf
├── .github/workflows/ci.yml         # typecheck → tests → migration-drift check → web build → demo build (+artifact)
├── .gitignore                       # node_modules, dist, dist-demo, .env, .cache/, apps/api/data/
├── README.md
├── docs/STATE_OF_THE_UNION.md       # this file
├── package.json                     # workspaces; scripts: dev, dev:web, dev:api, dev:demo, test, typecheck, build, build:demo
├── tsconfig.base.json               # ES2022, Bundler resolution, strict, verbatimModuleSyntax, noEmit
│
├── packages/theory-core/            # DETERMINISTIC ENGINE: pure TS, zero runtime deps, consumed as TS source ("exports": "./src/index.ts")
│   ├── src/
│   │   ├── types.ts                 # Tune, ChordEvent, NoteEvent, ReharmMove, Quality (incl. maj/m triads), MoveCategory…
│   │   ├── pitch.ts                 # spelled pitches: parseNote, transpose(letter-steps+semis), chroma, intervalName, simplifyNote, midiOf, spellMidi, prettyNote/Symbol
│   │   ├── chords.ts                # QUALITY_FORMULA, chordTones, guideTones, symbol(), isMajorQ/isMinorQ/isDominant, resolvesDownFifth
│   │   ├── time.ts                  # absBeat, posFromAbs, melodyIn, sortedHarmony, formBars
│   │   ├── melody.ts                # classifyNote → chord-tone | tension | avoid (+ reason text)
│   │   ├── voiceLeading.ts          # nearestMotion, motionCost
│   │   ├── scales.ts                # SCALES, suggestScales (hard rule: scale ⊇ chord tones ∪ melody notes)
│   │   ├── ruleKit.ts               # Rule/Proposal/RuleContext types + helpers (mk, splitBeats, distribute, tidy, ps, pn, chain, romanName)
│   │   ├── rules.ts                 # CORE_RULES: secondaryTwoFive, tritoneSub, upperStructure, gospelTurnaround
│   │   ├── rulesAdvanced.ts         # ADVANCED_RULES: passingDiminished, backdoorTwoFive, flatSixFlatSeven, borrowedIv, commonToneDiminished, coltraneSubstitution, constantStructure
│   │   ├── ruleset.ts               # RULES = [...CORE_RULES, ...ADVANCED_RULES] (order = tie-break priority)
│   │   ├── engine.ts                # generateMoves(tune) → { accepted, rejected } (melody filter + guide-tone VL score)
│   │   ├── pathway.ts               # DENSITY caps, buildPathway(moves, level, forced), realize(), overlaps, densityLabel
│   │   ├── improv.ts                # improvMap: scales + guide tones + landing targets per chord
│   │   ├── voicing.ts               # voiceChord/voiceProgression: close-position, min-movement inversions, MIDI
│   │   ├── coach.ts                 # drillSteps, diffStrike, diffVoiceLeading (Comping Coach)
│   │   ├── lineEval.ts              # evaluateLineNote, chordAtBeat (Improv Heatmap)
│   │   ├── transpose.ts             # KEYS, transposeTune, randomKey (12-key transfer)
│   │   ├── analysis.ts              # romanFor, analyzeTune (Roman numerals for imported charts)
│   │   ├── import/ireal.ts          # iReal Pro parser: irealb:// + irealbook://, unscramble, repeats/endings, quality mapping
│   │   ├── fixtures/someday.ts      # demo tune: "Someday My Prince Will Come" bars 1–9, Bb, 3/4, two melody anchors
│   │   └── index.ts                 # barrel export
│   └── test/                        # Vitest + fast-check
│       ├── arbitraries.ts           # ROOTS, SPELLED, progressionArb (random ii–V–I–I)
│       ├── pitch.test.ts  rules.property.test.ts  advancedRules.test.ts  someday.golden.test.ts
│       ├── voicing.test.ts  practice.test.ts  ireal.test.ts
│
├── apps/api/                        # Hono on Node (tsx); SQLite via Drizzle on sql.js
│   ├── .env.example                 # ANTHROPIC_API_KEY, EXPLAIN_MODEL (default claude-opus-5-5), PORT (8787)
│   ├── demo/explanations.json       # pre-generated Deep Dives for demo mode (currently ENGINE TEMPLATE text, 19 moves)
│   ├── drizzle.config.ts            # dialect sqlite, schema ./src/db/schema.ts, out ./drizzle
│   ├── drizzle/0000_init.sql  0001_practice_history.sql  meta/
│   ├── scripts/generate-demo.ts     # npm run demo:generate -w @reharm/api [-- --template]
│   ├── src/
│   │   ├── index.ts                 # loads .env (process.loadEnvFile), demo = DEMO_MODE=true || --demo, serve()
│   │   ├── app.ts                   # createApp({ demo, dbFile?, demoExplanationsFile? }) → { app, dbFile }
│   │   ├── explain.ts               # Claude call: client.beta.messages.parse, betaZodOutputFormat, fallbacks:"default", disk cache
│   │   ├── prompt.ts                # EXPLAIN_SYSTEM_PROMPT + PROMPT_VERSION (part of cache key)
│   │   ├── demo.ts                  # loadDemoExplanations, templateExplanation, demoExplain
│   │   ├── db/client.ts             # sql.js init, migrate, persist() (atomic tmp+rename, writes to the OPENED file)
│   │   ├── db/schema.ts             # tunes, setlists, setlist_tunes, practice_sessions, coach_attempts, improv_runs, concept_reviews + relations
│   │   ├── db/repo.ts               # library: listTunes/getTune/upsertTune/deleteTune/saveSetlist/listSetlists/batch
│   │   ├── db/practiceRepo.ts       # startSession, recordCoachAttempt (updates SRS), recordImprovRun, cleanKeys, dueConcepts
│   │   ├── practice/srs.ts          # gradeAttempt, scheduleReview (SM-2 style)
│   │   └── practice/routes.ts       # /api/practice/* with zod validation
│   ├── test/setup.ts                # points REHARM_DB (default DB path) at a throwaway sentinel
│   ├── test/api.test.ts  srs.test.ts
│   └── vitest.config.ts
│
└── apps/web/                        # React 19 + Vite 6 + Tailwind v4 + Rough.js + Tone.js + Web MIDI
    ├── .env.demo                    # VITE_DEMO_MODE=true (vite --mode demo)
    ├── index.html                   # Google Fonts: Architects Daughter, Kalam 400/700, Noto Music
    ├── vite.config.ts               # react + @tailwindcss/vite; proxy /api → :8787
    └── src/
        ├── main.tsx  index.css      # @theme tokens, paper-grain background, ink-in keyframes
        ├── App.tsx                  # Study view + mode switch → PracticeMode; tune state, library, coach drawer
        ├── demo.ts                  # DEMO flag, lazy demoExplanation()
        ├── design/tokens.ts         # hex mirrors of CSS tokens, CATEGORY_WASH/LABEL, LEVELS, VERDICT_COLOR, pen, seedOf()
        ├── design/rough.tsx         # useRough, useSize, SketchBox, SketchRule, SketchFilters (#ink-wobble, #watercolor)
        ├── audio/player.ts          # WaltzPlayer singleton: Salamander sampler (synth fallback), arrange(), Part swap, currentBeat, playNotes
        ├── audio/usePlayback.ts
        ├── midi/useMidi.ts          # Web MIDI access, hot-plug, held notes → noteBus
        ├── midi/noteBus.ts          # shared note stream (MIDI + on-screen keys), useChordStrikes
        ├── library/api.ts           # fetchTunes/fetchTune/importIReal/deleteTune/fetchSetlists
        └── components/
            ├── LeadSheet.tsx  ChordName.tsx  MoveCard.tsx  DeepDive.tsx  ImprovCard.tsx  DoodleKeyboard.tsx
            ├── LevelDial.tsx  ModeSwitch.tsx  SideRail.tsx  TransportBar.tsx
            ├── library/LibraryDrawer.tsx
            └── practice/CompingCoach.tsx  PenKeyboard.tsx  ImprovHeatmap.tsx  ChordHUD.tsx  PracticeMode.tsx
```

Not tracked: `apps/api/data/reharm.sqlite` (the local library), `apps/api/.cache/explanations.json` (Claude cache), `apps/api/.env`, and `dist*/`.

---

## 2. Architectural rules (do not break these)

1. **The theory engine is deterministic and decides every pitch.** All harmony, voicings, scales, melody checks, coach diffs and line evaluations live in `packages/theory-core` as pure, synchronous functions. The browser runs the engine directly, so the dial, A/B switch and transposition recompute instantly.
2. **The LLM never computes notes.** `/api/explain` recomputes the move on the server and sends Claude only `buildFacts(tune, move)`. The system prompt forbids inventing pitches, melodies or recordings, and requires the facts' spelling. Output shape is `{ summary, deepDive, recreateRule }`, enforced with Zod structured output.
3. **Spelling matters.** Notes are letter + accidental (D7♯5 contains A♯, not B♭). `transpose()` preserves letter steps and semitones. Use `tidy()`/`simplifyNote()` only for double accidentals or C♭/F♭/E♯/B♯.
4. **Rules are interval-relative** to their local target (`next`, `afterNext`), never the global key. That's why transposed tunes give identical move ids. New rules go in `rulesAdvanced.ts` (or a new pack) via `ruleKit.ts` and are registered in `ruleset.ts`.
5. **Every rule** returns a `Proposal` whose chord beats sum to the span it replaces (the engine throws otherwise). It needs explanation text (`summary`, `theory`, `recreateRule`, optional `insight`), a level 1–4 and a category. Every rule gets a property test of its musical invariant.
6. **The melody filter is authoritative.** A move that puts an avoid note under the melody is rejected, with a reason. Imported iReal tunes have no melody (`melodyCoverage: "none"`), so nothing is melody-checked for them.
7. **Pathways** are built per phrase window with `DENSITY` caps: L1 1 per 8 bars, L2 1 per 4 bars, L3 2 per 4 bars, L4 uncapped. Rank = `level×2 + score − 1.5×(earlier uses of the rule)`. Moves picked by hand are forced in and count toward their phrase's cap.
8. **The database is SQLite through Drizzle on sql.js** (WebAssembly). `better-sqlite3` segfaulted on this machine; don't reintroduce native drivers. The database lives in memory and `persist()` writes it atomically after each change. **`persist()` must write to the file passed to `openDb()`** (an earlier bug wrote to the default path). Schema changes require `npm run db:generate -w @reharm/api` and committing `apps/api/drizzle/`; CI fails on drift.
9. **The API is built by `createApp()`**, so it can be tested in-process with `app.request()`. Tests use temp databases, and `test/setup.ts` points the default DB path at a sentinel that must never be created.
10. **Demo mode spends nothing and writes nothing.**
    - API `DEMO_MODE=true`/`--demo`: no database, every non-GET except `/explain` gets 403, and `/explain` serves `demo/explanations.json` or the engine template. It never calls Anthropic.
    - Web `--mode demo` (static build): bundled demo tune only, no library UI, Deep Dives lazy-loaded from the same JSON, zero `/api` requests.
11. **Claude API settings:** model `claude-opus-5-5` (env `EXPLAIN_MODEL`), `output_config: { effort: "medium", format: betaZodOutputFormat(...) }`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, and `cache_control` on the system prompt. Bump `PROMPT_VERSION` whenever the prompt changes, since it's part of the cache key.
12. **Audio:** one `WaltzPlayer` singleton. Rebuilding the `Tone.Part` on the Transport timeline is what makes ghost A/B switching seamless. The UI syncs through `Tone.Draw` (`onPosition`) or `player.currentBeat()`, never its own timers.
13. **Input:** all note input (MIDI and on-screen keys) flows through `noteBus`. The practice tools subscribe there, never to MIDI directly.

---

## 3. Design-system constraints ("living lead sheet")

- **Look:** warm parchment paper, deep Blue-Note-style ink linework, earthy watercolour washes, red teacher's-pen corrections. Everything looks hand-drawn. "Blue Note" is a trademark, so the app name stays **Reharm Lab**.
- **Tokens:** Tailwind v4 `@theme` in `index.css`, mirrored as hex in `design/tokens.ts`. Rough.js writes SVG attributes and can't read CSS variables, so the two must stay in sync.
  - paper `#f6e9c9` / light `#fbf3df` / shade `#ead7aa`
  - ink `#1e2a78` / soft `#3e4c9e` / faint `#8a93c4`
  - washes: blue `#5b85c2`, mustard `#e3b23c`, brick `#b9532f`, sage `#7e9c6b`
  - pen `#c2311f`
  - Utilities: `bg-paper`, `text-ink`, `fill-pen`, `font-hand`, `font-marker`, `font-music`.
- **Fonts:** Kalam (headings and chord symbols), Architects Daughter (body and labels), Noto Music (𝄞 ♭ ♯ ♮ glyphs, in every font stack).
- **Rough.js:** draw through `useRough(gRef, draw, deps)`. **Always pass a stable `seed`** (`seedOf(id)`), or the sketch jitters on every render. Prefer `stroke: "currentColor"` and build options objects conditionally (an `undefined` value overrides Rough's defaults).
- **Primitives:**
  - `SketchBox`: hand-drawn border and fill; use `innerClassName` when it has to fill its parent.
  - `SketchRule`.
  - `SketchFilters`: `#ink-wobble` for headings, `#watercolor` for washes with `mix-blend-mode: multiply`.
- **Category washes:** functional = mustard, dominant-sub/symmetric = blue, gospel = brick, voicing/modal = sage, chromatic = mustard.
- **Heatmap verdicts:** chord tone = blue, tension = mustard, avoid = pen red, outside = ink faint.
- **Chord symbols:** stored as ASCII (`Bb7(b9)`) and shown through `prettySymbol`/`ChordName`/`ChordText`, with a large root and a raised suffix. Symbols shrink when a bar holds three or four chords.
- **Layout rules:**
  - Study mode: two columns from `lg` up (`grid-cols-1` base so the page never scrolls sideways); the sheet scrolls horizontally inside its own box.
  - Practice Mode: locked to `h-dvh` with no scrolling; the lead sheet pages 8 bars at a time on long forms.
  - Mobile: 16px side margins.
- **Practice tools:** the red pen means circles for missing notes, ✗ for wrong notes, a big check for clean runs, and comments in Kalam. Every key has a `data-midi` attribute, for tests.
- **Accessibility:** `aria-label`s on SVG controls, `aria-live` on the coach prompt and HUD, and `prefers-reduced-motion` disables the ink-in animation.

---

## 4. What works now (verified)

- **94/94 tests passing**: 80 in theory-core (property-based with fast-check, golden, parser round trips) and 14 in the API. Typecheck is clean in all three workspaces. Every CI step passes locally from a clean `npm ci`.
- **Engine:** 11 rules from L1 to L4, a melody filter with reasons, voice-leading scoring, density-capped pathways, the scale map, close-position voicings with minimum movement, Roman analysis, and 12-key transposition that gives identical move ids.
- **Study view:**
  - Rough.js lead sheet with watercolour washes, a pen circle on the selected move and a pencil playhead.
  - Move cards: theory text, melody check, voice-leading list, doodle keyboard, "Recreate it" note, "Also works here" swaps.
  - Improv card, a "considered and rejected" list, and a level dial with density tooltips.
- **Playback:** Tone.js jazz-waltz comping (bass on 1 and 3, right hand on 1 and the swung 2&, melody on top) on the Salamander piano with a synth fallback. Ghost A/B switching mid-playback, tempo control and loop-the-selected-move are verified in the browser.
- **Deep Dive:** Claude-backed (Itai confirmed it works with his key), cached on disk.
- **MIDI:** Web MIDI hook confirmed by Itai on a physical keyboard; it logs note on/off and feeds `noteBus`.
- **Comping Coach:** strike diffing (correct, perfect, incomplete or wrong; rootless voicings accepted), voice-leading diffing, red-pen marks, and the 12-key transfer drill. Verified with on-screen input, not yet with a physical keyboard.
- **Improv Heatmap:** loop tape with note blocks coloured by verdict, passing-tone detection, guide-tone landings and stats.
- **Practice Mode:** `h-dvh` layout with no scrolling (checked at 1440×900 and 1280×680), a Current Chord HUD synced to the playhead, a compact heatmap, and keyboard shortcuts (Space, ← →, A, L, [ ], Esc).
- **Library:** iReal Pro import (single songs and playlists that become setlists), SQLite persistence, and a Setlist drawer with search, setlist filter, load and confirmed delete. The last loaded tune is remembered.
- **Demo:** the API demo mode and the static `build:demo` are both verified (no writes, zero `/api` calls in the static build).
- **Practice-history backend:** schema, migration `0001`, SM-2 scheduler and validated `/api/practice` endpoints, all tested.

---

## 5. Recently finished (no longer pending)

- ✅ L3/L4 rule pack (seven rules plus property tests): commit `287d650`.
- ✅ GitHub Actions CI (`.github/workflows/ci.yml`): commit `287d650` (it hasn't run on GitHub yet because there's no remote).
- ✅ Practice-history schema, SRS and endpoints: commit `287d650`.

## 6. Open tasks / next steps

1. **Push to GitHub** (create a remote) so CI runs for real, then add the CI badge to the README.
2. **Wire practice history into the UI.** The Coach should start a session, POST each finished run to `/api/practice/coach-attempts` (`misses`, `leaps`, `maxLeap`, `ruleId`, key) and show the persistent "clean in" keys from `/api/practice/progress`. The heatmap should POST `improv-runs` summaries. Add a "due today" review queue driven by `/api/practice/due`. Skip all of this when `DEMO`.
3. **Regenerate the demo Deep Dives with Claude:** `npm run demo:generate -w @reharm/api` (needs Itai's key; 19 moves). Re-run it whenever the rules change; a test enforces full coverage.
4. **Real-world iReal testing** (Itai, at the piano): paste links from his actual setlist and fix any parser gaps. Known approximations: within-bar chord timing is a 2+1+1 heuristic, D.C./D.S./coda are imported in written order, and a "Last First" composer field is reversed.
5. **MIDI melody capture:** record the head over the loop and snap it to the beat, so imported tunes get the melody check.
6. **Deploy the static demo** (any static host; the build uses relative paths) to the portfolio site.
7. **Polish and debt:**
   - dark mode (tokens are ready);
   - ~~the main bundle is over 500 kB (Tone.js), so code-split it~~ (done: Tone.js is a lazy engine chunk; see the README's "Fails gracefully, loads fast");
   - narrow-screen layouts;
   - a correction UI for iReal chord timing;
   - Playwright end-to-end tests (use the `data-midi` attributes).

## 7. Commands

```bash
npm run dev            # web :5173 + api :8787
npm run dev:demo       # read-only demo (web + api)
npm test               # all workspaces (94 tests)
npm run typecheck
npm run build          # web
npm run build:demo     # static demo → apps/web/dist-demo
npm run db:generate -w @reharm/api   # after editing apps/api/src/db/schema.ts
npm run demo:generate -w @reharm/api # Claude-written demo Deep Dives
```
