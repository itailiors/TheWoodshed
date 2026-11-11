/**
 * Pre-generates the Deep Dives the read-only demo serves (apps/api/demo/explanations.json).
 *
 *   npm run demo:generate -w @reharm/api              # Claude-written (uses ANTHROPIC_API_KEY once)
 *   npm run demo:generate -w @reharm/api -- --template # engine text only, no API calls
 *
 * Run it whenever the engine's rules change, so every move the demo can show has an entry.
 */
import { generateMoves, someday } from "@reharm/theory-core";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const template = process.argv.includes("--template");
if (!template) {
  try {
    process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch {
    /* key may come from the shell */
  }
}

const { DEMO_EXPLANATIONS_FILE, templateExplanation } = await import("../src/demo");
type Entry = import("../src/demo").DemoExplanation;

const moves = generateMoves(someday).accepted;
const explanations: Record<string, Entry> = {};

if (template) {
  for (const m of moves) explanations[m.id] = templateExplanation(m);
} else {
  const { explainMove } = await import("../src/explain");
  for (const [i, m] of moves.entries()) {
    process.stdout.write(`[${i + 1}/${moves.length}] ${m.id} … `);
    const e = await explainMove(someday, m); // uses the on-disk cache, so re-runs only pay for new moves
    explanations[m.id] = { summary: e.summary, deepDive: e.deepDive, recreateRule: e.recreateRule, model: e.model };
    console.log(e.cached ? "cached" : "written");
  }
}

mkdirSync(path.dirname(DEMO_EXPLANATIONS_FILE), { recursive: true });
writeFileSync(
  DEMO_EXPLANATIONS_FILE,
  JSON.stringify({ version: 1, tuneId: someday.id, generatedAt: new Date().toISOString(), source: template ? "template" : "claude", explanations }, null, 2) + "\n",
);
console.log(`wrote ${moves.length} explanations (${template ? "engine text" : "Claude"}) → ${DEMO_EXPLANATIONS_FILE}`);
