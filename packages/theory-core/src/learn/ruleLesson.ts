import { chroma } from "../pitch";
import type { Lesson } from "./lesson";
import { RULE_LESSONS } from "./lessons/rules";

// Barrel-free on purpose: `learn/canonical.ts` (which imports the engine) reads lessons from here,
// so nothing on the engine's side ever has to import `learn/index`.

/** One key lit once: a later highlight of the same key (another spelling, too) is dropped. */
export function tidyLesson(l: Lesson): Lesson {
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
