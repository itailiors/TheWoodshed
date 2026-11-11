# Reharm Lab

**A living lead sheet for jazz pianists: reharmonize a standard, hear every move, and practice it until it's yours.**

*A flagship project of **ITAI LIOR // SOFTWARE & JAZZ CO-OP**.*

---

## Mission

Advanced jazz harmony is usually learned in fragments: a tritone sub from one record, a gospel turnaround from another, a voicing from a teacher's hands. Reharm Lab brings that vocabulary into one place, built around a real tune.

Load a standard (the reference tune is *Someday My Prince Will Come*) and the app:

1. **Suggests reharmonizations** bar by bar, from functional ii–Vs to tritone substitutions, upper-structure voicings and gospel turnarounds.
2. **Explains why each move works**: function, voice leading, melody compatibility and a one-line rule you can carry to any tune.
3. **Maps the right hand**: the scales that fit every chord, original or reharmonized, with the guide tones to land on.
4. **Makes you play it**: a MIDI comping coach marks your voicings in red pen, an improv heatmap scores your lines, and a 12-key drill moves everything to a new key so you learn the function, not the finger shape.

The goal isn't a chord-substitution generator. It's a practice partner that teaches you to make these moves on the fly.

---

## Architecture: two halves, one source of truth

```
┌──────────────────────────── packages/theory-core ────────────────────────────┐
│  DETERMINISTIC THEORY ENGINE (pure TypeScript, no UI, no network)            │
│                                                                              │
│  spelled pitches → chord analysis → reharm rules → melody filter → scoring   │
│        → pathways → voicings (min. voice movement) → scale mapping           │
│        → practice evaluation (strike diff, voice-leading diff, line eval)    │
└──────────────┬─────────────────────────────────────────────┬─────────────────┘
               │ same functions, in the browser              │ same functions, on the server
┌──────────────▼───────────────────────────┐   ┌─────────────▼──────────────────────────┐
│ apps/web: PRACTICE TOOLS & UI            │   │ apps/api: Hono proxy                   │
│ React · Vite · Rough.js · Tone.js · MIDI │   │ recomputes the move → computed facts   │
│ living lead sheet, reharm dial,          │◄──┤ → Claude → { summary, deepDive,        │
│ A/B playback, coach, heatmap             │   │   recreateRule }, cached on disk       │
└──────────────────────────────────────────┘   └────────────────────────────────────────┘
```

**The theory engine is deterministic and decides every pitch.** It spells notes the way a chart would (D7(♯5) contains A♯, not B♭), so its explanations are correct as well as playable. It runs in the browser, so turning the reharm dial, flipping A/B or transposing to a new key recomputes instantly.

**The UI is where you practice.** It treats the engine as a library: the lead sheet, the playback arranger, the comping coach and the heatmap all call the same pure functions.

**The language model never chooses notes.** The Deep Dive API sends Claude only the engine's computed facts and asks it to turn them into teaching prose, under a system prompt that forbids inventing pitches, melodies or recordings.

---

## Features

### 🎚️ Reharm Dial with A/B ghost playback
- A five-level "spice dial" (Original → Functional → Bebop → Gospel → Modern) controls how adventurous the moves are *and* how many there are, phrase by phrase:

  | Level | Moves allowed |
  |---|---|
  | L1 | 1 per 8 bars |
  | L2 | 1 per 4-bar phrase |
  | L3 | 2 per 4-bar phrase |
  | L4 | no limit |

  In each phrase, the best moves win: higher level first, then smoother voice leading, then variety (it avoids repeating a rule it has already used). Moves you pick by hand count toward the same limit.
- Moves show on the lead sheet as watercolour washes, coloured by category. Click one to open its card; swap in any alternative that fits the same bars.
- **Playback:** a Tone.js jazz-waltz arrangement on a sampled grand piano (Salamander), with a synth fallback. Bass on 1 and 3, right-hand comping on 1 and a swung "2&", and the melody on top.
- **Voice-led voicings:** each chord is voiced in the inversion that moves least from the previous one, so you hear the half-step motion the engine describes (Fm9 → B♭7(♭9) → E♭maj7 plays as 60 63 67 68 → 59 62 65 68 → 58 62 65 67).
- **Ghost A/B:** flip Original/Reharm or turn the dial *while it plays*. The new chords take over on the next beat. Loop just the selected move, change the tempo, and follow the pencil playhead.

### 🧠 The rule library
Eleven deterministic rules. Each works in intervals relative to its local target, so it applies in all 12 keys and to tonicized chords:

