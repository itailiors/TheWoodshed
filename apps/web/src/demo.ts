import type { ReharmMove } from "@reharm/theory-core";

/**
 * Read-only demo build (`vite build --mode demo`): no library, no API calls.
 * The demo tune is the bundled reference tune, and Deep Dives come from the
 * pre-generated file the API's demo mode also serves.
 */
export const DEMO = import.meta.env.VITE_DEMO_MODE === "true";

export interface Explanation {
  summary: string;
  deepDive: string;
  recreateRule: string;
  model: string;
  cached: boolean;
}

let file: Promise<{ tuneId: string; explanations: Record<string, Omit<Explanation, "cached">> }> | null = null;

/**
 * Lazy-loaded, so normal builds don't carry the demo text in the main bundle.
 * The pre-written text belongs to one tune in one key. A transposed id (`base@Key`) names
 * other notes, and another tune's move can share an id (ids are positional), so both get the
 * engine's own explanation instead.
 */
export async function demoExplanation(tuneId: string, move: ReharmMove): Promise<Explanation> {
  file ??= import("../../api/demo/explanations.json") as Promise<{ tuneId: string; explanations: Record<string, Omit<Explanation, "cached">> }>;
  const f = await file;
  const hit = tuneId === f.tuneId ? f.explanations[move.id] : undefined;
  return (
    (hit && { ...hit, cached: true }) ?? {
      summary: move.text.summary,
      deepDive: [move.text.theory, move.text.insight].filter(Boolean).join("\n\n"),
      recreateRule: move.text.recreateRule,
      model: "Reharm Lab engine",
      cached: true,
    }
  );
}
