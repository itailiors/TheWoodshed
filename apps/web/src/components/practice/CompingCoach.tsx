import {
  diffStrike,
  diffVoiceLeading,
  drillSteps,
  generateMoves,
  prettyNote,
  prettySymbol,
  randomKey,
  transposeTune,
  type ReharmMove,
  type StrikeDiff,
  type Tune,
  type VoiceLeadingDiff,
} from "@reharm/theory-core";
import { useEffect, useMemo, useState } from "react";
import { player } from "../../audio/player";
import { SketchBox, SketchRule } from "../../design/rough";
import { paper, pen, seedOf } from "../../design/tokens";
import { useChordStrikes } from "../../midi/noteBus";
import type { MidiStatus } from "../../midi/useMidi";
import { ChordName } from "../ChordName";
import { PenKeyboard, type PenMark } from "./PenKeyboard";

interface Props {
  tune: Tune;
  move: ReharmMove;
  midiStatus: MidiStatus;
  onConnectMidi: () => void;
  onClose: () => void;
}

interface Attempt {
  step: number;
  diff: StrikeDiff;
  vl: VoiceLeadingDiff | null;
}

const sameMidi = (played: number[], step: { target: { bass: number; upper: number[] } } | undefined) =>
  !!step && JSON.stringify([...played].sort((a, b) => a - b)) === JSON.stringify([step.target.bass, ...step.target.upper].sort((a, b) => a - b));

const DEGREE_LABEL: Record<string, string> = { "3": "3rd?", b3: "♭3rd?", "4": "4th?", "7": "7th?", b7: "♭7th?", bb7: "°7?", "6": "6th?" };

