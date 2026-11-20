import { chroma, learnName, prettyNote, type Lesson, type LessonStep } from "@reharm/theory-core";
import { useEffect, useId, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { SketchBox } from "../../design/rough";
import { seedOf, wash } from "../../design/tokens";
import { useNarrow } from "../../device/media";
import { readLessonFlags, updateLessonFlag } from "../../learn/lessonFlags";
import { useQwerty } from "../../midi/qwerty";
import { countLearning } from "../../usage/panelOpens";
import { PenKeyboard, type PenMark } from "../practice/PenKeyboard";
import { COACH_LEARN_SHORTCUTS, ShortcutsHelp } from "../Shortcuts";
import { GlossaryChip } from "./GlossaryChip";
import { placeHighlights, playStep, type LessonAudioContext } from "./lessonAudio";
import { askIsOpen, pressKey } from "./stepperInput";
import { inRange, inSentence, keyEventOf, keyRange, splitOnTerm, stepperKey, type StepperAction, type StepperKeyEvent } from "./stepperKeys";
import { notLine, useTapAnswer } from "./useTapAnswer";

/*
 * GRADER ISOLATION (CLAUDE.md §0, PLAN safety rule 3). This folder never imports a drill, the
 * chord-strike grouper, the drill session or any saving path, and `learnIsolation.test.ts`
 * holds it to that. The stepper's keys reach the note bus only while an ask is open (and asks
 * can be switched off with `asksEnabled`), so no other listener hears a lesson otherwise.
 */

export interface LessonStepperProps {
  lesson: Lesson;
  /** "inline": inside a Study move card (3g), keys scoped to the stepper. "full": Coach's Learn stage (3d), keys on the page. */
  variant: "inline" | "full";
  /** The chords a rule lesson's before/after cues play. Basics bring their own `sound`. */
  audio?: LessonAudioContext;
  /** The return banner, folded into the header: "from Tritone sub". */
  from?: string;
  /** The last step's Next. Default "Study it ›" (full) or "Done" (inline). */
  finishLabel?: string;
  /** Called after the last step's Next has set `finishedAt`. */
  onFinish?: () => void;
  /** Glossary "Learn it →" and a step's "Learn that first →". Hidden when absent. */
  onLearn?: (conceptId: string) => void;
  /** A MIDI keyboard is connected (drops the "Tap the keys, or press M" line). */
  midiConnected?: boolean;
  /**
   * Predict-then-reveal asks. Off while another saving note listener shares the screen (Study's
   * improv heatmap): every step then shows its answer, and the keys never reach the note bus.
   */
  asksEnabled?: boolean;
  /** Play step 1's cue once on open (opening is a user gesture). Default true. */
  autoPlay?: boolean;
  /** The last step's "Go deeper" section, after the lesson's own `deeper` line (Study: melody check, grid, Deep Dive). */
  deeper?: ReactNode;
  /** The label on the rule box. Default "The rule"; Study keeps its "Recreate it". */
  ruleLabel?: string;
}

/**
 * One lesson, one step per screen (spec §A): the step's text in the hand font, up to 4 lit keys
 * with their labels written on the keys, ▶ Hear, ‹ Back / Next ›. An ask step hides its text and
 * lit keys until the player taps the answer (on-screen keys, computer keys or MIDI) or presses
 * "Show me". Nothing about right or wrong is stored.
 */
export function LessonStepper(props: LessonStepperProps) {
  // a different lesson (or the same concept in another key) starts again at step 1
  return <Stepper key={`${props.lesson.conceptId}|${props.lesson.headline}`} {...props} />;
}

type Reveal = "answered" | "shown";
const PULSE_MS = 1200;
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The marks a step puts on the keyboard. Pure. */
function keyMarks(step: LessonStep, low: number, high: number, askOpen: boolean, hits: number[], wrong: number | null) {
  const placed = placeHighlights(step.highlight.map((h) => h.note));
  const labelOf = new Map<number, string>(step.highlight.map((h, i) => [((placed[i] % 12) + 12) % 12, h.label]));
  const fit = (m: number) => inRange(((m % 12) + 12) % 12, low, high);
  let lit: PenMark[];
  if (!askOpen) {
    lit = placed.flatMap((m, i) => {
      const at = m >= low && m <= high ? m : fit(m);
      return at === null ? [] : [{ midi: at, label: step.highlight[i].label }];
    });
  } else {
    const answer = step.ask!.answer;
    lit = hits.flatMap((pc) => {
      const at = placed.find((m) => ((m % 12) + 12) % 12 === pc) ?? inRange(pc, low, high);
      if (at === null || at === undefined) return [];
      const spelled = answer.find((n) => chroma(n) === pc);
      return [{ midi: at, label: labelOf.get(pc) ?? prettyNote(spelled ?? "") }];
    });
  }
  const ghost = askOpen && wrong !== null ? inRange(wrong, low, high) : null;
  return { lit, ghost };
}

function Stepper({
  lesson,
  variant,
  audio,
  from,
  finishLabel,
  onFinish,
  onLearn,
  midiConnected = false,
  asksEnabled = true,
  autoPlay = true,
  deeper,
  ruleLabel = "The rule",
}: LessonStepperProps) {
  const steps = lesson.steps;
  const last = steps.length - 1;
  const [at, setAt] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [revealed, setRevealed] = useState<Record<number, Reveal>>({});
  const [pulsed, setPulsed] = useState(false);
  const [status, setStatus] = useState("");
  const [help, setHelp] = useState(false);
  const narrow = useNarrow();
  const deeperId = useId();
  const qwertyOn = useQwerty().enabled;
  const heading = useRef<HTMLHeadingElement>(null);
  const showMe = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[at];
  const askOpen = askIsOpen(step, asksEnabled, revealed[at]);

  // seen on open: idempotent (only the first open stamps it), so StrictMode's second run is harmless
  useEffect(() => {
    if (readLessonFlags()[lesson.conceptId]?.seenAt) return;
    updateLessonFlag(lesson.conceptId, { seenAt: new Date().toISOString() });
  }, [lesson.conceptId]);

  // step 1's cue sounds once on open; the ref survives StrictMode's second effect run
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (!autoPlay || autoPlayed.current) return;
    autoPlayed.current = true;
    playStep(steps[0], audio);
  }, [autoPlay, steps, audio]);

  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    [],
  );

  // focus follows Next/Back (not the first render: opening a card shouldn't steal focus)
  useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    heading.current?.focus();
  }, [at, revealed]);

  const reveal = (how: Reveal) => {
    setRevealed((r) => (r[at] ? r : { ...r, [at]: how }));
    setPulsed(false);
    if (how === "answered" && step.ask) setStatus(`✓ ${listOf(step.ask.answer.map(prettyNote))}`);
    // the Show me button goes away with the ask: keep focus on the step
    focusAfter.current = true;
  };

  const tap = useTapAnswer(step.ask?.answer, askOpen, () => reveal("answered"), at);
  useEffect(() => {
    if (tap.wrong !== null) setStatus(notLine(tap.wrong));
  }, [tap.wrong]);

  const go = (i: number) => {
    if (i < 0 || i > last || i === at) return;
    setAt(i);
    setFurthest((f) => Math.max(f, i));
    setPulsed(false);
    setStatus("");
    focusAfter.current = true;
  };
  const finish = () => {
    // finishing clears a "Relearn this": the concept counts as finished again
    updateLessonFlag(lesson.conceptId, { finishedAt: new Date().toISOString(), relearn: undefined });
    countLearning("learn.finish");
    onFinish?.();
  };
  const next = () => {
    if (at === last) return finish();
    countLearning("learn.step");
    go(at + 1);
  };
  const hear = () => playStep(step, audio);
  const focusShowMe = () => {
    showMe.current?.focus();
    setPulsed(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => showMe.current?.classList.remove("animate-pulse"), PULSE_MS);
    showMe.current?.classList.add("animate-pulse");
  };

  const act = (a: StepperAction) => {
    if (a === "back") go(at - 1);
    else if (a === "next") next();
    else if (a === "hear") hear();
    else if (a === "focusShowMe") focusShowMe();
    else reveal("shown");
  };
  const handle = (e: StepperKeyEvent) => stepperKey(e, { askOpen, showMePulsed: pulsed });

  // full variant: the page's keys belong to the lesson while it's mounted (Coach mounts it only on the Learn stage)
  const actRef = useRef({ act, handle });
  actRef.current = { act, handle };
  useEffect(() => {
    if (variant !== "full") return;
    const onKey = (e: KeyboardEvent) => {
      const ke = keyEventOf(e);
      if (e.key === "?" && !ke.altKey && !ke.ctrlKey && !ke.metaKey && !["input", "textarea", "select"].includes(ke.tag)) {
        e.preventDefault();
        setHelp(true);
        return;
      }
      const a = actRef.current.handle(ke);
      if (!a) return;
      e.preventDefault();
      actRef.current.act(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  // inline variant: keys only while focus is inside the stepper, and they stop here (Study's own ←/→ and Space stay put)
  const onInlineKey = (e: RKeyboardEvent) => {
    if (variant !== "inline") return;
    const a = handle(keyEventOf(e.nativeEvent));
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    act(a);
  };

  // ── the keyboard ──
  const showKeys = step.highlight.length > 0 || !!step.ask;
  const placed = placeHighlights(step.highlight.map((h) => h.note));
  const { low, high } = keyRange(placed, narrow ? 12 : 24);
  const { lit, ghost } = keyMarks(step, low, high, askOpen, tap.hits, tap.wrong);

  const name = learnName(lesson.conceptId);
  const nextLabel = at === last ? (finishLabel ?? (variant === "full" ? "Study it ›" : "Done")) : "Next ›";
  const split = splitOnTerm(step.text, step.term);
  const noInput = !midiConnected && !qwertyOn;
  const full = variant === "full";

  const navBtn = "tap-lg cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-sm disabled:cursor-default disabled:opacity-40";
  const nav = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Step controls">
      <button type="button" onClick={() => go(at - 1)} disabled={at === 0} className={`${navBtn} border-ink-soft hover:border-ink`}>
        ‹ Back
      </button>
      <button type="button" onClick={hear} className={`${navBtn} border-ink-soft hover:border-ink`} aria-label="Hear this step">
        <span aria-hidden className="mr-1">▶</span>Hear
      </button>
      <span className="ml-auto inline-flex items-center gap-2">
        {askOpen && (
          <button
            ref={showMe}
            type="button"
            onClick={() => reveal("shown")}
            className="cursor-pointer font-marker text-sm text-ink-soft underline decoration-dashed underline-offset-4 hover:text-ink motion-reduce:animate-none"
          >
            Show me
          </button>
        )}
        <button type="button" onClick={next} className={`${navBtn} border-ink bg-paper-light hover:-rotate-1`}>
          {nextLabel}
        </button>
      </span>
    </div>
  );

  const keyboard = showKeys && (
    <div role="group" aria-label={askOpen ? "Keyboard: tap the answer" : "Keyboard"}>
      <PenKeyboard
        low={low}
        high={high}
        showSplit={false}
        // a wrong key is a dashed ghost on the key and its name in red pen above the keyboard (in the
        // text, not over the keys), so the keyboard never grows label room and jumps under a finger
        slim
        short={narrow}
        pending={lit.map((l) => l.midi)}
        keyLabels={lit}
        target={ghost !== null ? [ghost] : []}
        // the tick goes on the keys that answered the ask, not on every lit key
        ticks={revealed[at] === "answered" && step.ask ? lit.map((l) => l.midi).filter((m) => step.ask!.answer.some((n) => chroma(n) === m % 12)) : []}
        onKey={(m) => pressKey(m, askOpen)}
      />
    </div>
  );

  return (
    <div
      data-lesson-stepper={lesson.conceptId}
      data-variant={variant}
      onKeyDown={onInlineKey}
      className={`text-ink ${full ? "space-y-3" : "space-y-2"}`}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {full && <span className="font-marker text-lg font-bold">{name}</span>}
        {from && <span className="font-hand text-sm text-ink-soft">from {from}</span>}
        <h3 ref={heading} tabIndex={-1} className="font-marker text-sm text-ink-soft outline-none focus-visible:underline" data-step-heading>
          Step {at + 1} of {steps.length}
        </h3>
        <nav aria-label="Steps" className="ml-auto">
          <ol className="flex items-center">
            {steps.map((_, i) => (
              <li key={i}>
                {/* the button is the tap target (44px tall on touch); the dot inside is what you see */}
                <button
                  type="button"
                  aria-label={`Step ${i + 1}`}
                  aria-current={i === at ? "step" : undefined}
                  onClick={() => go(i)}
                  className="group grid cursor-pointer place-items-center p-[3px] pointer-coarse:min-h-11 pointer-coarse:min-w-7"
                >
                  <span
                    aria-hidden
                    className={`block h-3 w-3 rounded-full border-2 border-ink transition-transform group-hover:scale-110 motion-reduce:transition-none ${
                      i === at ? "scale-125 bg-ink group-hover:scale-125" : i <= furthest ? "bg-ink-soft" : "bg-transparent"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <div aria-live="polite" data-step-text className={`font-hand ${full ? "text-xl" : "text-lg"} leading-snug`}>
        {askOpen ? (
          <>
            <p className="font-marker">{step.ask!.prompt}</p>
            {/* the answer's dashed line; a wrong key is crossed out on it in red pen (announced by the status line) */}
            <p aria-hidden className="mt-1 flex items-baseline justify-between border-b-2 border-dashed border-ink-faint text-ink-faint">
              <span>?</span>
              {tap.wrong !== null && (
                <span key={tap.wrong} data-wrong-key className="font-marker text-base text-pen motion-safe:animate-[pulse_0.6s_ease-out_1]">
                  ✗ {notLine(tap.wrong)}
                </span>
              )}
            </p>
            {noInput && <p className="mt-1 text-sm text-ink-soft">Tap the keys, or press M to use your computer keys.</p>}
          </>
        ) : (
          <>
            <p>
              {split ? (
                <>
                  {split[0]}
                  <GlossaryChip term={step.term!} onLearn={onLearn}>
                    {split[1]}
                  </GlossaryChip>
                  {split[2]}
                </>
              ) : (
                step.text
              )}
            </p>
            {revealed[at] === "answered" && step.ask && (
              <p className="mt-1 font-marker text-base text-sage-ink">✓ {listOf(step.ask.answer.map(prettyNote))}</p>
            )}
          </>
        )}
      </div>

      {step.prereqLink && onLearn && (
        <button
          type="button"
          onClick={() => onLearn(step.prereqLink!)}
          className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-hand text-sm text-ink-soft hover:border-ink hover:text-ink"
        >
          New to {inSentence(learnName(step.prereqLink))}? Learn that first →
        </button>
      )}

      {full && narrow ? (
        // a phone: one docked block at the bottom, keys (when the step has any) above the nav row
        <div className="sticky bottom-0 z-20 -mx-4 space-y-1.5 border-t-2 border-ink bg-paper-light px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          {keyboard}
          {nav}
        </div>
      ) : (
        <>
          {keyboard}
          {nav}
        </>
      )}

      {at === last && (
        <>
          <section aria-label={ruleLabel} className="pt-1">
            {/* the rule on a mustard wash, like Study's old "Recreate it" note: the one line to take away */}
            <SketchBox seed={seedOf(lesson.conceptId + "rule")} fill={wash.mustard} fillStyle="hachure" className="-rotate-1 motion-reduce:rotate-0">
              <div className="m-1.5 bg-paper-light/80 p-3">
                <h4 className="font-marker text-sm font-bold uppercase tracking-wider">{ruleLabel}</h4>
                <p className="font-hand text-lg leading-snug">{lesson.rule}</p>
              </div>
            </SketchBox>
          </section>
          {(lesson.deeper || deeper) && (
            // a plain section, never a fold: the stepper is the card's second disclosure level and its last
            <section aria-labelledby={deeperId} className="space-y-3" data-go-deeper>
              <h4 id={deeperId} className="font-marker text-sm font-bold uppercase tracking-wider text-ink-soft">
                Go deeper
              </h4>
              {lesson.deeper && <p className="font-hand text-base leading-snug">{lesson.deeper}</p>}
              {deeper}
            </section>
          )}
        </>
      )}

      <p role="status" className="sr-only">
        {status}
      </p>

      {help && <ShortcutsHelp title="Learn shortcuts" shortcuts={COACH_LEARN_SHORTCUTS} qwertyOn={qwertyOn} onClose={() => setHelp(false)} />}
    </div>
  );
}
