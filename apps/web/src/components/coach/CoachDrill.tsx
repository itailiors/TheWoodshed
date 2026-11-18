import {
  KEYS,
  RULES,
  chordTones,
  chroma,
  conceptDrillSteps,
  diffStrike,
  diffVoiceLeading,
  drillSteps,
  generateMoves,
  mod,
  prettyNote,
  prettySymbol,
  randomKey,
  symbol,
  transposeTune,
  type DrillStep,
  type ReharmMove,
  type RulePedagogy,
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
import { PenKeyboard, type PenKeyboardProps, type PenMark } from "../practice/PenKeyboard";
import { useNarrow } from "../../device/media";
import { useWakeLock } from "../../device/wakeLock";
import { useGradingMode, type GradingMode, type SelfVerdict } from "./gradingMode";
import { SelfCheckPanel } from "./SelfCheckPanel";

export type KeyFlow = "fourths" | "fifths" | "hold";

interface Props {
  tune: Tune;
  move: ReharmMove;
  /** When set, drills the rule's pure canonical cadence in `drillKey` via `conceptDrillSteps`. */
  conceptRuleId?: string | null;
  /** How the key advances around the circle after a clean run. */
  keyFlow?: KeyFlow;
  /** The key being drilled (the page's 12-key passport and circle ribbon both set it). */
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
export function nextCircleKey(currentKey: string, flow: KeyFlow): string {
  if (flow === "fourths") return KEYS[mod(chroma(currentKey) + 5, 12)];
  if (flow === "fifths") return KEYS[mod(chroma(currentKey) + 7, 12)];
  return currentKey;
}

export function CoachDrill({
  tune,
  move,
  conceptRuleId = null,
  keyFlow = "hold",
  drillKey: key,
  onDrillKey: setKey,
  onRun,
  midiStatus,
  onConnectMidi,
}: Props) {
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
  /** Study mode: which chord of the move is on the keyboard. */
  const [studyIdx, setStudyIdx] = useState(0);
  const studyMode = mode === "study";
  const narrow = useNarrow();
  // a drill is hands-on-the-piano time: don't let the phone on the music stand go to sleep
  useWakeLock(true);

  const { dmove, steps, rule, activeTune } = useMemo(() => {
    if (conceptRuleId) {
      const res = conceptDrillSteps(conceptRuleId, key);
      const matchedRule = RULES.find((r) => r.id === conceptRuleId);
      return {
        dmove: res.move,
        steps: res.steps,
        rule: matchedRule,
        activeTune: res.tune,
      };
    }
    const dtune = key === tune.key.tonic ? tune : transposeTune(tune, key);
    const found = generateMoves(dtune).accepted.find((m) => m.id === move.id) ?? move;
    const matchedRule = RULES.find((r) => r.id === found.ruleId);
    return {
      dmove: found,
      steps: drillSteps(dtune, found),
      rule: matchedRule,
      activeTune: dtune,
    };
  }, [conceptRuleId, tune, move, key]);

  const drillIdentity = `${conceptRuleId ?? move.id}:${key}`;
  const [activeDrillIdentity, setActiveDrillIdentity] = useState(drillIdentity);

  const reset = () => {
    runId.current++;
    setSavedRun(null);
    setStepIdx(0);
    setAttempts([]);
    setLastNotes(null);
    setPending([]);
    setRevealed(false);
    setRetrying(false);
    setStudyIdx(0);
  };

  if (activeDrillIdentity !== drillIdentity) {
    setActiveDrillIdentity(drillIdentity);
    reset();
  }

  useEffect(
    () => () => {
      player.cancelAudition();
      setHeard(null);
    },
    [move.id, conceptRuleId, key],
  );
  useEffect(() => setShowHint(!transfer), [transfer]);

  const finished = activeDrillIdentity === drillIdentity && stepIdx >= steps.length;
  const passed = (a: Attempt) => a.pass;
  const winning = attempts.filter(passed);
  const misses = attempts.length - winning.length;
  const leaps = winning.filter((a) => a.vl && !a.vl.smooth).length;
  const cleanRun = finished && misses === 0 && leaps === 0;
  const autoAdvance = transfer || keyFlow !== "hold";
  const finishText = cleanRun
    ? autoAdvance
      ? `Clean run! Advancing to ${prettyNote(keyFlow !== "hold" ? nextCircleKey(key, keyFlow) : randomKey(key))}…`
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
      void saveCoachRun({ tuneId: tune.id, moveId: dmove.id, ruleId: dmove.ruleId, keyTonic: key, misses, leaps, maxLeap, gradedBy }).then(
        (r) => r && runId.current === thisRun && setSavedRun(r),
      );
    }
    if (autoAdvance && cleanRun) {
      const nextK = keyFlow !== "hold" ? nextCircleKey(key, keyFlow) : randomKey(key);
      const t = setTimeout(() => setKey(nextK), 1400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, cleanRun, autoAdvance, keyFlow, key]);

  const strike = (notes: number[]) => {
    if (finished) return;
    const step = steps[stepIdx];
    const diff = diffStrike(notes, step);
    const prevWin = [...attempts].reverse().find((a) => a.step === stepIdx - 1 && passed(a));
    const vl = prevWin?.diff ? diffVoiceLeading(prevWin.diff.played, notes, steps[stepIdx - 1], step) : null;
    const pass = diff.verdict === "perfect" || diff.verdict === "correct";
    setAttempts((a) => [...a, { step: stepIdx, pass, by: "engine", diff, vl }]);
    setPending([]);
    if (pass) {
      // Immediately clear lastNotes on step advance so the next chord starts on a clean slate
      setLastNotes(null);
      setStepIdx((i) => i + 1);
    } else {
      setLastNotes(notes);
    }
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

  // Strictly scope the engine's red-pen markup to the active stepIdx so prior chords never bleed
  const lastForStep = !finished
    ? [...attempts].reverse().find((a) => a.step === stepIdx && a.by === "engine")
    : undefined;
  const last = lastForStep?.by === "engine" ? lastForStep : undefined;
  const prevPassed =
    stepIdx > 0
      ? [...attempts].reverse().find((a) => a.step === stepIdx - 1 && a.pass && a.by === "engine")
      : undefined;
  const current = steps[Math.min(stepIdx, steps.length - 1)];
  const missing: PenMark[] = last ? last.diff.guideTones.filter((g) => !g.present).map((g) => ({ midi: g.targetMidi, label: DEGREE_LABEL[g.degree] ?? `${prettyNote(g.degree)}?` })) : [];
  const wrong: PenMark[] = last ? last.diff.wrongNotes.map((w) => ({ midi: w.midi, label: prettyNote(w.name) })) : [];
  const showCheck = finished && cleanRun;

  const togglePending = (m: number) => {
    setPending((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
    void player.playNotes([m], 0.5);
  };

  const keyName = (k: string) => `${prettyNote(k)} ${activeTune.key.mode}`;

  // On a phone the four-octave keyboard is ~11px a key, and even the octaves one move uses come to
  // ~15px. So take just the notes this move needs and, past ~10 white keys, stack two rows.
  const rows = useMemo(() => (narrow ? phoneKeyboardRows(steps.flatMap(voicing)) : [{ low: 36, high: 84 }]), [narrow, steps]);
  const keyboard = (p: Omit<PenKeyboardProps, "low" | "high">) =>
    rows.length === 1 ? (
      <PenKeyboard {...rows[0]} {...p} />
    ) : (
      // higher notes on top, like a grand staff; both rows at the same key size (the shorter row is
      // narrower, not stretched); the checkmark goes on the top row only
      <div role="group" aria-label="Practice keyboard, in two rows" className="space-y-1">
        {[...rows].reverse().map((r, i) => (
          <div key={r.low} style={{ width: `${(100 * whiteCount(r.low, r.high)) / Math.max(...rows.map((x) => whiteCount(x.low, x.high)))}%` }}>
            <PenKeyboard {...r} {...p} check={i === 0 ? p.check : false} showSplit={false} slim />
          </div>
        ))}
      </div>
    );
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
    const at = Math.min(studyMode ? studyIdx : stepIdx, steps.length - 1);
    void player.playSequence([voicing(steps[at])], 1.6, (i) => setHeard(i === null ? null : at));
  };
  const listening = heard !== null;
  const prevHeard = heard !== null && heard > 0 ? steps[heard - 1] : null;

  // Study: step through the chords; ← → too, unless you're typing somewhere
  const studyStep = Math.min(studyIdx, steps.length - 1);
  const studyTo = (i: number) => setStudyIdx(Math.max(0, Math.min(steps.length - 1, i)));
  useEffect(() => {
    if (!studyMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") setStudyIdx((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setStudyIdx((i) => Math.min(steps.length - 1, i + 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studyMode, steps.length]);

  const why = rule?.pedagogy && (
    <WhyThisWorksCard pedagogy={rule.pedagogy} move={dmove} keyLabel={keyName(key)} activeStep={!finished ? current : undefined} />
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 id="coach-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
          {dmove.title}
        </h2>
        <p className="text-sm text-ink-soft">
          {conceptRuleId ? "12-Key Concept Cadence" : `bar ${dmove.span.from.bar} of ${tune.title}`} · L{dmove.level} · drilling in{" "}
          <span className="font-bold text-ink">{keyName(key)}</span>
        </p>
      </div>

      <GradingSwitch mode={mode} onMode={switchMode} midiConnected={midiStatus === "connected"} />

      {!narrow && why}

      {/* the assignment */}
      <section aria-live="polite">
        <p className="font-marker text-sm uppercase tracking-wider text-ink-soft">{studyMode ? "Study" : "Play"}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-3xl">
          {steps.map((s, i) => (
            <span key={s.chord.id + i} className="flex items-baseline gap-2">
              {i > 0 && <span className="font-marker text-ink-soft">→</span>}
              <span
                title={s.stepCue ? `${s.stepCue.role}: ${s.stepCue.whyHere}` : undefined}
                // in study mode each chord is a button: tap it to put it on the keyboard
                {...(studyMode
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-pressed": i === studyStep,
                      onClick: () => studyTo(i),
                      onKeyDown: (e: { key: string; preventDefault(): void }) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), studyTo(i)),
                    }
                  : {})}
                className={`relative rounded px-1 transition-transform duration-150 ${
                  (studyMode ? i === studyStep : i === stepIdx && !finished) && !listening ? "bg-wash-mustard/40" : ""
                } ${studyMode ? "cursor-pointer hover:-translate-y-0.5" : ""} ${heard === i ? "-rotate-2 scale-110" : ""} ${s.resolution ? "opacity-80" : ""} ${
                  !studyMode && i < stepIdx ? "opacity-55" : ""
                }`}
                style={heard === i ? { boxShadow: `0 0 0 2px ${pen.red}` } : undefined}
              >
                {heard === i && (
                  <span aria-hidden className="absolute -left-3 -top-3 font-music text-base" style={{ color: pen.red }}>
                    ♪
                  </span>
                )}
                <ChordName symbol={s.symbol} />
                {!studyMode && i < stepIdx && (
                  <span className="absolute -right-2 -top-3 font-marker text-lg" style={{ color: pen.red }} aria-label="done">
                    ✓
                  </span>
                )}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {studyMode
            ? "Nothing is graded here: see each chord on the keys, hear it, then step to the next."
            : finished
            ? finishText
            : selfMode
              ? "Play each chord on your piano, check it against the voicing, and say how it went."
              : current.resolution
                ? "…and resolve it."
                : `Strike ${prettySymbol(current.symbol)}${steps.length > 1 ? ` (${stepIdx + 1} of ${steps.length})` : ""}.`}
        </p>
        {!finished && prevPassed?.by === "engine" && !last && (
          <p className="mt-1 font-hand text-xs text-ink-soft" role="status">
            ✓ {prettySymbol(steps[prevPassed.step].symbol)} nailed
            {prevPassed.vl ? ` · ${prevPassed.vl.comment}` : ""}
          </p>
        )}
        {finished && savedRun && (
          <p className="mt-1 font-hand text-sm text-ink-soft" role="status">
            ✎ Saved to your passport: graded {savedRun.grade}/5 in {prettyNote(savedRun.review.keyTonic)} · {nextReview(savedRun.review.intervalDays)}
          </p>
        )}
      </section>

      {/* study: the chord arrows sit right above the keys, so stepping and seeing stay on one screen */}
      {studyMode && !listening && <StudyNav steps={steps} at={studyStep} onStep={studyTo} onHear={hearChord} />}
      {listening
        ? keyboard({ target: voicing(steps[heard]), played: [], pending: [], missing: [], wrong: [], onKey: togglePending })
        : studyMode
          ? // study: the chord's voicing as pressed keys, each named; tap a key to hear that note
            keyboard({
              played: voicing(steps[studyStep]),
              labels: voicing(steps[studyStep]).map((m) => ({ midi: m, label: spelled(steps[studyStep], m) })),
              onKey: (m) => void player.playNotes([m], 0.6),
            })
          : selfMode
          ? // self-check: once revealed, isolate only the current chord's target voicing
            keyboard({ target: revealed && !finished ? voicing(current) : [], played: [], check: finished && misses === 0 })
          : keyboard({
              target: showHint && !finished ? [current.target.bass, ...current.target.upper] : [],
              played: !finished && last ? (lastNotes ?? []) : [],
              pending,
              missing,
              wrong,
              check: showCheck,
              onKey: togglePending,
            })}
      {studyMode && !listening && <StudyNotes steps={steps} at={studyStep} />}
      {/* on a phone, Strike sits right under the keys so you don't scroll between tapping and striking */}
      {narrow && !selfMode && !studyMode && !listening && (
        <div className="-mt-2 flex min-h-11 items-center gap-2 font-marker">
          {pending.length >= 2 ? (
            <>
              <button type="button" onClick={() => strike(pending)} className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 text-paper-light">
                Strike {pending.length} notes
              </button>
              <button type="button" onClick={() => setPending([])} className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5">
                Clear
              </button>
            </>
          ) : (
            !finished && <span className="font-hand text-sm text-ink-soft">Tap the notes, then strike.</span>
          )}
        </div>
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
            <span className="text-ink-soft"> · isolated voicing for this step</span>
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
        {pending.length >= 2 && !narrow && (
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
        {!selfMode && !studyMode && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showHint} onChange={(e) => setShowHint(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
            Show the voicing hint
          </label>
        )}
      </div>
      <p className="text-sm text-ink-soft">
        Think in function, not finger shapes: “{dmove.title}”. The engine has re-spelled every chord and voicing for {keyName(key)}.{" "}
        {studyMode ? (
          "When it sits under your fingers, switch to Play it here or Self-check and run it for real."
        ) : midiStatus === "connected" ? (
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

      {/* on a phone the theory folds away below the drill, so the keys come first */}
      {narrow && why && (
        <details className="group">
          <summary className="cursor-pointer list-none font-marker text-sm uppercase tracking-wider text-ink-soft">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span> 💡 Why this works · <span className="text-ink">{rule?.pedagogy?.formula}</span>
          </summary>
          <div className="mt-2">{why}</div>
        </details>
      )}
    </div>
  );
}

/**
 * The keyboard for a phone: just the notes this move uses (two semitones of room either side,
 * snapped to white keys) and, when that's more than ~10 white keys, two rows split at a C near
 * the middle, so every key stays wide enough to tap.
 */
const isBlackKey = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
const whiteCount = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i).filter((m) => !isBlackKey(m)).length;

export function phoneKeyboardRows(notes: number[]): { low: number; high: number }[] {
  const black = isBlackKey;
  let low = Math.max(21, Math.min(...notes) - 2);
  let high = Math.min(108, Math.max(...notes) + 2);
  while (black(low)) low--;
  while (black(high)) high++;
  if (high - low < 12) high = low + 12 + (black(low + 12) ? 1 : 0); // at least an octave to play in
  const whites = whiteCount;
  if (whites(low, high) <= 10) return [{ low, high }];
  // split at a C or an F (white keys whose neighbour below is white too, so each row starts and
  // ends on a white key): the one that balances the rows best
  const cuts = Array.from({ length: high - low }, (_, i) => low + 1 + i).filter((m) => m % 12 === 0 || m % 12 === 5);
  if (!cuts.length) return [{ low, high }];
  const balance = (c: number) => Math.min(whites(low, c - 1), whites(c, high));
  const c = cuts.reduce((best, x) => (balance(x) > balance(best) ? x : best));
  return [
    { low, high: c - 1 },
    { low: c, high },
  ];
}

/** Generalized rule card + transposed original progression + active step cue shown before striking a chord. */
function WhyThisWorksCard({
  pedagogy,
  move,
  keyLabel,
  activeStep,
}: {
  pedagogy: RulePedagogy;
  move: ReharmMove;
  keyLabel: string;
  activeStep?: DrillStep;
}) {
  return (
    <aside
      aria-label="Why this move works"
      className="space-y-1.5 rounded-lg border-2 border-ink/80 bg-wash-mustard/20 px-3.5 py-2.5 text-sm leading-snug"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-marker text-xs font-bold uppercase tracking-wider text-ink-soft">
          💡 Why this works · <span className="text-ink">{pedagogy.formula}</span>
        </span>
        {move.original.length > 0 && (
          <span className="font-hand text-xs text-ink-soft">
            Replaces{" "}
            {move.original.map((c, i) => (
              <span key={c.id + i}>
                {i > 0 && " → "}
                <ChordName symbol={symbol(c)} className="font-bold text-ink line-through decoration-1" />
              </span>
            ))}
            {move.targetSymbol && (
              <>
                {" → "}
                <ChordName symbol={move.targetSymbol} className="text-ink-soft" />
              </>
            )}
          </span>
        )}
      </div>

      <p className="font-medium text-ink">{pedagogy.whyItWorks}</p>

      <p className="text-xs text-ink-soft">
        <span className="font-marker uppercase text-ink">When to use:</span> {pedagogy.whenToUse}{" "}
        <span className="text-ink-faint">·</span>{" "}
        <span className="font-marker uppercase text-ink">Bandstand cue:</span> {pedagogy.bandstandCue}{" "}
        <span className="text-ink-faint">·</span>{" "}
        <span className="font-marker uppercase text-ink">In {keyLabel}:</span> {move.text.summary}
      </p>

      {activeStep?.stepCue && (
        <div className="mt-1 border-t border-dashed border-ink-faint pt-1.5 text-xs text-ink">
          <span className="font-marker uppercase tracking-wide text-ink">
            Active step — {activeStep.stepCue.role}:
          </span>{" "}
          <span className="text-ink-soft">{activeStep.stepCue.whyHere}</span>
        </div>
      )}
    </aside>
  );
}

const SPLIT = 55; // G3, as on the keyboard: below it the left hand, from it up the right
const DEGREE_NAME: Record<string, string> = { "1": "root", "3": "3rd", b3: "♭3rd", "4": "4th", "5": "5th", b5: "♭5th", "#5": "♯5th", "6": "6th", "7": "7th", b7: "♭7th", bb7: "°7th" };

const INTERVAL_NAME = ["root", "♭9", "9", "♯9", "3rd", "11", "♯11", "5th", "♭13", "13", "♭7th", "7th"];

/** A note of the voicing as you'd say it at the piano: "B♭ (♭3rd)". */
function noteWithDegree(step: DrillStep, midi: number) {
  const tone = chordTones(step.chord).find((t) => chroma(t.note) === midi % 12);
  // a colour the engine added to the voicing (the 9 on an F6) isn't a chord tone: name it from the root
  const degree = tone ? (DEGREE_NAME[tone.degree] ?? prettyNote(tone.degree)) : INTERVAL_NAME[(midi - chroma(step.chord.root) + 120) % 12];
  return { name: spelled(step, midi), degree };
}

const STUDY_PILL = "tap-lg cursor-pointer whitespace-nowrap rounded-full border-2 border-ink px-3 font-marker hover:bg-paper-shade disabled:cursor-default disabled:opacity-35";

/** Study mode, above the keys: ‹ Last chord · which chord this is · Next chord ›, and a play button. */
function StudyNav({ steps, at, onStep, onHear }: { steps: DrillStep[]; at: number; onStep: (i: number) => void; onHear: () => void }) {
  const step = steps[at];
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => onStep(at - 1)} disabled={at === 0} aria-label="Last chord" className={STUDY_PILL}>
        ‹ Last
      </button>
      <button type="button" onClick={onHear} className="min-w-0 cursor-pointer text-center" aria-live="polite" title="Hear this chord">
        <span className="flex items-baseline justify-center gap-1.5">
          <ChordName symbol={step.symbol} className="text-2xl" />
          <span aria-hidden className="text-sm text-ink-soft">▶</span>
        </span>
        <span className="block font-hand text-xs text-ink-soft">
          chord {at + 1} of {steps.length}
          {step.resolution ? " · resolution" : ""}
        </span>
      </button>
      <button type="button" onClick={() => onStep(at + 1)} disabled={at === steps.length - 1} aria-label="Next chord" className={STUDY_PILL}>
        Next ›
      </button>
    </div>
  );
}

/**
 * Study mode, below the keys: how to play the chord shown on them. Each hand's notes bottom to
 * top with their degrees, how the voices got here from the last chord, and the step's job in
 * the move. Nothing is graded.
 */
function StudyNotes({ steps, at }: { steps: DrillStep[]; at: number }) {
  const step = steps[at];
  const notes = [step.target.bass, ...step.target.upper].sort((a, b) => a - b);
  const hand = (lh: boolean) => notes.filter((m) => (m < SPLIT) === lh).map((m) => noteWithDegree(step, m));
  const left = hand(true);
  const right = hand(false);
  return (
    <div className="space-y-2 rounded-xl border-2 border-dashed border-ink-faint p-3 md:p-4">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-hand text-base">
        {[
          ["Left hand", left],
          ["Right hand", right],
        ].map(([label, ns]) =>
          (ns as ReturnType<typeof noteWithDegree>[]).length ? (
            <div key={label as string} className="contents">
              <dt className="font-marker text-sm uppercase tracking-wide text-ink-soft">{label as string}</dt>
              <dd>
                {(ns as ReturnType<typeof noteWithDegree>[]).map((n, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-ink-faint"> · </span>}
                    <span className="font-marker text-ink">{n.name}</span>
                    {n.degree && <span className="text-sm text-ink-soft"> ({n.degree})</span>}
                  </span>
                ))}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="-mt-1 font-hand text-xs text-ink-faint">Bottom to top. Keys from G3 up are the right hand.</p>

      {at > 0 && (
        <p className="font-hand text-sm">
          <span className="font-marker text-ink-soft">From {prettySymbol(steps[at - 1].symbol)}:</span> {voiceMotion(steps[at - 1], step)}
        </p>
      )}
      {step.stepCue && (
        <p className="font-hand text-sm">
          <span className="font-marker text-ink-soft">{step.stepCue.role}:</span> {step.stepCue.whyHere}
        </p>
      )}
    </div>
  );
}

/** Listen (the engine hears your notes), self-check (an acoustic piano, no cable) or study (nothing graded). */
function GradingSwitch({ mode, onMode, midiConnected }: { mode: GradingMode; onMode: (m: GradingMode) => void; midiConnected: boolean }) {
  const opts: { id: GradingMode; label: string; title: string }[] = [
    { id: "listen", label: midiConnected ? "🎹 Listening to MIDI" : "🎹 Play it here", title: "The engine hears what you play (MIDI, computer keys or the keys below) and marks it up" },
    { id: "self", label: "✋ Self-check", title: "At an acoustic piano: reveal the voicing, play it, grade yourself" },
    { id: "study", label: "📖 Study it", title: "See each chord on the keys and how to play it, chord by chord. Nothing is graded" },
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
