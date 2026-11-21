import { chroma, learnName, prettyNote, readable, type Lesson, type LessonStep } from "@reharm/theory-core";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { SketchBox } from "../../design/rough";
import { seedOf, wash } from "../../design/tokens";
import { useNarrow, useTouchFirst } from "../../device/media";
import { markLessonSeen, updateLessonFlag } from "../../learn/lessonFlags";
import { QWERTY_LABELS, useQwerty } from "../../midi/qwerty";
import { countLearning } from "../../usage/panelOpens";
import { PenKeyboard, type PenMark } from "../practice/PenKeyboard";
import { COACH_LEARN_SHORTCUTS, ShortcutsHelp } from "../Shortcuts";
import { lessonChips } from "./chipText";
import { CHIP_AVOID, OpenLessonContext } from "./GlossaryChip";
import { GlossText } from "./GlossText";
import { KeyCentreMap } from "./KeyCentreMap";
import { placeHighlights, playStep, stepAudioGen, stopStepAudio, type LessonAudioContext } from "./lessonAudio";
import { askIsOpen, pressKey } from "./stepperInput";
import { inRange, inSentence, keyEventOf, keyRange, lettersFor, stepperKey, type StepperAction, type StepperKeyEvent } from "./stepperKeys";
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
  /**
   * Open folded (the explanation depth, `learn/explainDepth.ts`): the headline, the rule,
   * `audition` and "Step by step ›", which opens the steps. Default false.
   */
  folded?: boolean;
  /**
   * Show the headline in the folded view. Default true. Study passes false: since 4a its card face
   * already prints the move's summary, which IS the lesson headline, right above.
   */
  showHeadline?: boolean;
  /** ▶ Before / ▶ After for the folded view. Study leaves it out: its card face already has them. */
  audition?: ReactNode;
  /** One line above the steps, e.g. "A rough run in A♭: the steps are open again." */
  notice?: string;
  /**
   * Move focus into the lesson when it mounts: the step heading (so ← / → work at once), or
   * "Step by step ›" when folded. Only for a mount that a click or key caused (Study's "Why it works").
   */
  focusOnOpen?: boolean;
  /**
   * A step's "New to …? Learn that first →" is stale for a concept the player already knows, or
   * after they chose "Continue anyway": true hides it. Default: always shown.
   */
  prereqKnown?: (conceptId: string) => boolean;
}

/**
 * One lesson, one step per screen (spec §A): the step's text in the hand font, up to 4 lit keys
 * with their labels written on the keys, ▶ Hear, ‹ Back / Next ›. An ask step hides its text and
 * lit keys until the player taps the answer (on-screen keys, computer keys or MIDI) or presses
 * "Show me". Nothing about right or wrong is stored.
 */
export function LessonStepper(props: LessonStepperProps) {
  // a different lesson (or the same concept in another key) starts again at step 1
  return <Depth key={`${props.lesson.conceptId}|${props.lesson.headline}`} {...props} />;
}

/** The rule on a mustard wash, like Study's old "Recreate it" note: the one line to take away. */
function RuleBox({ lesson, label }: { lesson: Lesson; label: string }) {
  return (
    <section aria-label={label} className="pt-1">
      <SketchBox seed={seedOf(lesson.conceptId + "rule")} fill={wash.mustard} fillStyle="hachure" className="-rotate-1 motion-reduce:rotate-0">
        <div className="m-1.5 bg-paper-light/80 p-3">
          <h4 className="font-marker text-sm font-bold uppercase tracking-wider">{label}</h4>
          <p className="font-hand text-lg leading-snug">{lesson.rule}</p>
        </div>
      </SketchBox>
    </section>
  );
}

/**
 * Folded ("Just the rule", or a concept already played clean) or the steps. "Step by step ›"
 * swaps the folded view for the steps in place (not a disclosure: it doesn't fold back), and
 * focus goes to the step heading. The folded view mounts nothing of the stepper, so it neither
 * stamps `seenAt` nor plays a cue.
 */
