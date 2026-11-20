import { anyLesson, glossaryEntry, inSentence, learnName, prereqSummary } from "@reharm/theory-core";
import { GlossText } from "./GlossText";
import { useEffect, useRef } from "react";
import { updateLessonFlag } from "../../learn/lessonFlags";
import { countLearning } from "../../usage/panelOpens";

interface Props {
  conceptId: string;
  /** The key the lessons would be in (engine spelling, "Bb"): the step count is per key. */
  tonic: string;
  /** Only these prerequisites (the unmet ones, `ConceptStatus.recommendedFirst`); default every hard one. */
  only?: readonly string[];
  /** The whole unmet chain (`unmetChain`), so a cold start's count covers every lesson in it. */
  chain?: readonly string[];
  /** "Learn that first": open this prerequisite's lesson (the caller follows it down the chain). */
  onLearnFirst: (prereqId: string) => void;
  /** "Continue anyway": after the flag is set, the caller hides the note. */
  onContinue?: () => void;
  /**
   * "Just the rule" (spec decision 6): one line above the folded lesson, "Builds on the tritone ·
   * Learn it →", that blocks nothing and counts nothing (an expert's skips aren't 3f's signal).
   */
  compact?: boolean;
  /** Focus "Learn that first" on mount (the player was routed here: a return trip, a Path card). */
  autoFocus?: boolean;
}

/**
 * The soft lock (spec §B): one red-pen line above step 1, never a modal. "This builds on guide
 * tones (3 steps)." with "Learn that first" (primary) and "Continue anyway", which sets
 * `continuedAnyway` so the note is gone for that concept for good. Renders nothing when there
 * is nothing to say. Counts `prereq.view` once per mount and `prereq.continueAnyway` on the click
 * (never in the compact line).
 */
export function PrereqNote({ conceptId, tonic, only, chain, onLearnFirst, onContinue, compact = false, autoFocus = false }: Props) {
  const summary = prereqSummary(conceptId, tonic, { only, chain, lessonFor: anyLesson });
  const shown = !!summary && !compact;
  // a ref survives StrictMode's second effect run, so one view counts once
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!shown || counted.current === conceptId) return;
    counted.current = conceptId;
    countLearning("prereq.view");
  }, [shown, conceptId]);

  if (!summary) return null;
  const first = summary.prereqs[0];
  if (compact) {
    return (
      <p role="note" aria-label="Builds on" className="font-hand text-base text-pen" data-prereq-compact>
        Builds on {summary.prereqs.map((p) => inSentence(learnName(p.id))).join(" and ")} ·{" "}
        <button
          type="button"
          onClick={() => onLearnFirst(first.id)}
          className="cursor-pointer font-marker text-sm text-pen underline-offset-2 hover:underline pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        >
          Learn it →
        </button>
      </p>
    );
  }
  return (
    <div role="note" aria-label="Builds on" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-hand text-pen">
      {/* a prerequisite named by a glossary term ("secondary dominant") is chipped where it gates */}
      <span className="text-base">
        <GlossText text={summary.sentence} terms={summary.prereqs.map((p) => p.name).filter((n) => glossaryEntry(n))} onLearn={onLearnFirst} />
      </span>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          // only when the player's own click routed them here
          autoFocus={autoFocus}
          onClick={() => onLearnFirst(first.id)}
          className="cursor-pointer rounded-full border-2 border-pen px-3 pointer-coarse:min-h-11 py-0.5 font-marker text-sm text-pen hover:-rotate-1 hover:bg-paper-shade"
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
          className="cursor-pointer font-marker text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        >
          Continue anyway
        </button>
      </span>
    </div>
  );
}
