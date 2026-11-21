import { learnName, prettyNote, voiceProgression, type ChordLike, type ConceptStatus, type LessonFlag } from "@reharm/theory-core";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { player } from "../../audio/player";
import { explainFor, roughRunLine, useExplainSetting } from "../../learn/explainDepth";
import { readLessonFlags, updateLessonFlag } from "../../learn/lessonFlags";
import type { OwnProgress } from "../../learn/pathStates";
import type { CoachLesson } from "./coachLesson";

/*
 * GRADER ISOLATION (CLAUDE.md §0, PLAN safety rule 3). Coach's Learn stage renders this INSTEAD
 * of the drill: no chord-strike grouper, no drill session, nothing that grades or saves is
 * mounted while it shows. The stepper is its own note-bus subscriber and never strikes a drill.
 * `learnStageIsolation.test.ts` holds this file to that.
 */

const LessonStepper = lazy(() => import("../learn/LessonStepper").then((m) => ({ default: m.LessonStepper })));
const PrereqNote = lazy(() => import("../learn/PrereqNote").then((m) => ({ default: m.PrereqNote })));

interface Props {
  conceptId: string;
  data: CoachLesson;
  /** The drill's key, engine spelling: the prerequisite step counts are per key. */
  tonic: string;
  status: ConceptStatus | undefined;
  flag: LessonFlag | undefined;
  own: OwnProgress;
  /** The stage ladder, above the lesson. */
  ladder: ReactNode;
  /** The return banner ("from Tritone sub"), folded into the stepper header. */
  from?: string;
  finishLabel: string;
  onFinish: () => void;
  /** "Learn that first", a step's "Learn that first →" and a glossary chip's "Learn it →". */
  onLearn: (conceptId: string) => void;
  midiConnected: boolean;
  /** Move focus to the step heading on open (a stage change or a click caused it). */
  focus: boolean;
  /** Under the lesson: a basic's practice link, the "lesson done" line. */
  footer?: ReactNode;
  /** Everything this concept still builds on, deepest first (`unmetChain`): the note's count covers it all. */
  chain?: readonly string[];
  /** A concept the player already knows (Familiar or better): its "New to …? Learn that first →" link is stale. */
  prereqKnown: (conceptId: string) => boolean;
  /** "Your chart writes F6; F6 and Fmaj7 are both the I chord here." (`sixChordNote`), under the lesson. */
  chartNote?: string | null;
}

/** ▶ Before / ▶ After for the folded lesson ("Just the rule"), voice-led and played through the player's audition. */
function Audition({ before, after }: { before: ChordLike[]; after: ChordLike[] }) {
  const play = (chords: ChordLike[]) => void player.playSequence(voiceProgression(chords).map((v) => [v.bass, ...v.upper]), 1.1);
  useEffect(() => () => player.cancelAudition(), []);
  const btn = "tap-lg cursor-pointer rounded-full border-2 border-ink-soft px-3 py-0.5 font-marker text-sm hover:border-ink";
  return (
    <div role="group" aria-label="Hear it" className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => play(before)} className={btn}>
        <span aria-hidden>▶ </span>Before
      </button>
      <button type="button" onClick={() => play(after)} className={btn}>
        <span aria-hidden>▶ </span>After
      </button>
    </div>
  );
}

/**
 * Stage 1 of the Coach ladder (spec §A): the full-variant `LessonStepper` for the concept, or,
 * while the concept is "Recommended first", the `PrereqNote` above the lesson's headline ("Learn
 * that first" / "Continue anyway"). One routing line at a time: the note, else the return banner
 * in the stepper header. The ⚙ explanations setting (and fading) can open the lesson folded.
 */
export function LearnStage({ conceptId, data, tonic, status, flag, own, ladder, from, finishLabel, onFinish, onLearn, midiConnected, focus, footer, chain, prereqKnown, chartNote }: Props) {
  const { lesson, audio } = data;
  const explain = useExplainSetting();
  // the rough run already spent when this lesson opened: a rough latest run reopens the steps once (spec §D), as in Study
  const [spentRough] = useState(() => flag?.reopenedFor);
  const depth = explainFor(explain, own, conceptId, { ...flag, reopenedFor: spentRough });
  const roughAt = depth.rough?.at;
  useEffect(() => {
    // mark this rough run as spent; the steps stay open for this opening (`spentRough` is fixed at mount).
    // Idempotent (the same ISO both times), so StrictMode's second run writes nothing new.
    if (roughAt && readLessonFlags()[conceptId]?.reopenedFor !== roughAt) updateLessonFlag(conceptId, { reopenedFor: roughAt });
  }, [conceptId, roughAt]);
  // "Continue anyway" sets the flag (the state follows); this hides the note at once and focuses step 1
  const [continued, setContinued] = useState(false);
  const noteFor = !continued && status?.state === "recommendedFirst" && status.recommendedFirst.length ? status.recommendedFirst : null;
  // "Just the rule": the note is one line above the folded lesson, never in its way (decision 6)
  const compactNote = explain === "rule";

  return (
    <div className="space-y-4" data-coach-learn={conceptId}>
      {ladder}
      <Suspense fallback={<p className="font-hand text-ink-soft">Opening the lesson…</p>}>
        {noteFor && !compactNote ? (
          <section aria-label={`${learnName(conceptId)}: before you start`} className="space-y-3">
            <p className="font-marker text-lg font-bold">{learnName(conceptId)}</p>
            <PrereqNote conceptId={conceptId} tonic={tonic} only={noteFor} chain={chain} onLearnFirst={onLearn} onContinue={() => setContinued(true)} autoFocus={focus} />
            <p className="font-hand text-xl leading-snug" data-lesson-headline>
              {lesson.headline}
            </p>
          </section>
        ) : (
          <>
          {noteFor && <PrereqNote conceptId={conceptId} tonic={tonic} only={noteFor} onLearnFirst={onLearn} compact />}
          <LessonStepper
            lesson={lesson}
            variant="full"
            audio={audio}
            from={from}
            finishLabel={finishLabel}
            onFinish={onFinish}
            onLearn={onLearn}
            midiConnected={midiConnected}
            folded={!depth.open}
            notice={depth.rough ? roughRunLine(prettyNote(depth.rough.keyTonic)) : undefined}
            audition={audio && <Audition before={audio.before} after={audio.after} />}
            focusOnOpen={focus || continued}
            prereqKnown={(id) => !!flag?.continuedAnyway || continued || prereqKnown(id)}
          />
          </>
        )}
      </Suspense>
      {chartNote && (
        <p className="font-hand text-base text-ink-soft" data-chart-note>
          {chartNote}
        </p>
      )}
      {footer}
    </div>
  );
}