function Depth(props: LessonStepperProps) {
  const { lesson, folded = false, audition, notice, variant, focusOnOpen = false } = props;
  const [unfolded, setUnfolded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const foldedRoot = useRef<HTMLDivElement>(null);
  const focusSteps = useRef(false);
  useEffect(() => {
    if (!unfolded || !focusSteps.current) return;
    focusSteps.current = false;
    root.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [unfolded]);
  // opened by a click or a key: focus goes into the lesson, so ← / → (or Enter on "Step by step ›") work at once
  useEffect(() => {
    if (!focusOnOpen) return;
    (foldedRoot.current?.querySelector<HTMLElement>("[data-step-by-step]") ?? root.current?.querySelector<HTMLElement>("[data-step-heading]"))?.focus();
    // on mount only: a later fold or unfold moves focus by its own rule
  }, []);

  if (folded && !unfolded) {
    const full = variant === "full";
    return (
      <div ref={foldedRoot} data-lesson-folded={lesson.conceptId} data-variant={variant} className={`text-ink ${full ? "space-y-3" : "space-y-2"}`}>
        {full && <p className="font-marker text-lg font-bold">{learnName(lesson.conceptId)}</p>}
        {props.showHeadline !== false && (
          <p className={`font-hand ${full ? "text-xl" : "text-lg"} leading-snug`} data-lesson-headline>
            {lesson.headline}
          </p>
        )}
        <RuleBox lesson={lesson} label={props.ruleLabel ?? "The rule"} />
        {audition}
        <button
          type="button"
          data-step-by-step
          onClick={() => {
            focusSteps.current = true;
            setUnfolded(true);
          }}
          className="tap-lg cursor-pointer rounded-full border-2 border-ink-soft px-3 py-0.5 font-marker text-sm hover:border-ink"
        >
          Step by step ›
        </button>
      </div>
    );
  }
  return (
    <div ref={root} className={variant === "full" ? "space-y-3" : "space-y-2"}>
      {notice && (
        <p role="status" className="font-hand text-base text-ink-soft" data-explain-notice>
          {notice}
        </p>
      )}
      {/* chips in this lesson don't offer "Learn it →" back into it */}
      <OpenLessonContext.Provider value={props.lesson.conceptId}>
        <Stepper {...props} />
      </OpenLessonContext.Provider>
    </div>
  );
}

type Reveal = "answered" | "shown";
const PULSE_MS = 1200;
/** The widest one-range-per-lesson keyboard, in semitones: about an octave and a half on a phone, two and a half octaves wide. */
const MAX_SPAN_NARROW = 20;
const MAX_SPAN_WIDE = 31;
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** An answer key as the lesson text prints it: answers stay engine-spelled for matching, but B♭♭ reads A. */
const answerName =(n: string) => prettyNote(readable(n));

/**
 * A wrong key, with a reason when the step itself names that note: "Not F, the 7th: close, not this
 * one." A plausible miss (a real chord tone, just not the asked one) then reads as close, not as the
 * app being wrong (P6 beginner review). Otherwise plain "Not F". Pure.
 */
function wrongLine(step: LessonStep, pc: number): string {
  const placed = placeHighlights(step.highlight);
  const i = placed.findIndex((m) => ((m % 12) + 12) % 12 === pc);
  // a two-line label is chord over role ("ii\n7th"): "the ii 7th"
  const lines = i >= 0 ? step.highlight[i].label.split("\n") : [""];
  const label = lines[lines.length - 1];
  // only a chord role ("7th", "♭9", "root") says why; a note name or "new"/"home" would just repeat the key
  const role = /^(?:[♭♯]?\d+(?:st|nd|rd|th)?|root)$/.test(label);
  return role ? `${notLine(pc)}, the ${lines.length > 1 ? `${lines[0]} ` : ""}${label}: close, not this one.` : notLine(pc);
}

/** The marks a step puts on the keyboard. Pure. */
function keyMarks(step: LessonStep, low: number, high: number, askOpen: boolean, hits: number[], wrong: number | null) {
  const placed = placeHighlights(step.highlight);
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
      return [{ midi: at, label: labelOf.get(pc) ?? (spelled ? answerName(spelled) : "") }];
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
  prereqKnown,
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
  const touchFirst = useTouchFirst();
  const deeperId = useId();
  const qwerty = useQwerty();
  const qwertyOn = qwerty.enabled;
  const heading = useRef<HTMLHeadingElement>(null);
  const showMe = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[at];
  const askOpen = askIsOpen(step, asksEnabled, revealed[at]);

  // seen on open: `markLessonSeen` is the store's effect-safe write (only the first open stamps it)
  useEffect(() => markLessonSeen(lesson.conceptId), [lesson.conceptId]);

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

  // closing the card or leaving the stage silences the step's cue. Deferred a tick: StrictMode's
  // pretend unmount remounts at once and cancels it, so step 1's auto-play isn't cut off in dev
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    return () => {
      // only this stepper's last cue: a stepper mounting in its place may already have started its own
      const gen = stepAudioGen();
      stopTimer.current = setTimeout(() => stopStepAudio(gen), 0);
    };
  }, []);

  // a phone's docked block (keys + nav) sits on the viewport's bottom edge: the step's heading and
  // text must sit above it, never under it (spec §A, U6). Scroll only as far as needed.
  const textRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const docked = variant === "full" && narrow;
  const clearDock = () => {
    if (!docked || !textRef.current || !dockRef.current || !heading.current) return;
    const dockTop = dockRef.current.getBoundingClientRect().top;
    const textBottom = textRef.current.getBoundingClientRect().bottom;
    const headTop = heading.current.getBoundingClientRect().top;
    const over = textBottom + 8 - dockTop;
    if (over <= 0 && headTop >= 0) return;
    // never scroll the heading off the top: show the heading first if both can't fit
    window.scrollBy({ top: headTop < 0 ? headTop - 8 : Math.min(over, Math.max(0, headTop - 8)) });
  };
  // on open (Coach mounts the stepper on the Learn stage) and after every step change or reveal
  useEffect(() => {
    clearDock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, revealed, docked]);

  // focus follows Next/Back (not the first render: opening a card shouldn't steal focus)
  useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    // the dock decides the scroll (above), not the browser's focus scroll, which can land the heading under it
    heading.current?.focus(docked ? { preventScroll: true } : undefined);
  }, [at, revealed]);

  const reveal = (how: Reveal) => {
    setRevealed((r) => (r[at] ? r : { ...r, [at]: how }));
    setPulsed(false);
    // a wrong key's "Not G" is over once the answer is out: the status says the answer instead
    if (step.ask) setStatus(how === "answered" ? `✓ ${listOf(step.ask.answer.map(answerName))}` : `The answer: ${listOf(step.ask.answer.map(answerName))}`);
    // the Show me button goes away with the ask: keep focus on the step
    focusAfter.current = true;
  };

  const tap = useTapAnswer(step.ask?.answer, askOpen, () => reveal("answered"), at);
  // the ghost key fades after a moment; the red-pen line (with its reason) stays until the next key or step
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  useEffect(() => {
    if (tap.wrong === null) return;
    setLastWrong(tap.wrong);
    setStatus(wrongLine(step, tap.wrong));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tap.wrong]);
  useEffect(() => setLastWrong(null), [tap.hits.length]);

  const go = (i: number) => {
    if (i < 0 || i > last || i === at) return;
    setLastWrong(null);
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
      // a tablist's arrows (tabKeys.ts) or a popover already used this key
      if (e.defaultPrevented) return;
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
  // one range for the whole lesson, so a key stays put from step to step (the M1 rule within a step,
  // now across steps); a lesson spread too wide for the screen falls back to each step's own range
  const lessonRange = useMemo(() => {
    const r = keyRange(steps.flatMap((s) => placeHighlights(s.highlight)), narrow ? 12 : 24);
    return r.high - r.low <= (narrow ? MAX_SPAN_NARROW : MAX_SPAN_WIDE) ? r : null;
  }, [steps, narrow]);
  const { low, high } = lessonRange ?? keyRange(placeHighlights(step.highlight), narrow ? 12 : 24);
  const { lit, ghost } = keyMarks(step, low, high, askOpen, tap.hits, tap.wrong);

  const name = learnName(lesson.conceptId);
  const nextLabel = at === last ? (finishLabel ?? (variant === "full" ? "Study it ›" : "Done")) : "Next ›";
  // chips: each step's term (as the text writes it, term or alias), the numerals and chord symbols, first use in the lesson
  const chips = useMemo(() => lessonChips(lesson), [lesson]);
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
            className="cursor-pointer px-1 font-marker text-sm text-ink-soft underline decoration-dashed underline-offset-4 hover:text-ink motion-reduce:animate-none pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
    // a glossary note opens above its chip rather than over the lit keys
    <div role="group" aria-label={askOpen ? "Keyboard: tap the answer" : "Keyboard"} {...CHIP_AVOID}>
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
        // computer keys on: each key shows its letter (A = C …), so nobody has to guess which letter is E
        keyLetters={qwerty.enabled ? lettersFor(QWERTY_LABELS, qwerty.base, low, high) : []}
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
                  className="group grid cursor-pointer place-items-center p-[3px] pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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

      <div ref={textRef} aria-live="polite" data-step-text className={`font-hand ${full ? "text-xl" : "text-lg"} leading-snug`}>
        {askOpen ? (
          <>
            <p className="font-marker">{step.ask!.prompt}</p>
            {/* the answer's dashed line; a wrong key is crossed out on it in red pen (announced by the status line) */}
            <p aria-hidden className="mt-1 flex items-baseline justify-between border-b-2 border-dashed border-ink-faint text-ink-faint">
              <span>?</span>
              {lastWrong !== null && (
                <span key={lastWrong} data-wrong-key className="font-marker text-base text-pen motion-safe:animate-[pulse_0.6s_ease-out_1]">
                  ✗ {wrongLine(step, lastWrong)}
                </span>
              )}
            </p>
            {noInput && (
              <p className="mt-1 text-sm text-ink-soft" data-input-hint>
                {touchFirst ? "Tap the keys." : "Tap the keys, or press M to use your computer keys."}
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              <GlossText segments={chips.steps[at]} onLearn={onLearn} />
            </p>
            {step.map && <KeyCentreMap centres={step.map} />}
            {revealed[at] === "answered" && step.ask && (
              <p className="mt-1 font-marker text-base text-sage-ink">✓ {listOf(step.ask.answer.map(answerName))}</p>
            )}
          </>
        )}
      </div>

      {step.prereqLink && onLearn && !prereqKnown?.(step.prereqLink) && (
        <button
          type="button"
          onClick={() => onLearn(step.prereqLink!)}
          className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-hand text-sm text-ink-soft hover:border-ink hover:text-ink"
        >
          New to {inSentence(learnName(step.prereqLink))}? Learn that first →
        </button>
      )}

      {docked ? (
        // a phone: one docked block at the bottom, keys (when the step has any) above the nav row
        <div ref={dockRef} data-lesson-dock className="sticky bottom-0 z-20 -mx-4 space-y-1.5 border-t-2 border-ink bg-paper-light px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          {keyboard}
          {nav}
        </div>
      ) : (
        <>
          {keyboard}
          {/* on the last step the payoff (the rule, Go deeper) comes before the finishing press */}
          {at !== last && nav}
        </>
      )}

      {at === last && (
        <>
          <RuleBox lesson={lesson} label={ruleLabel} />
          {(lesson.deeper || deeper) && (
            // a plain section, never a fold: the stepper is the card's second disclosure level and its last
            <section aria-labelledby={deeperId} className="space-y-3" data-go-deeper>
              <h4 id={deeperId} className="font-marker text-sm font-bold uppercase tracking-wider text-ink-soft">
                Go deeper
              </h4>
              {lesson.deeper && (
                <p className="font-hand text-base leading-snug">
                  <GlossText segments={chips.deeper} onLearn={onLearn} />
                </p>
              )}
              {deeper}
            </section>
          )}
          {!docked && nav}
        </>
      )}

      <p role="status" className="sr-only">
        {status}
      </p>

      {help && <ShortcutsHelp title="Learn shortcuts" shortcuts={COACH_LEARN_SHORTCUTS} qwertyOn={qwertyOn} onClose={() => setHelp(false)} />}
    </div>
  );
}
