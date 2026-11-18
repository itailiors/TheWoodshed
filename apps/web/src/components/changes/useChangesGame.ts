import {
  currentRound,
  currentStep,
  gameReducer,
  initialGame,
  trail,
  voiceChord,
  type GameState,
  type LevelId,
  type SpelledChord,
  type Stage,
  type Voicing,
} from "@reharm/theory-core";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { player } from "../../audio/player";
import { useNoteBus } from "../../midi/noteBus";

/*
 * Make the Changes in the browser: theory-core's pure reducer, plus the three things it leaves
 * to the UI. Time (when to move on), sound (the prompt chord, the replays, the round's
 * flourish) and input (notes from the bus: MIDI, QWERTY and the on-screen keys all arrive the
 * same way). Every effect is keyed on the phase and step it belongs to and cleans up after
 * itself, so StrictMode's double effects and leaving mid-sound are safe.
 */

/** How long a chord sounds in the prompt and the replays, and the pause to read the line after. */
const PROMPT_SECONDS = 1.1;
const REPLAY_SECONDS = 0.75;
const FLOURISH_SECONDS = 0.45;
const READ_PAUSE_MS = 1200;
/** If the audio can't start (blocked, or still loading), don't leave the player waiting forever. */
const PROMPT_FALLBACK_MS = 2500;

const asChord = (c: SpelledChord) => ({ root: c.root, quality: c.quality, extensions: [], alterations: [] });

/** Voice-lead a chain of chords from the previous voicing, the way a pianist would comp them. */
function voiceChain(chords: SpelledChord[], prev?: Voicing): number[][] {
  let last = prev;
  return chords.map((c) => {
    const v = voiceChord(asChord(c), last);
    last = v;
    return [v.bass, ...v.upper];
  });
}

export function useChangesGame() {
  const [s, dispatch] = useReducer(gameReducer, undefined, () => initialGame());
  /** The prompt chord's voicing, so replays and the next prompt voice-lead from it. */
  const lastVoicing = useRef<Voicing | undefined>(undefined);

  const start = useCallback((level: LevelId, stage: Stage) => {
    void player.init(); // a user gesture: wakes the audio (phones need this tap)
    lastVoicing.current = undefined;
    dispatch({ type: "START", level, stage, seed: Math.floor(Math.random() * 2 ** 31) });
  }, []);

  const step = currentStep(s);
  const stepKey = `${s.roundIdx}:${s.stepIdx}`;

  /** Sound the current chord, voice-led from the last one. */
  const playPrompt = useCallback(
    (onHeard?: () => void) => {
      if (!step) return;
      const v = voiceChord(asChord(step.from), lastVoicing.current);
      lastVoicing.current = v;
      void player.playSequence([[v.bass, ...v.upper]], PROMPT_SECONDS, (i) => i === 0 && onHeard?.());
    },
    [step],
  );

  // ── prompting: sound the chord; the answer is open once it's heard ──
  useEffect(() => {
    if (s.phase !== "prompting") return;
    if (s.stepIdx === 0) lastVoicing.current = undefined; // a new round starts fresh
    let ready = false;
    const go = () => {
      if (ready) return;
      ready = true;
      dispatch({ type: "PROMPT_READY" });
    };
    playPrompt(go);
    const t = setTimeout(go, PROMPT_FALLBACK_MS);
    return () => {
      clearTimeout(t);
      player.cancelAudition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, stepKey]);

  // ── feedback: replay the move (theirs, then the expected one if they differ) ──
  const verdictKind = s.verdict?.kind;
  useEffect(() => {
    if (s.phase !== "feedback" || !step || !s.verdict) return;
    const from = lastVoicing.current;
    const chords =
      s.verdict.kind === "alt"
        ? [step.from, s.verdict.played, step.from, step.expected]
        : [step.from, step.expected];
    const voicings = voiceChain(chords, from);
    let done = false;
    void player.playSequence(voicings, REPLAY_SECONDS, (i) => {
      if (i === null && !done) {
        done = true;
        dispatch({ type: "REPLAY_DONE" });
      }
    });
    // the next prompt voice-leads from where the replay landed
    lastVoicing.current = voiceChord(asChord(step.expected), from);
    const t = setTimeout(() => !done && dispatch({ type: "REPLAY_DONE" }), (chords.length * REPLAY_SECONDS + 1) * 1000);
    return () => {
      clearTimeout(t);
      player.cancelAudition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, stepKey, verdictKind]);

  // ── after the replay: a pause to read, then on (held while "why?" is open) ──
  useEffect(() => {
    if (s.phase !== "feedback" || !s.replayDone || s.whyOpen) return;
    const t = setTimeout(() => dispatch({ type: "ADVANCE" }), s.verdict?.kind === "wrong" ? 400 : READ_PAUSE_MS);
    return () => clearTimeout(t);
  }, [s.phase, s.replayDone, s.whyOpen, s.verdict]);

  // ── round end: the whole trip played back as a progression, then the next round ──
  useEffect(() => {
    if (s.phase !== "roundEnd") return;
    const chords = trail(s);
    let done = false;
    void player.playSequence(voiceChain(chords), FLOURISH_SECONDS, (i) => {
      if (i === null && !done) {
        done = true;
        setTimeout(() => dispatch({ type: "ADVANCE" }), 500);
      }
    });
    const t = setTimeout(() => !done && dispatch({ type: "ADVANCE" }), (chords.length * FLOURISH_SECONDS + 2) * 1000);
    return () => {
      clearTimeout(t);
      player.cancelAudition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.roundIdx]);

  // leaving the tab mid-sound: stop reporting (the notes ring out, as in the Coach)
  useEffect(() => () => player.cancelAudition(), []);

  // ── input: every note-on from the bus (MIDI, QWERTY, the on-screen keys) ──
  const listening = s.phase === "awaiting" || s.phase === "fixing";
  useNoteBus((m) => {
    if (m.type === "on") dispatch({ type: "NOTE", note: m.note, at: performance.now() });
  }, s.phase !== "idle" && s.phase !== "summary");

  return { s, dispatch, start, playPrompt, listening, round: currentRound(s), step };
}

export type ChangesGame = ReturnType<typeof useChangesGame>;
export type { GameState };
