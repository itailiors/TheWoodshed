import { conceptNode, learnName, type BasicsId } from "./graph";
import type { Lesson } from "./lesson";
import { BASICS_LESSONS } from "./lessons/basics";
import { tidyLesson } from "./ruleLesson";

export * from "./facts";
export * from "./graph";
export * from "./glossary";
export type { Highlight, Lesson, LessonStep, PlayCue } from "./lesson";
// canonical.ts (rule lessons in any key) imports the engine, so it stays off this barrel: the package root exports it
export { hasRuleLesson, lessonForMove, type RuleLessonId } from "./ruleLesson";

export const hasBasicsLesson = (id: string): id is BasicsId => id in BASICS_LESSONS;

/** A foundation lesson in any key (`tonic` in engine spelling, e.g. "Bb"); null if it has none yet. */
export function basicsLesson(id: string, tonic: string): Lesson | null {
  const build = hasBasicsLesson(id) ? BASICS_LESSONS[id] : undefined;
  return build ? tidyLesson(build(tonic)) : null;
}

export interface PrereqSummary {
  /** The prerequisites summarised, in graph order. */
  prereqs: { id: string; name: string; steps: number }[];
  /** Total lesson steps across them (0 for a prerequisite with no lesson yet). */
  steps: number;
  /** The PrereqNote line, e.g. "This builds on the tritone and dominant resolution (7 steps)."; no count while a prerequisite lacks a lesson. */
  sentence: string;
}

export interface PrereqSummaryOptions {
  /** Summarise only these (e.g. `ConceptStatus.recommendedFirst`, the unmet ones); default every hard prerequisite. */
  only?: readonly string[];
  /** A prerequisite's lesson in a key. Default: basics lessons only; Coach passes one that also knows rule lessons. */
  lessonFor?: (id: string, tonic: string) => Lesson | null;
}

/** "The tritone" → "the tritone"; keeps a leading proper noun ("Coltrane") or numeral ("♭VI–♭VII–I"). */
const inSentence = (name: string) => (/^[A-Z][a-z]/.test(name) && !/^Coltrane\b/.test(name) ? name[0].toLowerCase() + name.slice(1) : name);
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * What a concept's hard prerequisites add up to, for the soft-lock note: their names and the
 * sum of their lessons' steps in `tonic`. Null when there is nothing to summarise.
 */
export function prereqSummary(conceptId: string, tonic: string, opts: PrereqSummaryOptions = {}): PrereqSummary | null {
  const node = conceptNode(conceptId);
  if (!node) return null;
  const ids = opts.only ? node.hard.filter((h) => opts.only!.includes(h)) : node.hard;
  if (!ids.length) return null;
  const lessonFor = opts.lessonFor ?? basicsLesson;
  const prereqs = ids.map((id) => ({ id, name: learnName(id), steps: lessonFor(id, tonic)?.steps.length ?? 0 }));
  const steps = prereqs.reduce((n, p) => n + p.steps, 0);
  // a partial count would undersell the work, so the line names a count only when every prerequisite has a lesson
  const count = prereqs.every((p) => p.steps > 0) ? ` (${steps} step${steps === 1 ? "" : "s"})` : "";
  return { prereqs, steps, sentence: `This builds on ${listOf(prereqs.map((p) => inSentence(p.name)))}${count}.` };
}
