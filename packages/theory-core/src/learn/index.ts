import { chroma } from "../pitch";
import type { BasicsId } from "./graph";
import type { Lesson } from "./lesson";
import { BASICS_LESSONS } from "./lessons/basics";
import { RULE_LESSONS } from "./lessons/rules";

export * from "./facts";
export * from "./graph";
export * from "./glossary";
export type { Highlight, Lesson, LessonStep, PlayCue } from "./lesson";

/** One key lit once: a later highlight of the same key (another spelling, too) is dropped. */
function tidyLesson(l: Lesson): Lesson {
  return {
    ...l,
    steps: l.steps.map((s) => {
      const seen = new Set<number>();
      return { ...s, highlight: s.highlight.filter((h) => !seen.has(chroma(h.note)) && !!seen.add(chroma(h.note))) };
    }),
  };
}

export type RuleLessonId = keyof typeof RULE_LESSONS;
export const hasRuleLesson = (ruleId: string): ruleId is RuleLessonId => ruleId in RULE_LESSONS;

/** The lesson for a move, from its rule's `facts.learn`; null for rules without a lesson yet. */
export function lessonForMove(move: { ruleId: string; facts: Record<string, unknown> }): Lesson | null {
  if (!hasRuleLesson(move.ruleId) || !move.facts.learn) return null;
  const build = RULE_LESSONS[move.ruleId] as (f: unknown) => Lesson;
  return tidyLesson(build(move.facts.learn));
}

export const hasBasicsLesson = (id: string): id is BasicsId => id in BASICS_LESSONS;

/** A foundation lesson in any key (`tonic` in engine spelling, e.g. "Bb"); null if it has none yet. */
export function basicsLesson(id: string, tonic: string): Lesson | null {
  const build = hasBasicsLesson(id) ? BASICS_LESSONS[id] : undefined;
  return build ? tidyLesson(build(tonic)) : null;
}