| Level | Rules |
|---|---|
| L1–L2 | Secondary / related ii–V · tritone substitution · upper-structure triad · passing diminished (♯I°7 as a rootless V7♭9; chromatic ♭iii°7) |
| L3 | Gospel half-step turnaround · backdoor ii–V (iv–♭VII7) · ♭VI–♭VII–I · borrowed iv (minor plagal) · common-tone diminished |
| L4 | Coltrane substitution (three key centres a major 3rd apart) · constant structure (the target's shape planed down by half steps) |

Every move goes through the same melody filter and voice-leading score, and comes with its own explanation and a key-independent rule.

### 🎹 MIDI Comping Coach
- Asks you to play the selected move (e.g. *Fm9 → B♭7(♭9) → E♭maj7*) and listens to your keyboard through the Web MIDI API. Without a keyboard, click keys on screen.
- **Strike diffing:** each chord you play is compared with the engine's reference voicing. It catches missing guide tones, wrong notes (and names avoid-note clashes), and accepts rootless voicings and other inversions.
- **Voice-leading diffing:** between chords it pairs your right-hand voices and checks that each moves by step, comparing your total movement with the engine's.
- **Teacher's red pen:** hand-drawn circles where a 3rd or 7th should be, crosses on wrong notes, a big checkmark for a clean, smooth strike, and written comments in the margin.
- **12-key transfer drill:** jump to a random key, or move to a new one automatically after every clean run. The engine re-spells every chord and voicing; the hint can be hidden so you work from function.

### 🔥 Improv Heatmap
- Solo over the backing loop. Every note is captured with its position in the loop and judged against the chord sounding at that moment:
  **blue** chord tone · **gold** tension · **red** avoid note · **faint** chromatic/outside.
- Short off-beat avoid notes are shown as passing tones rather than mistakes. Guide tones landed on a chord change are outlined.
- Notes are drawn on a "loop tape" whose older passes fade, with stats for chord tones on the beat, guide-tone landings and held avoid notes.

### 🥁 Trio mixer: a built-in backing band
- Three ink-doodle toggles (piano, upright bass, snare with brushes) sit next to Play in both modes. A muted instrument fades to pencil grey under a red-pen slash. In Practice Mode, keys `1` `2` `3` toggle them, and the mix is remembered.
- **Bass**, generated in `theory-core` from the tune's feel:
  - swing and jazz waltz get a **walking line**: the root on each downbeat, chord tones in between (the smoothest of every candidate line wins) and a chromatic approach a half step into the next chord;
  - the walk is then humanized: it leans on 2 and 4 (on 1 in a waltz), sometimes approaches a change with an eighth-note **triplet pickup** (a ghosted rake, then a two-step chromatic run), and sometimes **drops a beat**, letting the previous note ring. The variations are seeded per tune, so the line repeats as written;
  - ballad, bossa and straight eighths get a **two-feel**: root on 1, the 5th on 3.
- **Drums**:
  - a ride playing "ding, ding-a-ding": quarter notes full, the swung skip note ghosted;
  - a strongly accented foot chick on 2 and 4 (2 and 3 in a waltz);
  - occasional ghosted snare notes on the triplet partials;
  - a feathered kick and a quiet brush-sweep texture.
- **Real samples, with fallbacks**:
  - the upright is the General MIDI acoustic bass from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MusyngKite, then FluidR3, then FatBoy);
  - the kit is a GM kit from [WebAudioFont](https://github.com/surikov/webaudiofontdata) (FluidR3, then JCLive, then SB Live): kick, snare, ride, closed and pedal hi-hat. The app fetches each file as text and decodes only its embedded MP3, never running the file's script;
  - if every source fails, the old synths take over, so Play always works, and the transport bar says so;
  - check each soundfont's licence before any commercial use.
- **Micro-timing**: every bass and drum strike is pushed or dragged by up to ±15 ms, on a triangular spread so most land close to the grid, and its velocity varies slightly. Both change on every pass of the loop.
- While the bass player is in, the app's piano drops its left-hand bass and comps rootless. Mute the bass and the left hand comes back. Mute the piano and you're comping with a bass-and-drums duo.

### ⏱️ Time you can see, in any key
- **Count-in:**
  - 0, 1 or 2 bars of side-stick before the band comes in, shown as a big "1 · 2 · 3" over Practice Mode's HUD;
  - it runs on the audio clock, and the Transport is set to start exactly where it ends;
  - Space during the count-in cancels it cleanly.
- **Click:** a fourth mixer instrument (a metronome doodle), off by default. Dry woodblocks, high on the downbeat and low on the others, dead on the grid while the band swings around it. Key `4` in Practice Mode.
- **Metronome dot:** an ink blot in the margin lands on every beat, red on the downbeat, beside a row of beat dots that shows where you are in the bar.
- **Global key change:** a hand-drawn circle of fifths (or the ♭/♯ half-step buttons, or `,` `.` in Practice Mode) moves the whole tune: chords, melody, every reharm move, the scale map, playback and the Deep Dive, which is written about the key you're in. Each tune remembers the key you last played it in. Move ids are positional, so your picks and loop survive the key change.
- **Study ↔ Practice continuity:**
  - the band keeps playing across the switch;
  - with the View Transitions API, the lead sheet and title glide from one layout to the other while the rest cross-fades (skipped under reduced motion, and never allowed to hold up the switch);
  - **Practice this move** jumps straight into Practice Mode looping that move, counting in if the band wasn't already playing. If it was, the playhead jumps into the new loop at once;
  - **Drill the voicing** opens the Comping Coach.

### ✍️ Claude-powered Deep Dive
- One click turns a move into a short lesson: a summary, a 150–260-word deep dive (function, voice leading, how to hear and play it) and a key-independent rule.
- The server recomputes the move itself and sends Claude only the computed facts. Structured outputs keep the response in the `{ summary, deepDive, recreateRule }` shape.
- The system prompt sets the voice (analytical and encouraging, written for a pianist studying Bill Evans and Shaun Martin vocabulary) and the rules: no invented notes, keep the engine's spelling, flag missing melody data.
- Results are cached on disk by a hash of prompt version, model and facts, so each move is paid for once.

### 📚 Setlist: iReal Pro import + local library
- Paste an `irealb://` (or older `irealbook://`) link, for one song or a whole playlist. The importer:
  - de-obfuscates the chart;
  - unrolls `{ }` repeats with first and second endings, `x`/`r` bar repeats, slash chords and N.C.;
  - maps iReal chord qualities (`^7`, `-7b5`, `h7`, `7alt`, `9sus` …) onto the engine's spelled chords;
  - adds Roman-numeral analysis.
- Playlists become setlists. Re-importing a song updates it in place, and anything the importer had to approximate (road-map directions, odd chord symbols) is reported as a note on the tune.
- Tunes are stored in SQLite through Drizzle ORM. The library drawer lets you search, filter by setlist, load a tune and delete it. The app remembers the last tune you loaded.

### 🔬 Engine X-ray: watch it decide, then watch it prove itself
- **How it decided:** pick a bar (or let it follow the playhead) and read the engine's reasoning as a four-stage pipeline:
  1. **The rule proposes:** every move that touches the bar, with its level and chords. The rules that had nothing to say are listed too.
  2. **The melody filter:** struck-out proposals get a red-pen line and the reason ("B♭ is the 11 of Fmaj7, a half step above the 3rd (A)").
  3. **Voice leading:** the guide-tone score as a hatched ink bar, with the actual motion (A♭→G, −1).
  4. **The pathway:** the verdict and the arithmetic behind it (`L2×2 + 9 = 13`): in the reharm, lost the beats to a better move, phrase quota full, or too spicy for the dial.
- **It can't misrepresent the engine.** `generateMoves` and `buildPathway` are thin wrappers over `generateMovesTraced` and `buildPathwayTraced`, so the X-ray reads the same code path the app plays from, and a property test checks that.
- **Proof:** the engine's claims run live in the browser. That's 8 properties × 200 generated tunes in a Web Worker: deterministic, melody-safe, keeps the form, respects the dial, the X-ray tells the truth, key-independent, spells like a chart, walks like a bassist. They're the same `PROOFS` objects CI asserts (`@reharm/theory-core/testing`).
  - Re-run a seed to replay identical cases.
  - A failure shows fast-check's shrunk counterexample.
  - A determinism handshake hashes the engine's full output (SHA-256) on the main thread and in the worker, and shows they match.
- Lazy-loaded: the X-ray is an 18 kB chunk, and fast-check exists only inside the worker. It works in the static demo too, with no API.

### 🧯 Fails gracefully, loads fast
- **API down or offline:** a red-pen banner says exactly what's paused (setlist, import, deep dives) and what still works (everything musical, since it all runs in the browser), with a Retry button. One shared health check drives it, and it clears as soon as the API is back.
- **No Claude key:** Deep Dive doesn't error. It says the engine's own explanation on the card is the full analysis, and how to switch Claude on. The API marks the case with a machine-readable code (`no_key`).
- **A deleted tune:** if the remembered tune is gone, a toast names it and *Someday* goes back on the stand. If the API is only down, the remembered tune loads as soon as the API returns. Deleting the open tune steps off it at once.
- **Loading the band:** a sketched ink line fills as the piano, bass and drums arrive, with a red "~" on any instrument that fell back to a synth.
- **Code-split:**
  - Tone.js and the band are a 271 kB engine chunk loaded on demand and prefetched when the browser is idle, so the first Play still counts as a user gesture;
  - Rough.js, the library drawer, the Coach and Practice Mode each have their own chunk;
  - React has a long-cached vendor chunk;
  - the critical path dropped from 631 kB to 92 kB of app code plus 223 kB of React (187 kB → 102 kB gzipped).

---

## Tech stack

| Layer | Tools |
|---|---|
| Theory engine | TypeScript, no runtime dependencies (`packages/theory-core`) |
| UI | React 19, Vite, Tailwind CSS v4 |
| "Living lead sheet" design | **Rough.js** (seeded hand-drawn shapes), SVG turbulence / displacement filters (ink wobble, watercolour washes), Google Fonts *Kalam*, *Architects Daughter* and *Noto Music* |
| Audio | **Tone.js** (Transport, Part, Sampler): Salamander Grand Piano, GM acoustic bass (midi-js-soundfonts) and a GM drum kit (WebAudioFont), with synth fallbacks |
| Input | **Web MIDI API**, with hot-plug support and a shared note bus for MIDI and on-screen keys |
| API | **Hono** on Node, **Anthropic SDK** (Claude, structured outputs, prompt caching) |
| Storage | **SQLite** via **Drizzle ORM** on **sql.js** (WebAssembly: no native build), committed migrations, atomic writes to `apps/api/data/reharm.sqlite` |
| Testing | **Vitest** + **fast-check** (property-based testing) |
| Tooling | npm workspaces monorepo, `tsx`, `concurrently` |

---

## Testing: property-based by design

Music theory has invariants, so the engine is tested against them rather than against a handful of examples. [fast-check](https://fast-check.dev) generates thousands of random ii–V–I progressions in every key, in 3/4 and 4/4, with and without melodies, and checks that:

**Spelling**
- Transposing any spelled note by any interval preserves both the letter distance and the semitone distance (so D + ♯5 = A♯, never B♭).
- MIDI ↔ spelled-pitch conversion round-trips, including C♭ and B♯.

**Reharmonization rules**
- Every move keeps its span exactly, and its chords are laid out back to back.
- Accepted moves never put an avoid note under the melody, and every rejected move gives a reason.
- Tritone subs share the original dominant's 3rd/♭7 tritone and resolve by a half step in the bass.
- Secondary ii–Vs sit a perfect 5th above their target, twice.
- Upper-structure triads sit on the ♭13 and contain only chord tones.
- In the gospel turnaround, no voice moves more than a half step into the tonic.
- Pathways never overlap and respect the dial level.

**Scales and voicings**
- Every suggested scale contains every chord tone and every melody note.
- Voicings always include the guide tones, keep the root in the bass, stay in playable ranges and use only chord or standard colour tones.

**Practice tools**
- The engine's own voicing is always judged "perfect"; removing a guide tone is always flagged, with the right place for the red pen.
- Transposing a tune to any of the 12 keys yields exactly the same moves, shifted.
- Line evaluation never mislabels a chord tone, and every note gets a readable role.
- The walking bass plays every beat in range, lands each chord's root on its downbeat and approaches the next root by a half step; the two-feel is always root on 1, fifth on 3; the ride, hi-hat and brush patterns stay in time and inside the form.

A **golden test** pins the engine to the original design simulation of *Someday My Prince Will Come* (bars 1–8), so the moves, the melody-based rejections, both pathways and the scale map are all exact.

The headline claims also live in `src/testing/proofs.ts` as plain `Proof` objects (a sentence, plus a fast-check property). CI asserts every one, and the app's **Proof** tab runs the very same objects live in the browser, so the evidence a visitor sees is literally the test suite.

Each of the advanced rules has its own invariant, checked on random diatonic progressions in every key: the backdoor ♭7 falls to the tonic's 5th, ascending passing °7s equal a rootless V7♭9 of the target, Coltrane's key centres form an augmented triad with each dominant resolving down a 5th, and constant-structure chords keep the target's exact shape.

The **API suite** runs the server in-process against throwaway databases. It covers:
- iReal import and setlists;
- payload validation;
- practice history and the review scheduler (also property-tested);
- demo mode, which is shown to refuse every write and never call Anthropic.

A setup file points the default database path at a sentinel, so tests can never write to your real library.

```bash
npm test          # 120 tests (engine + API), several thousand generated cases
npm run typecheck # all three workspaces
```

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push:
1. typecheck;
2. both test suites;
3. a check that the SQL migrations match the Drizzle schema;
4. the web build;
5. the demo build, uploaded as an artifact.

---

## Getting started

**Requirements:** Node 22+ (the API uses Node's built-in `.env` loader).

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then add your ANTHROPIC_API_KEY
npm run dev                              # web on :5173, API on :8787
```

| Variable (`apps/api/.env`) | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | for Deep Dive | – |
| `EXPLAIN_MODEL` | no | `claude-opus-5-5` |
| `PORT` | no | `8787` (Vite forwards `/api` here) |

Other scripts: `npm run dev:web` (UI only), `npm run dev:api` (API only), `npm test`, `npm run typecheck`.

### Read-only demo (for the portfolio)

| Command | What it gives you |
|---|---|
| `npm run build:demo` | A **static** site in `apps/web/dist-demo` that can be hosted anywhere (relative paths), with no server and no API key |
| `npm run dev:demo` | The same, locally |
| API with `DEMO_MODE=true` (or `--demo`) | For a hosted server: no database, every write refused (403) |

In both forms, the demo:
- shows only the bundled demo tune;
- serves Deep Dives from `apps/api/demo/explanations.json`, so visitors never trigger an Anthropic call.

The shipped file holds the engine's own text. To replace it with Claude-written Deep Dives, run this once with your key:

```bash
npm run demo:generate -w @reharm/api
```

It uses the explanation cache, so re-runs only pay for new moves. Add `-- --template` to rebuild it from engine text without the API. Re-run it whenever the rules change; a test fails if any demo move is missing from the file.

### Practice history

`practice_sessions`, `coach_attempts`, `improv_runs` and `concept_reviews` record:
- coach runs per concept and key (the "clean in" keys);
- heatmap summaries;
- a spaced-repetition schedule (SM-2 style) per concept per key.

Endpoints are under `/api/practice`: `sessions`, `coach-attempts`, `improv-runs`, `progress`, `due`.

A MIDI keyboard is optional: every practice tool also takes clicks on the on-screen keys. Web MIDI works in Chromium-based browsers (Chrome, Edge).

---

## Project layout

```
packages/theory-core/   deterministic engine
  src/pitch.ts            spelled pitches, intervals, MIDI
  src/chords.ts           chord tones, guide tones, symbols
  src/rules.ts            the reharm rules (ii–V, tritone sub, upper structure, gospel turnaround)
  src/engine.ts           generate → melody filter → score
  src/pathway.ts          dial levels, non-overlapping pathways, realization
  src/scales.ts           right-hand scale mapping
  src/voicing.ts          minimum-movement voicing engine
  src/coach.ts            drill steps, strike diff, voice-leading diff
  src/lineEval.ts         improv note evaluation
  src/transpose.ts        12-key transfer
  src/import/ireal.ts     iReal Pro link parser
  src/analysis.ts         Roman-numeral analysis
  test/                   property-based + golden tests
apps/web/               React app
  src/design/             Rough.js primitives, tokens, SVG filters
  src/components/         lead sheet, move cards, transport, practice tools
  src/audio/              Tone.js arranger and player
  src/midi/               Web MIDI hook, note bus, chord-strike detection
apps/api/               Hono server: library, iReal import, moves, Claude Deep Dive
  src/db/                 Drizzle schema, sql.js client, repository
  drizzle/                SQL migrations (npm run db:generate -w @reharm/api)
```

---

## Roadmap

- Connect the Comping Coach and heatmap to `/api/practice` and add a "due today" review queue to the UI.
- Melody capture from MIDI, so imported tunes get the melody check.
- MusicXML import (melody included, so moves can be melody-checked).
- Arrangement builder: chain pathways chorus by chorus and export MIDI or MusicXML.
- Spaced-repetition "Concept Passport" across tunes.
- Heatmap analytics across sessions.

---

## A note on music data

Jazz standards and their melodies are usually under copyright. The repository ships only the chord changes and two melody anchor notes needed to demonstrate the engine. Bring your own lead sheets for personal practice.
