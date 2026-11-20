import { lessonForMove } from "./learn/ruleLesson";
import { RULES } from "./ruleset";
import type { ReharmMove } from "./types";

/**
 * The engine's own Deep Dive, for when no written one exists: the demo file built with
 * `--template`, the demo's fallback, and the API's answer after two failed validations.
 *
 * A move with a lesson already shows its steps (that is `move.text.theory`), so its template
 * never repeats them: the deeper fact, where else the move works and the bandstand cue. A move
 * without a lesson keeps its hand-written theory and insight.
 */
export function templateDeepDive(move: ReharmMove): string {
  if (!lessonForMove(move)) return [move.text.theory, move.text.insight].filter(Boolean).join("\n\n");
  const p = RULES.find((r) => r.id === move.ruleId)?.pedagogy;
  return [move.text.insight, p && `Where else: ${p.whenToUse}`, p && `On the bandstand: ${p.bandstandCue}`].filter(Boolean).join("\n\n");
}