/** The comping coach: play the move, get red-pen feedback, then do it again in another key. */
export function CompingCoach({ tune, move, midiStatus, onConnectMidi, onClose }: Props) {
  const [key, setKey] = useState(tune.key.tonic);
  const [transfer, setTransfer] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [lastNotes, setLastNotes] = useState<number[] | null>(null);
  const [pending, setPending] = useState<number[]>([]);
  const [cleanKeys, setCleanKeys] = useState<string[]>([]);

  const { dtune, steps } = useMemo(() => {
    const dtune = key === tune.key.tonic ? tune : transposeTune(tune, key);
    const dmove = generateMoves(dtune).accepted.find((m) => m.id === move.id) ?? move;
    return { dtune, steps: drillSteps(dtune, dmove) };
  }, [tune, move, key]);

  const reset = () => {
    setStepIdx(0);
    setAttempts([]);
    setLastNotes(null);
    setPending([]);
  };
  useEffect(reset, [move.id, key]);
  useEffect(() => setShowHint(!transfer), [transfer]);

  const finished = stepIdx >= steps.length;
  const passed = (a: Attempt) => a.diff.verdict === "perfect" || a.diff.verdict === "correct";
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
    if (cleanRun) setCleanKeys((k) => (k.includes(key) ? k : [...k, key]));
    if (transfer && cleanRun) {
      const t = setTimeout(() => setKey((k) => randomKey(k)), 2200);
      return () => clearTimeout(t);
    }
  }, [finished, cleanRun, transfer, key]);

  const strike = (notes: number[]) => {
    if (finished) return;
    const step = steps[stepIdx];
    const diff = diffStrike(notes, step);
    const prevWin = [...attempts].reverse().find((a) => a.step === stepIdx - 1 && passed(a));
    const vl = prevWin && lastNotes ? diffVoiceLeading(prevWin.diff.played, notes, steps[stepIdx - 1], step) : null;
    setAttempts((a) => [...a, { step: stepIdx, diff, vl }]);
    setLastNotes(notes);
    setPending([]);
    if (diff.verdict === "perfect" || diff.verdict === "correct") setStepIdx((i) => i + 1);
  };
  useChordStrikes(strike, true);

  const last = attempts[attempts.length - 1];
  const current = steps[Math.min(stepIdx, steps.length - 1)];
  const missing: PenMark[] = last ? last.diff.guideTones.filter((g) => !g.present).map((g) => ({ midi: g.targetMidi, label: DEGREE_LABEL[g.degree] ?? `${prettyNote(g.degree)}?` })) : [];
  const wrong: PenMark[] = last ? last.diff.wrongNotes.map((w) => ({ midi: w.midi, label: prettyNote(w.name) })) : [];
  const showCheck = !!last && last.diff.verdict === "perfect" && (!last.vl || last.vl.smooth);

  const togglePending = (m: number) => {
    setPending((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
    void player.playNotes([m], 0.5);
  };

  const keyName = (k: string) => `${prettyNote(k)} ${tune.key.mode}`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" role="dialog" aria-modal="true" aria-labelledby="coach-h" onClick={onClose}>
      <div className="h-full w-full max-w-[640px] overflow-y-auto bg-paper p-4 shadow-2xl md:p-6" onClick={(e) => e.stopPropagation()}>
        <SketchBox seed={seedOf("coach")} fill={paper.light} strokeWidth={2}>
          <div className="space-y-4 p-4 md:p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="coach-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
                  Comping coach
                </h2>
                <p className="text-sm text-ink-soft">
                  {move.title} · bar {move.span.from.bar} · <span className="font-bold text-ink">{keyName(key)}</span>
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close coach" className="cursor-pointer font-marker text-2xl leading-none hover:rotate-6">
                ✕
              </button>
            </header>

            {/* the assignment */}
            <section aria-live="polite">
              <p className="font-marker text-sm uppercase tracking-wider text-ink-soft">Play</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl">
                {steps.map((s, i) => (
                  <span key={s.chord.id + i} className="flex items-baseline gap-2">
                    {i > 0 && <span className="font-marker text-ink-soft">→</span>}
                    <span className={`relative rounded px-1 ${i === stepIdx ? "bg-wash-mustard/40" : ""} ${s.resolution ? "opacity-80" : ""}`}>
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
                  : current.resolution
                    ? "…and resolve it."
                    : `Strike ${prettySymbol(current.symbol)}${steps.length > 1 ? ` (${stepIdx + 1} of ${steps.length})` : ""}.`}
              </p>
            </section>

            <PenKeyboard
              target={showHint && !finished ? [current.target.bass, ...current.target.upper] : []}
              played={lastNotes ?? []}
              pending={pending}
              missing={missing}
              wrong={wrong}
              check={showCheck}
              onKey={togglePending}
            />

            {/* red-pen comments */}
            {last && (
              <ul className="-rotate-[0.6deg] space-y-1 font-marker text-[17px] leading-snug" style={{ color: pen.red }}>
                {last.diff.verdict === "perfect" && (
                  <li>
                    ✓{" "}
                    {sameMidi(last.diff.played, steps[last.step]) ? "Exactly the engine's voicing." : "Right voicing, with the notes in a different octave layout."}{" "}
                    {last.vl?.smooth ? "And the voice leading is clean." : ""}
                  </li>
                )}
                {last.diff.verdict === "correct" && <li>✓ Right notes, different voicing. That counts.</li>}
                {last.diff.comments.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
                {last.vl && <li>{last.vl.smooth ? "✓ " : "↯ "}{last.vl.comment}</li>}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2 font-marker">
              {pending.length >= 2 && (
                <button type="button" onClick={() => strike(pending)} className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 text-paper-light">
                  Strike {pending.length} notes
                </button>
              )}
              <button type="button" onClick={() => player.playNotes([current.target.bass, ...current.target.upper])} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade">
                ▶ Hear this chord
              </button>
              <button type="button" onClick={() => player.playSequence(steps.map((s) => [s.target.bass, ...s.target.upper]))} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade">
                ▶ Hear the move
              </button>
              <button type="button" onClick={reset} className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 hover:bg-paper-shade">
                ↺ Restart
              </button>
            </div>

            <SketchRule seed={seedOf("coach-rule")} />

            {/* 12-key transfer */}
            <section className="space-y-2">
              <h3 className="font-marker text-lg font-bold uppercase">12-key transfer</h3>
              <div className="flex flex-wrap items-center gap-3 text-sm">
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
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={showHint} onChange={(e) => setShowHint(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
                  Show the voicing hint
                </label>
              </div>
              <p className="text-sm text-ink-soft">
                Think in function, not finger shapes: “{move.title}”. The engine has re-spelled every chord and voicing for {keyName(key)}.
              </p>
              {cleanKeys.length > 0 && (
                <p className="text-sm">
                  <span className="font-marker font-bold">Clean in:</span> {cleanKeys.map((k) => prettyNote(k)).join(" · ")}{" "}
                  <span className="text-ink-faint">({cleanKeys.length}/12)</span>
                </p>
              )}
            </section>

            <p className="text-xs text-ink-faint">
              {midiStatus === "connected" ? (
                "Listening to your MIDI keyboard: strike each chord, then release all keys."
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
        </SketchBox>
      </div>
    </div>
  );
}
