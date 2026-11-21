import { chordTones, glossaryEntry, guideTones, learnName, lessonForMove, melodyNoteLabel, prettyNote, prettySymbol, symbol, voiceProgression, type ChordEvent, type ReharmMove } from "@reharm/theory-core";
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { player } from "../audio/player";
import { explainFor, roughRunLine, type ExplainSetting } from "../learn/explainDepth";
import { readLessonFlags, updateLessonFlag } from "../learn/lessonFlags";
import type { OwnProgress } from "../learn/pathStates";
import { countLearning, countOpen } from "../usage/panelOpens";
import { SketchBox, SketchRule } from "../design/rough";
import { CATEGORY_LABEL, CATEGORY_WASH, paper, seedOf, styleLabel, wash } from "../design/tokens";
import { ChordName } from "./ChordName";
import { DeepDive } from "./DeepDive";
import { DoodleKeyboard } from "./DoodleKeyboard";
import { GlossaryChip } from "./learn/GlossaryChip";

interface Props {
  tuneId: string;
  move: ReharmMove;
  /** The chord the move resolves into, from the tune as written: Before and After both land on it. */
  target?: ChordEvent;
  selected: boolean;
  alternatives: ReharmMove[];
  onSelect: () => void;
  onPick: (m: ReharmMove) => void;
  /** Loop this move in Practice Mode. */
  onPractice: () => void;
  /** Open the Comping Coach on this move's voicing. */
  onDrill: () => void;
  /**
   * The lesson's predict-then-reveal asks. App passes false while "Solo over it" (the improv
   * heatmap, which saves what it hears) is open, so lesson keys never reach the note bus then.
   */
  asksEnabled: boolean;
  /** A MIDI keyboard is connected (the lesson drops its "tap the keys, or press M" line). */
  midiConnected?: boolean;
  /** The ⚙ explanations setting: "rule" opens every lesson folded to the rule. */
  explain: ExplainSetting;
  /** This browser's own runs (never the demo's sample): a concept played clean opens folded. */
  own: OwnProgress;
}

/** The lesson stepper and its folder load on the first "Why it works" that needs them. */
const LessonStepper = lazy(() => import("./learn/LessonStepper").then((m) => ({ default: m.LessonStepper })));

/** A voice's motion in words a beginner reads (P6): "holds", "↓ ½ step", "↑ whole step", "↓ 3 half steps". */
const motionWords = (n: number) => {
  if (n === 0) return "holds";
  const a = Math.abs(n);
  return `${n > 0 ? "↑" : "↓"} ${a === 1 ? "½ step" : a === 2 ? "whole step" : `${a} half steps`}`;
};
/** A melody role that is a tension (♭9, ♯11, ♭13…): chipped to the glossary's "tensions". */
const isTension = (role: string) => /(9|11|13)$/.test(role);

function MoveKeyboard({ move }: { move: ReharmMove }) {
  const color = CATEGORY_WASH[move.category];
  if (move.voicingHint) {
    return (
      <DoodleKeyboard
        mode="ascending"
        octaves={3}
        notes={[...move.voicingHint.lh, ...move.voicingHint.rh]}
        accent={move.voicingHint.rh}
        color={color}
      />
    );
  }
  const shown = move.chords[move.chords.length - 1];
  return <DoodleKeyboard notes={chordTones(shown).map((t) => t.note)} accent={guideTones(shown).map((t) => t.note)} color={color} />;
}

/** Seconds per chord in the Before / After audition: long enough to hear each change land. */
const AUDITION_SECONDS = 1.1;
/** Un-presses whichever card's Before / After is sounding (one audition at a time). */
let unpress: (() => void) | null = null;

/**
 * ▶ Before / ▶ After on the card face: the written chords, then the move, each voice-led
 * (theory-core's `voiceProgression`) and played through the player's audition path, so this
 * stays Tone-free. Both halves end on the chord the move resolves into, when there is one.
 */
