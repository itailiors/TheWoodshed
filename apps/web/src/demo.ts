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

let file: Promise<{ explanations: Record<string, Omit<Explanation, "cached">> }> | null = null;

/** Lazy-loaded, so normal builds don't carry the demo text in the main bundle. */
export async function demoExplanation(move: ReharmMove): Promise<Explanation> {
  file ??= import("../../api/demo/explanations.json") as Promise<{ explanations: Record<string, Omit<Explanation, "cached">> }>;
  const hit = (await file).explanations[move.id];
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
