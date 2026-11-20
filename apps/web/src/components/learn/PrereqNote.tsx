import { anyLesson, prereqSummary } from "@reharm/theory-core";
import { useEffect, useRef } from "react";
import { updateLessonFlag } from "../../learn/lessonFlags";
import { countLearning } from "../../usage/panelOpens";

interface Props {
  conceptId: string;
  /** The key the lessons would be in (engine spelling, "Bb"): the step count is per key. */
  tonic: string;
  /** Only these prerequisites (the unmet ones, `ConceptStatus.recommendedFirst`); default every hard one. */
  only?: readonly string[];
  /** "Learn that first": open this prerequisite's lesson. */
  onLearnFirst: (prereqId: string) => void;
  /** "Continue anyway": after the flag is set, the caller hides the note. */
  onContinue?: () => void;
}

/**
 * The soft lock (spec §B): one red-pen line above step 1, never a modal. "This builds on guide
 * tones (3 steps)." with "Learn that first" (primary) and "Continue anyway", which sets
 * `continuedAnyway` so the note is gone for that concept for good. Renders nothing when there
 * is nothing to say. Counts `prereq.view` once per mount and `prereq.continueAnyway` on the click.
 */
export function PrereqNote({ conceptId, tonic, only, onLearnFirst, onContinue }: Props) {
  const summary = prereqSummary(conceptId, tonic, { only, lessonFor: anyLesson });
  const shown = !!summary;
  // a ref survives StrictMode's second effect run, so one view counts once
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!shown || counted.current === conceptId) return;
    counted.current = conceptId;
    countLearning("prereq.view");
  }, [shown, conceptId]);

  if (!summary) return null;
  const first = summary.prereqs[0];
  return (
    <div role="note" aria-label="Builds on" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-hand text-pen">
      <span className="text-base">{summary.sentence}</span>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onLearnFirst(first.id)}
          className="cursor-pointer rounded-full border-2 border-pen px-3 py-0.5 font-marker text-sm text-pen hover:-rotate-1 hover:bg-paper-shade"
        >
          Learn that first
        </button>
        <button
          type="button"
          onClick={() => {
            updateLessonFlag(conceptId, { continuedAnyway: true });
            countLearning("prereq.continueAnyway");
            onContinue?.();
          }}
          className="cursor-pointer font-marker text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          Continue anyway
        </button>
      </span>
    </div>
  );
}
