import type { LessonStage } from "@reharm/theory-core";
import type { ReactNode } from "react";
import { pen } from "../../design/tokens";

const LABEL: Record<LessonStage, string> = { learn: "Learn", study: "Study it", self: "Self-check", play: "Play it" };
const TITLE: Record<LessonStage, string> = {
  learn: "The move, one step at a time: hear it, see it on the keys, name it, then the rule. Nothing is graded",
  study: "See each chord on the keys and how to play it, chord by chord. Nothing is graded",
  self: "Your first saved run, with support: at an acoustic piano, reveal the voicing and grade yourself",
  play: "The engine hears what you play (MIDI, computer keys or the keys below) and marks it up. Saved and scheduled",
};

/** A stage's name on the ladder. Self-check with keys the engine hears is listen mode with the hint on. */
export const stageLabel = (s: LessonStage, withHint = false) => (s === "self" && withHint ? "Self-check: with hint" : LABEL[s]);

/**
 * Learn · Study it · Self-check · Play it (spec §A), the house ladder idiom of the Changes game.
 * Every pill is always clickable (nothing locks). The current stage is circled in red pen and
 * carries `aria-current="step"`; finished stages get a mustard wash. `extra` sits at the end (a
 * basic's "practise it elsewhere" link).
 */
export function StageLadder({
  stages,
  stage,
  onStage,
  finished,
  selfWithHint,
  extra,
}: {
  stages: readonly LessonStage[];
  stage: LessonStage;
  onStage: (s: LessonStage) => void;
  finished: ReadonlySet<LessonStage>;
  selfWithHint: boolean;
  extra?: ReactNode;
}) {
  if (stages.length === 0) return null;
  return (
    <nav aria-label="Stages" className="-mx-1 overflow-x-auto px-1 pb-1">
      {/* a phone scrolls the pills sideways; wider screens wrap them (the centre column can be narrow) */}
      <ol className="flex w-max items-center gap-1.5 gap-y-1 font-marker text-sm md:w-auto md:flex-wrap">
        {stages.map((s, i) => {
          const on = s === stage;
          return (
            <li key={s} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-ink-faint">
                  →
                </span>
              )}
              <button
                type="button"
                aria-current={on ? "step" : undefined}
                title={TITLE[s]}
                data-stage={s}
                onClick={() => onStage(s)}
                style={on ? { borderColor: pen.red, boxShadow: `0 0 0 1.5px ${pen.red}` } : undefined}
                className={`tap-lg cursor-pointer whitespace-nowrap rounded-full border-2 px-3 py-0.5 hover:-rotate-1 motion-reduce:hover:rotate-0 ${
                  on ? "bg-paper-light font-bold text-ink" : finished.has(s) ? "border-ink bg-wash-mustard/40 text-ink" : "border-ink-soft text-ink hover:border-ink"
                }`}
              >
                {stageLabel(s, selfWithHint)}
                {finished.has(s) && !on && <span className="sr-only"> (done)</span>}
              </button>
            </li>
          );
        })}
        {extra && <li className="ml-1.5">{extra}</li>}
      </ol>
    </nav>
  );
}