function BeforeAfter({ move, target }: { move: ReharmMove; target?: ChordEvent }) {
  const [sounding, setSounding] = useState<"before" | "after" | null>(null);
  const mine = useRef(() => setSounding(null)).current;
  // one audition at a time across cards: a new one silences the old one's callbacks, so un-press the old button here
  useEffect(
    () => () => {
      if (unpress === mine) {
        unpress = null;
        player.cancelAudition();
      }
    },
    [mine],
  );
  const play = (half: "before" | "after") => {
    const chords = [...(half === "before" ? move.original : move.chords), ...(target ? [target] : [])];
    if (unpress !== mine) unpress?.();
    unpress = mine;
    setSounding(half);
    void player.playSequence(
      voiceProgression(chords).map((v) => [v.bass, ...v.upper]),
      AUDITION_SECONDS,
      (i) => {
        if (i !== null) return;
        setSounding(null);
        if (unpress === mine) unpress = null;
      },
    );
  };
  const btn = (half: "before" | "after", label: string) => (
    <button
      type="button"
      aria-pressed={sounding === half}
      onClick={() => play(half)}
      title={half === "before" ? "Hear the changes as written" : "Hear the move"}
      className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-sm hover:-rotate-1 ${sounding === half ? "border-ink bg-paper-shade" : "border-ink-soft hover:border-ink"}`}
    >
      <span aria-hidden>▶ </span>
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Hear it" className="mt-2 flex flex-wrap items-center gap-2">
      {btn("before", "Before")}
      {btn("after", "After")}
    </div>
  );
}

function MelodyCheck({ move }: { move: ReharmMove }) {
  return (
    <section aria-label="Melody check" className="flex flex-wrap items-baseline gap-2 text-sm">
      {move.checks.melody.length > 0 && <span className="w-full text-ink-soft">The tune's notes, named against the new chords:</span>}
      {move.checks.melody.map((m, i) => {
        // spelled as the chord spells it (E over G♭9 is its 7th, F♭), the written note as its twin
        const chord = move.chords.find((c) => c.id === m.chordId);
        const role = prettyNote(m.role);
        return (
          <span key={i} data-melody-check className="rounded-full border border-dashed border-ink-soft px-2 py-0.5">
            melody {chord ? melodyNoteLabel(chord, m.note) : prettyNote(m.note)} ={" "}
            {/* a tension (♯11 over G♭9) gets its gloss: a beginner hasn't met it yet */}
            {isTension(m.role) ? <GlossaryChip term="tensions">{role}</GlossaryChip> : role}
            {chord && <span className="text-ink-soft"> of {prettySymbol(symbol(chord))}</span>} ✓
          </span>
        );
      })}
      {!move.checks.melodyVerified && (
        <span className="rounded-full border border-dashed border-wash-brick px-2 py-0.5 text-wash-brick">
          ⚠ no melody entered here, so check it against your lead sheet
        </span>
      )}
    </section>
  );
}

function VoiceLeadingGrid({ move }: { move: ReharmMove }) {
  if (move.voiceLeading.length === 0) return null;
  return (
    <section>
      <h4 className="font-marker text-sm font-bold uppercase tracking-wider text-ink-soft">Voice leading</h4>
      <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3">
        {move.voiceLeading.map((v, i) => (
          <li key={i}>
            {prettyNote(v.from)} → {prettyNote(v.to)} <span className="text-ink-soft">({motionWords(v.semitones)})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Insight({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="border-l-4 pl-3 text-[15px] leading-snug" style={{ borderColor: wash.blue }}>
      💡 {text}
    </p>
  );
}

export function MoveCard({ tuneId, move, target, selected, alternatives, onSelect, onPick, onPractice, onDrill, asksEnabled, midiConnected = false, explain, own }: Props) {
  const color = CATEGORY_WASH[move.category];
  const conceptName = learnName(move.ruleId);
  const bar = move.span.from.bar;
  // Level 2 of the card: the lesson's steps (or, for a rule without a lesson yet, theory, melody
  // check, voice leading, keys, rule, Deep Dive). Closes with the card. It is the last level:
  // nothing inside it folds (an e2e fails at a third aria-expanded level).
  const [why, setWhy] = useState(false);
  useEffect(() => {
    if (!selected) setWhy(false);
  }, [selected]);
  const lesson = useMemo(() => lessonForMove(move), [move]);
  // ▶ Hear's before/after cues: the written chords, then the move, both landing on the target (as the card face's audition)
  const audio = useMemo(
    () => ({ before: [...move.original, ...(target ? [target] : [])], after: [...move.chords, ...(target ? [target] : [])] }),
    [move, target],
  );
  const bodyId = useId();
  const whyId = useId();
  const summaryId = useId();
  const whyBtn = useRef<HTMLButtonElement>(null);
  // the rough run already spent before this opening (read when it opens): a rough run reopens the steps once
  const [spentRough, setSpentRough] = useState<string | undefined>(undefined);
  const depth = lesson ? explainFor(explain, own, lesson.conceptId, { reopenedFor: spentRough }) : null;
  const toggleWhy = () => {
    if (!why) {
      countOpen("study.why"); // the Gate-0 baseline keeps counting
      countLearning("why.open");
      if (lesson) {
        // in a handler, not an effect (StrictMode): mark this rough run as spent, but keep the steps open for this opening
        const before = readLessonFlags()[lesson.conceptId]?.reopenedFor;
        setSpentRough(before);
        const d = explainFor(explain, own, lesson.conceptId, { reopenedFor: before });
        if (d.rough) updateLessonFlag(lesson.conceptId, { reopenedFor: d.rough.at });
      }
    }
    setJustFinished(false);
    setWhy(!why);
  };
  // finished before (a stored flag) or just now: the button carries a ✓, and finishing says what's next
  const [finished, setFinished] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    setFinished(!!lesson && !!readLessonFlags()[lesson.conceptId]?.finishedAt);
  }, [lesson]);
  const doneWithLesson = () => {
    setWhy(false);
    setFinished(true);
    setJustFinished(true);
    whyBtn.current?.focus();
  };

  const whyBody = lesson ? (
    <div id={whyId} className="mt-3 space-y-3">
      <SketchRule seed={seedOf(move.id + "r")} />
      <Suspense fallback={<p className="font-hand text-ink-soft">Opening the steps…</p>}>
        <LessonStepper
          lesson={lesson}
          variant="inline"
          audio={audio}
          asksEnabled={asksEnabled}
          midiConnected={midiConnected}
          ruleLabel="Recreate it"
          folded={!depth!.open}
          // the face's summary above is the lesson headline (move.text comes from the lesson): don't print it twice
          showHeadline={false}
          notice={depth!.rough ? roughRunLine(prettyNote(depth!.rough.keyTonic)) : undefined}
          onFinish={doneWithLesson}
          focusOnOpen
          deeper={
            <>
              <MelodyCheck move={move} />
              <VoiceLeadingGrid move={move} />
              {/* no 💡 insight here: for a lessoned move it IS the lesson's deeper line, already shown */}
              <DeepDive key={tuneId} tuneId={tuneId} move={move} />
            </>
          }
        />
      </Suspense>
    </div>
  ) : (
    // a rule without a lesson yet: today's body, unchanged
    <div id={whyId} className="mt-3 space-y-4">
      <SketchRule seed={seedOf(move.id + "r")} />
      <p className="text-[15px] leading-relaxed">{move.text.theory}</p>

      <MelodyCheck move={move} />
      <VoiceLeadingGrid move={move} />

      <MoveKeyboard move={move} />

      <SketchBox seed={seedOf(move.id + "note")} fill={wash.mustard} fillStyle="hachure" className="-rotate-1">
        <div className="bg-paper-light/80 m-1.5 p-3">
          <h4 className="font-marker text-sm font-bold uppercase tracking-wider">Recreate it</h4>
          <p className="text-[15px] leading-snug">{move.text.recreateRule}</p>
        </div>
      </SketchBox>

      <Insight text={move.text.insight} />

      <DeepDive key={tuneId} tuneId={tuneId} move={move} />
    </div>
  );

  const alsoWorks = alternatives.length > 0 && (
    <section className="mt-3">
      <h4 className="font-marker text-sm font-bold uppercase tracking-wider text-ink-soft">Also works here</h4>
      <div className="mt-1 flex flex-wrap gap-2">
        {alternatives.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a)}
            className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 text-sm hover:bg-paper-shade"
          >
            {a.title} · L{a.level}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <SketchBox seed={seedOf(move.id)} fill={selected ? paper.light : undefined} className="text-ink" roughness={selected ? 1.6 : 1.2}>
      <article className="p-4" data-move-id={move.id}>
        {/* the face: a real h3 holding the select button (a heading inside a button loses its heading role);
            the button's ::after stretches over the whole face, so a click anywhere on it still selects */}
        <div className="relative">
          <header className="flex items-start gap-3">
            <span aria-hidden className="mt-1 inline-block h-4 w-4 shrink-0 rotate-3 rounded-[3px] opacity-80" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              {/* no filter (ink-wobble) on the h3 or the button: a filter makes a containing block and
                  would trap the stretched ::after inside the heading */}
              <h3 className="font-marker text-xl font-bold uppercase leading-tight tracking-wide">
                <button
                  type="button"
                  onClick={onSelect}
                  aria-expanded={selected}
                  aria-controls={selected ? bodyId : undefined}
                  aria-describedby={summaryId}
                  className="cursor-pointer text-left uppercase after:absolute after:inset-0 after:content-['']"
                >
                  <span className="ink-wobble">
                    {move.title} <span className="text-base font-normal normal-case">(Bar {bar})</span>
                  </span>
                </button>
              </h3>
              <p className="text-ink-soft text-xs">
                {CATEGORY_LABEL[move.category]} · L{move.level} · heard in {move.styleTags.map(styleLabel).join(", ")}
              </p>
            </div>
          </header>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg">
            {move.original.map((c) => (
              <ChordName key={c.id} symbol={symbol(c)} className="text-ink-faint line-through decoration-2" />
            ))}
            <span className="font-marker text-ink-soft">→</span>
            {/* the move's chords are decoder chips (first use of each symbol): tap one for what each part
                means. The chip's wrapper is positioned, so it sits above the stretched select button */}
            {move.chords.map((c, i) => {
              const sym = symbol(c);
              const first = move.chords.findIndex((o) => symbol(o) === sym) === i;
              return (
                <span key={c.id} className="flex items-baseline gap-2">
                  {i > 0 && <span className="text-ink-faint">·</span>}
                  {first ? (
                    <GlossaryChip symbol={prettySymbol(sym)}>
                      <ChordName symbol={sym} />
                    </GlossaryChip>
                  ) : (
                    <ChordName symbol={sym} />
                  )}
                </span>
              );
            })}
            {move.targetSymbol && (
              <>
                <span className="font-marker text-ink-soft">→</span>
                <ChordName symbol={move.targetSymbol} className="text-ink-soft" />
              </>
            )}
          </div>

          {/* for a rule with a lesson this is the lesson's headline (theory-core buildMove) */}
          <p id={summaryId} className="mt-2 text-[15px] leading-snug" data-move-summary>
            {move.text.summary}
          </p>
        </div>

        <BeforeAfter move={move} target={target} />

        {selected && (
          <div id={bodyId}>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <button
                type="button"
                onClick={onPractice}
                className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light hover:-rotate-1"
              >
                🎹 Practice this move
              </button>
              <button
                type="button"
                onClick={onDrill}
                className="cursor-pointer rounded-full border-2 border-ink px-4 py-1 font-marker hover:-rotate-1 hover:bg-paper-shade"
                title="The Comping Coach: play the voicing on your keyboard, get red-pen feedback"
              >
                ✍ Drill the voicing
              </button>
              <button
                ref={whyBtn}
                type="button"
                aria-expanded={why}
                aria-controls={why ? whyId : undefined}
                onClick={toggleWhy}
                className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-1 font-marker text-ink-soft hover:border-ink hover:text-ink"
              >
                Why it works
                {lesson && finished && (
                  <>
                    <span aria-hidden className="text-sage-ink"> ✓</span>
                    <span className="sr-only"> (done)</span>
                  </>
                )}
                {/* "Just the rule" opens the folded rule, so no step count on the button */}
                {lesson && explain !== "rule" && <span className="font-hand text-sm"> ({lesson.steps.length} steps)</span>}{" "}
                <span aria-hidden>{why ? "▾" : "▸"}</span>
              </button>
            </div>
            {conceptName.toLowerCase() !== move.title.toLowerCase() && (
              // the move's title is the engine's; the Coach and the Path file it under its concept's name
              <p className="mt-1 text-sm text-ink-soft" data-move-concept>
                In the Coach and on the Path:{" "}
                {glossaryEntry(conceptName) ? <GlossaryChip term={conceptName} /> : <span className="font-marker">{conceptName}</span>}
              </p>
            )}
            {/* one line, in the card's own words: the lesson is done, the hands are next */}
            <p role="status" className={`font-hand text-base text-ink-soft ${justFinished && !why ? "mt-2" : ""}`} data-lesson-done>
              {justFinished && !why ? "Lesson done. Now put it under your hands: 🎹 Practice this move." : ""}
            </p>
            {why && whyBody}
            {alsoWorks}
          </div>
        )}
      </article>
    </SketchBox>
  );
}
