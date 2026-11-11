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
- A five-level "spice dial" (Original → Functional → Bebop → Gospel → Modern) picks a non-overlapping set of moves per level. The ranking favours higher levels, smoother voice leading, and variety (it avoids repeating the same rule).
- Moves show on the lead sheet as watercolour washes, coloured by category. Click one to open its card; swap in any alternative that fits the same bars.
- **Playback:** a Tone.js jazz-waltz arrangement on a sampled grand piano (Salamander), with a synth fallback. Bass on 1 and 3, right-hand comping on 1 and a swung "2&", and the melody on top.
- **Voice-led voicings:** each chord is voiced in the inversion that moves least from the previous one, so you hear the half-step motion the engine describes (Fm9 → B♭7(♭9) → E♭maj7 plays as 60 63 67 68 → 59 62 65 68 → 58 62 65 67).
- **Ghost A/B:** flip Original/Reharm or turn the dial *while it plays*. The new chords take over on the next beat. Loop just the selected move, change the tempo, and follow the pencil playhead.

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

### ✍️ Claude-powered Deep Dive
- One click turns a move into a short lesson: a summary, a 150–260-word deep dive (function, voice leading, how to hear and play it) and a key-independent rule.
- The server recomputes the move itself and sends Claude only the computed facts. Structured outputs keep the response in the `{ summary, deepDive, recreateRule }` shape.
- The system prompt sets the voice (analytical and encouraging, written for a pianist studying Bill Evans and Shaun Martin vocabulary) and the rules: no invented notes, keep the engine's spelling, flag missing melody data.
- Results are cached on disk by a hash of prompt version, model and facts, so each move is paid for once.

---

## Tech stack

| Layer | Tools |
|---|---|
| Theory engine | TypeScript, no runtime dependencies (`packages/theory-core`) |
| UI | React 19, Vite, Tailwind CSS v4 |
| "Living lead sheet" design | **Rough.js** (seeded hand-drawn shapes), SVG turbulence / displacement filters (ink wobble, watercolour washes), Google Fonts *Kalam*, *Architects Daughter* and *Noto Music* |
| Audio | **Tone.js** (Transport, Part, Sampler) with the Salamander Grand Piano samples |
| Input | **Web MIDI API**, with hot-plug support and a shared note bus for MIDI and on-screen keys |
| API | **Hono** on Node, **Anthropic SDK** (Claude, structured outputs, prompt caching) |
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

A **golden test** pins the engine to the original design simulation of *Someday My Prince Will Come* (bars 1–8), so the moves, the melody-based rejections, both pathways and the scale map are all exact.

```bash
npm test          # 36 tests, several thousand generated cases
npm run typecheck # all three workspaces
```

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
  test/                   property-based + golden tests
apps/web/               React app
  src/design/             Rough.js primitives, tokens, SVG filters
  src/components/         lead sheet, move cards, transport, practice tools
  src/audio/              Tone.js arranger and player
  src/midi/               Web MIDI hook, note bus, chord-strike detection
apps/api/               Hono server: tunes, moves, Claude Deep Dive
```

---

## Roadmap

- More rule packs: backdoor ii–V, passing diminished, Coltrane substitution, modal interchange, constant structure.
- Tune library with iReal Pro and MusicXML import (stored locally, for personal use).
- Arrangement builder: chain pathways chorus by chorus and export MIDI or MusicXML.
- Spaced-repetition "Concept Passport" across tunes.
- Heatmap analytics across sessions.

---

## A note on music data

Jazz standards and their melodies are usually under copyright. The repository ships only the chord changes and two melody anchor notes needed to demonstrate the engine. Bring your own lead sheets for personal practice.
