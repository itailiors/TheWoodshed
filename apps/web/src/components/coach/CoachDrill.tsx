import {
  chordTones,
  chroma,
  diffStrike,
  diffVoiceLeading,
  drillSteps,
  generateMoves,
  prettyNote,
  prettySymbol,
  randomKey,
  transposeTune,
  type DrillStep,
  type ReharmMove,
  type StrikeDiff,
  type Tune,
  type VoiceLeadingDiff,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { player } from "../../audio/player";
import { pen } from "../../design/tokens";
import { saveCoachRun, type CoachRunResult } from "../../library/practice";
import { useChordStrikes } from "../../midi/noteBus";
import { midiName, type MidiStatus } from "../../midi/useMidi";
import { ChordName } from "../ChordName";
import { PenKeyboard, type PenMark } from "../practice/PenKeyboard";
import { useNarrow } from "../../device/media";
import { useWakeLock } from "../../device/wakeLock";
import { useGradingMode, type GradingMode, type SelfVerdict } from "./gradingMode";
import { SelfCheckPanel } from "./SelfCheckPanel";

interface Props {
  tune: Tune;
  move: ReharmMove;
  /** The key being drilled (the page's 12-key passport and "random key" both set it). */
  drillKey: string;
  onDrillKey: (k: string) => void;
  /** Every finished run, saved or not (the page stamps the passport straight away). */
  onRun?: (run: { key: string; clean: boolean }) => void;
  midiStatus: MidiStatus;
  onConnectMidi: () => void;
}

/** One go at one chord: heard and judged by the engine, or self-checked at an acoustic piano. */
type Attempt =
  | { step: number; pass: boolean; by: "engine"; diff: StrikeDiff; vl: VoiceLeadingDiff | null }
  | { step: number; pass: boolean; by: "self"; diff?: undefined; vl?: undefined };

const sameMidi = (played: number[], step: { target: { bass: number; upper: number[] } } | undefined) =>
  !!step && JSON.stringify([...played].sort((a, b) => a - b)) === JSON.stringify([step.target.bass, ...step.target.upper].sort((a, b) => a - b));

/** "back in 10 minutes", "next review tomorrow", "next review in 6 days". */
export function nextReview(intervalDays: number) {
  if (intervalDays < 1) return `back in ${Math.max(1, Math.round(intervalDays * 24 * 60))} minutes`;
  if (intervalDays < 1.5) return "next review tomorrow";
  return `next review in ${Math.round(intervalDays)} days`;
}

const voicing = (s: DrillStep) => [s.target.bass, ...s.target.upper];

/** A sounding MIDI note named as that chord spells it (A♭ in Fm9, not G♯). */
function spelled(step: DrillStep, midi: number) {
  const tone = chordTones(step.chord).find((t) => chroma(t.note) === midi % 12);
  return tone ? prettyNote(tone.note) : midiName(midi).replace(/-?\d+$/, "");
}

/**
 * What the voices did between two chords, as you'd say it at the piano:
 * "2 held · A♭→G (−1) · E♭→D (−1) · bass B♭→E♭". Upper voices are paired bottom to top.
 */
export function voiceMotion(prev: DrillStep, cur: DrillStep): string {
  const a = [...prev.target.upper].sort((x, y) => x - y);
  const b = [...cur.target.upper].sort((x, y) => x - y);
  let held = 0;
  const moves: string[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = b[i] - a[i];
    if (d === 0) held++;
    else moves.push(`${spelled(prev, a[i])}→${spelled(cur, b[i])} (${d > 0 ? "+" : "−"}${Math.abs(d)})`);
  }
  const bass = prev.target.bass === cur.target.bass ? [] : [`bass ${spelled(prev, prev.target.bass)}→${spelled(cur, cur.target.bass)}`];
  return [held ? `${held} held` : "", ...moves, ...bass].filter(Boolean).join(" · ");
}

const DEGREE_LABEL: Record<string, string> = { "3": "3rd?", b3: "♭3rd?", "4": "4th?", "7": "7th?", b7: "♭7th?", bb7: "°7?", "6": "6th?" };

/**
 * The drill at the heart of the Comping Coach: play the move chord by chord, get red-pen
 * feedback on every strike, then take it to another key. Each finished run is saved to the
 * practice history (graded and scheduled by the server).
 */
export function CoachDrill({ tune, move, drillKey: key, onDrillKey: setKey, onRun, midiStatus, onConnectMidi }: Props) {
  const [transfer, setTransfer] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [lastNotes, setLastNotes] = useState<number[] | null>(null);
  const [pending, setPending] = useState<number[]>([]);
  /** What the scheduler made of the last finished run (null until saved, or in the demo). */
  const [savedRun, setSavedRun] = useState<CoachRunResult | null>(null);
  const runId = useRef(0);
  /** The step being heard right now ("Hear the move" / "Hear this chord"), or null. */
  const [heard, setHeard] = useState<number | null>(null);
  const savedRunId = useRef(-1);
  const [mode, setMode] = useGradingMode(midiStatus);
  /** Self-check: has the current chord's voicing been revealed, and was it just marked missed? */
  const [revealed, setRevealed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const narrow = useNarrow();
  // a drill is hands-on-the-piano time: don't let the phone on the music stand go to sleep
  useWakeLock(true);

  const steps = useMemo(() => {
    const dtune = key === tune.key.tonic ? tune : transposeTune(tune, key);
    const dmove = generateMoves(dtune).accepted.find((m) => m.id === move.id) ?? move;
    return drillSteps(dtune, dmove);
  }, [tune, move, key]);

  const reset = () => {
    runId.current++;
    setSavedRun(null);
    setStepIdx(0);
    setAttempts([]);
    setLastNotes(null);
    setPending([]);
    setRevealed(false);
    setRetrying(false);
  };
  useEffect(reset, [move.id, key]);
  useEffect(
    () => () => {
      player.cancelAudition();
      setHeard(null);
    },
    [move.id, key],
  );
  useEffect(() => setShowHint(!transfer), [transfer]);

  const finished = stepIdx >= steps.length;
  const passed = (a: Attempt) => a.pass;
  const winning = attempts.filter(passed);
  const misses = attempts.length - winning.length;
  const leaps = winning.filter((a) => a.vl && !a.vl.smooth).length;
  const cleanRun = finished && misses === 0 && leaps === 0;
  const finishText = cleanRun
    ? transfer
      ? "Clean run! Next key coming up…"
      : "Clean run! Try it in another key."
    : [
        misses ? `Done, with ${misses} miss${misses === 1 ? "" : "es"}.` : "Done.",
        leaps ? `${leaps} change${leaps === 1 ? "" : "s"} jumped. Aim for every voice moving by step.` : "",
        "Restart for a clean run.",
      ]
        .filter(Boolean)
        .join(" ");

  useEffect(() => {
    if (!finished) return;
    // Report and save each finished run exactly once. The server grades it and schedules the review.
    if (savedRunId.current !== runId.current) {
      savedRunId.current = runId.current;
      const thisRun = runId.current;
      onRun?.({ key, clean: cleanRun });
      const maxLeap = Math.max(0, ...winning.map((a) => a.vl?.maxLeap ?? 0));
      // a run is self-graded if any chord in it was (a mixed run can't vouch for its leaps)
      const gradedBy = attempts.some((a) => a.by === "self") ? "self" : "engine";
      void saveCoachRun({ tuneId: tune.id, moveId: move.id, ruleId: move.ruleId, keyTonic: key, misses, leaps, maxLeap, gradedBy }).then(
        (r) => r && runId.current === thisRun && setSavedRun(r),
      );
    }
    if (transfer && cleanRun) {
      const t = setTimeout(() => setKey(randomKey(key)), 2200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, cleanRun, transfer, key]);

  const strike = (notes: number[]) => {
    if (finished) return;
    const step = steps[stepIdx];
    const diff = diffStrike(notes, step);
    const prevWin = [...attempts].reverse().find((a) => a.step === stepIdx - 1 && passed(a));
    const vl = prevWin?.diff && lastNotes ? diffVoiceLeading(prevWin.diff.played, notes, steps[stepIdx - 1], step) : null;
    const pass = diff.verdict === "perfect" || diff.verdict === "correct";
    setAttempts((a) => [...a, { step: stepIdx, pass, by: "engine", diff, vl }]);
    setLastNotes(notes);
    setPending([]);
    if (pass) setStepIdx((i) => i + 1);
  };
  useChordStrikes(strike, mode === "listen");

  /** The self-check's verdict on the current chord. A miss keeps it revealed for another go. */
  const selfGrade = (v: SelfVerdict) => {
    if (finished) return;
    setAttempts((a) => [...a, { step: stepIdx, pass: v === "nailed", by: "self" }]);
    setLastNotes(null);
    if (v === "nailed") {
      setStepIdx((i) => i + 1);
      setRevealed(false);
      setRetrying(false);
    } else setRetrying(true);
  };
  const switchMode = (m: GradingMode) => {
    setMode(m);
    reset();
  };

  // the engine's red pen only marks up strikes it heard
  const lastAny = attempts[attempts.length - 1];
  const last = lastAny?.by === "engine" ? lastAny : undefined;
  const current = steps[Math.min(stepIdx, steps.length - 1)];
  const missing: PenMark[] = last ? last.diff.guideTones.filter((g) => !g.present).map((g) => ({ midi: g.targetMidi, label: DEGREE_LABEL[g.degree] ?? `${prettyNote(g.degree)}?` })) : [];
  const wrong: PenMark[] = last ? last.diff.wrongNotes.map((w) => ({ midi: w.midi, label: prettyNote(w.name) })) : [];
  const showCheck = !!last && last.diff.verdict === "perfect" && (!last.vl || last.vl.smooth);

  const togglePending = (m: number) => {
    setPending((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
    void player.playNotes([m], 0.5);
  };

  const keyName = (k: string) => `${prettyNote(k)} ${tune.key.mode}`;

  // On a phone the full four-octave keyboard is ~11px a key: zoom to the octaves this move uses.
  const range = useMemo(() => {
    if (!narrow) return { low: 36, high: 84 };
    const all = steps.flatMap(voicing);
    const low = Math.max(21, Math.floor((Math.min(...all) - 2) / 12) * 12);
    const high = Math.min(108, Math.max(low + 24, Math.ceil((Math.max(...all) + 2) / 12) * 12));
    return { low, high };
  }, [narrow, steps]);
  const selfMode = mode === "self";
  const stepPrompt = finished ? "" : current.resolution ? "…and resolve it." : steps.length > 1 ? `Chord ${stepIdx + 1} of ${steps.length}.` : "";
  const noteNames = finished
    ? ""
    : `${spelled(current, current.target.bass)} (bass) · ${[...current.target.upper]
        .sort((a, b) => a - b)
        .map((m) => spelled(current, m))
        .join(" ")}`;

  const hearMove = () => void player.playSequence(steps.map(voicing), 1.2, setHeard);
  const hearChord = () => {
    const at = Math.min(stepIdx, steps.length - 1);
    void player.playSequence([voicing(steps[at])], 1.6, (i) => setHeard(i === null ? null : at));
  };
  const listening = heard !== null;
  const prevHeard = heard !== null && heard > 0 ? steps[heard - 1] : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 id="coach-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
          {move.title}
        </h2>
        <p className="text-sm text-ink-soft">
          bar {move.span.from.bar} of {tune.title} · L{move.level} · drilling in <span className="font-bold text-ink">{keyName(key)}</span>
        </p>
      </div>

      <GradingSwitch mode={mode} onMode={switchMode} midiConnected={midiStatus === "connected"} />

      {/* the assignment */}
      <section aria-live="polite">
        <p className="font-marker text-sm uppercase tracking-wider text-ink-soft">Play</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-3xl">
          {steps.map((s, i) => (
            <span key={s.chord.id + i} className="flex items-baseline gap-2">
              {i > 0 && <span className="font-marker text-ink-soft">→</span>}
              <span
                className={`relative rounded px-1 transition-transform duration-150 ${i === stepIdx && !listening ? "bg-wash-mustard/40" : ""} ${
                  heard === i ? "-rotate-2 scale-110" : ""
                } ${s.resolution ? "opacity-80" : ""}`}
                style={heard === i ? { boxShadow: `0 0 0 2px ${pen.red}` } : undefined}
              >
                {heard === i && (
                  <span aria-hidden className="absolute -left-3 -top-3 font-music text-base" style={{ color: pen.red }}>
                    ♪
                  </span>
                )}
                <ChordName symbol={s.symbol} />
                {i < stepIdx && (
                  <span className="absolute -right-2 -top-3 font-marker text-lg" style={{ color: pen.red }} aria-label="done">
                    ✓
                  </span>
                )}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {finished
            ? finishText
            : selfMode
              ? "Play each chord on your piano, check it against the voicing, and say how it went."
              : current.resolution
                ? "…and resolve it."
                : `Strike ${prettySymbol(current.symbol)}${steps.length > 1 ? ` (${stepIdx + 1} of ${steps.length})` : ""}.`}
        </p>
        {finished && savedRun && (
          <p className="mt-1 font-hand text-sm text-ink-soft" role="status">
            ✎ Saved to your passport: graded {savedRun.grade}/5 in {prettyNote(savedRun.review.keyTonic)} · {nextReview(savedRun.review.intervalDays)}
          </p>
        )}
      </section>

      {listening ? (
        <PenKeyboard {...range} target={prevHeard ? voicing(prevHeard) : []} played={voicing(steps[heard])} pending={[]} missing={[]} wrong={[]} onKey={togglePending} />
      ) : selfMode ? (
        // self-check: once revealed, the voicing in ink and the chord before as a dashed ghost
        <PenKeyboard
          {...range}
          target={revealed && stepIdx > 0 && !finished ? voicing(steps[stepIdx - 1]) : []}
          played={revealed && !finished ? voicing(current) : []}
          check={finished && misses === 0}
        />
      ) : (
        <PenKeyboard
          {...range}
          target={showHint && !finished ? [current.target.bass, ...current.target.upper] : []}
          played={lastNotes ?? []}
          pending={pending}
          missing={missing}
          wrong={wrong}
          check={showCheck}
          onKey={togglePending}
        />
      )}
      {listening && (
        <p className="-mt-2 font-hand text-sm" aria-live="polite">
          <span className="font-marker" style={{ color: pen.red }}>
            ♪ {prettySymbol(steps[heard].symbol)}
          </span>
          {steps.length > 1 && <span className="text-ink-soft"> ({heard + 1} of {steps.length})</span>}
          {prevHeard ? (
            <span className="text-ink-soft"> · {voiceMotion(prevHeard, steps[heard])}</span>
          ) : (
            <span className="text-ink-soft"> · ink = sounding now{steps.length > 1 ? ", dashes = the chord before" : ""}</span>
          )}
        </p>
      )}

      {selfMode && !finished && !listening && (
        <SelfCheckPanel
          symbol={current.symbol}
          prompt={stepPrompt}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onVerdict={selfGrade}
          noteNames={noteNames}
          motion={stepIdx > 0 ? voiceMotion(steps[stepIdx - 1], current) : null}
          retrying={retrying}
        />
      )}

      {/* red-pen comments */}
      {last && (
        <ul className="-rotate-[0.6deg] space-y-1 font-marker text-[17px] leading-snug" style={{ color: pen.red }}>
          {last.diff.verdict === "perfect" && (
            <li>
              ✓ {sameMidi(last.diff.played, steps[last.step]) ? "Exactly the engine's voicing." : "Right voicing, with the notes in a different octave layout."}{" "}
              {last.vl?.smooth ? "And the voice leading is clean." : ""}
            </li>
          )}
          {last.diff.verdict === "correct" && <li>✓ Right notes, different voicing. That counts.</li>}
          {last.diff.comments.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
          {last.vl && (
            <li>
              {last.vl.smooth ? "✓ " : "↯ "}
              {last.vl.comment}
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 font-marker">
        {pending.length >= 2 && (
          <button type="button" onClick={() => strike(pending)} className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 text-paper-light">
            Strike {pending.length} notes
          </button>
        )}
        {/* disabled while one is sounding: a second press would stack the audio on top */}
        <button type="button" onClick={hearChord} disabled={listening} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade disabled:cursor-default disabled:opacity-50">
          ▶ Hear this chord
        </button>
        <button type="button" onClick={hearMove} disabled={listening} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade disabled:cursor-default disabled:opacity-50">
          {listening && steps.length > 1 ? "♪ Playing the move…" : "▶ Hear the move"}
        </button>
        <button type="button" onClick={reset} className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 hover:bg-paper-shade">
          ↺ Restart
        </button>
      </div>

      {/* 12-key transfer controls (the passport beside the drill picks a specific key) */}
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-ink-faint pt-3 text-sm">
        <button type="button" onClick={() => setKey(randomKey(key))} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:bg-paper-shade">
          🔀 Random key
        </button>
        {key !== tune.key.tonic && (
          <button type="button" onClick={() => setKey(tune.key.tonic)} className="cursor-pointer underline">
            back to {keyName(tune.key.tonic)}
          </button>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={transfer} onChange={(e) => setTransfer(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          New key after every clean run
        </label>
        {/* in a self-check the reveal is the hint */}
        {!selfMode && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showHint} onChange={(e) => setShowHint(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
            Show the voicing hint
          </label>
        )}
      </div>
      <p className="text-sm text-ink-soft">
        Think in function, not finger shapes: “{move.title}”. The engine has re-spelled every chord and voicing for {keyName(key)}.{" "}
        {midiStatus === "connected" ? (
          "Listening to your MIDI keyboard: strike each chord, then release all keys."
        ) : selfMode ? (
          "Self-checked runs are saved and scheduled for review like any other, marked as self-graded."
        ) : (
          <>
            No MIDI keyboard?{" "}
            <button type="button" onClick={onConnectMidi} className="cursor-pointer underline">
              Connect one
            </button>
            , or click keys above and press Strike.
          </>
        )}
      </p>
    </div>
  );
}

/** Listen (the engine hears your notes) or self-check (an acoustic piano, no cable). */
function GradingSwitch({ mode, onMode, midiConnected }: { mode: GradingMode; onMode: (m: GradingMode) => void; midiConnected: boolean }) {
  const opts: { id: GradingMode; label: string; title: string }[] = [
    { id: "listen", label: midiConnected ? "🎹 Listening to MIDI" : "🎹 Play it here", title: "The engine hears what you play (MIDI, computer keys or the keys below) and marks it up" },
    { id: "self", label: "✋ Self-check", title: "At an acoustic piano: reveal the voicing, play it, grade yourself" },
  ];
  return (
    <div role="radiogroup" aria-label="How your playing is checked" className="flex flex-wrap items-center gap-2 font-marker text-sm">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          disabled={midiConnected && o.id === "self"}
          onClick={() => onMode(o.id)}
          className={`cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 disabled:cursor-default disabled:opacity-40 ${mode === o.id ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
        >
          {o.label}
        </button>
      ))}
      {midiConnected && <span className="font-hand text-xs text-ink-soft">(MIDI connected, so the engine listens)</span>}
    </div>
  );
}
