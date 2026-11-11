import type { ReharmMove } from "@reharm/theory-core";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read-only demo: Deep Dives come from a pre-generated JSON file, never from the Anthropic API.
 * Regenerate with `npm run demo:generate -w @reharm/api` (uses your key once, offline from visitors).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const DEMO_EXPLANATIONS_FILE = path.join(here, "..", "demo", "explanations.json");

export interface DemoExplanation {
  summary: string;
  deepDive: string;
  recreateRule: string;
  model: string;
}

export interface DemoExplanationFile {
  version: 1;
  tuneId: string;
  generatedAt: string;
  /** "claude" when written by the model, "template" when built from the engine's own text. */
  source: "claude" | "template";
  explanations: Record<string, DemoExplanation>;
}

export function loadDemoExplanations(file = DEMO_EXPLANATIONS_FILE): DemoExplanationFile | null {
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as DemoExplanationFile;
    return data.version === 1 && data.explanations ? data : null;
  } catch {
    console.warn(`[demo] couldn't read ${file}; falling back to engine text`);
    return null;
  }
}

/** The engine's deterministic text in the Deep Dive shape. Always available, costs nothing. */
export function templateExplanation(move: ReharmMove): DemoExplanation {
  return {
    summary: move.text.summary,
    deepDive: [move.text.theory, move.text.insight].filter(Boolean).join("\n\n"),
    recreateRule: move.text.recreateRule,
    model: "Reharm Lab engine",
  };
}

export function demoExplain(file: DemoExplanationFile | null, move: ReharmMove) {
  const hit = file?.explanations[move.id];
  return { ...(hit ?? templateExplanation(move)), cached: true, source: hit ? `demo-${file!.source}` : "demo-template" };
}
