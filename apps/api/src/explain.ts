import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  improvMap,
  prettyNote as pn,
  prettySymbol,
  realize,
  symbol,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { EXPLAIN_SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt";

export const MODEL = process.env.EXPLAIN_MODEL || "claude-opus-5-5";

export const ExplanationSchema = z.object({
  summary: z.string(),
  deepDive: z.string(),
  recreateRule: z.string(),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export class ExplainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 429 | 502 | 503,
    /** Machine-readable reason for the client ("no_key" lets the UI fall back calmly). */
    readonly code?: "no_key" | "bad_key" | "rate_limited",
  ) {
    super(message);
  }
}

/** Everything the model may talk about, and nothing else. No raw tune data. */
export function buildFacts(tune: Tune, move: ReharmMove) {
  const chords = realize(tune, [move]);
  const scales = improvMap(tune, chords)
    .filter((e) => move.chords.some((c) => c.id === e.chord.id))
    .map((e) => ({
      chord: prettySymbol(symbol(e.chord)),
      scales: e.scales.map((s) => ({ name: s.name, notes: s.notes.map(pn), parent: s.parent ?? null, avoidAsLongNotes: s.avoid.map(pn) })),
      guideTones: e.guideTones.map((g) => `${pn(g.note)} (${pn(g.degree)})`),
      guideToneTargets: e.targets.map((t) => `${pn(t.from)} → ${pn(t.to)} (${t.semitones >= 0 ? "+" : ""}${t.semitones})`),
    }));
  return {
    tune: { title: tune.title, key: `${tune.key.tonic} ${tune.key.mode}`, meter: tune.meter.join("/"), feel: tune.feel },
    move: {
      name: move.title,
      ruleId: move.ruleId,
      category: move.category,
      level: move.level,
      styleTags: move.styleTags,
      bars: `${move.span.from.bar}–${move.span.to.bar}`,
      original: move.original.map((c) => prettySymbol(symbol(c))),
      replacement: move.chords.map((c) => ({ chord: prettySymbol(symbol(c)), beats: c.beats })),
      resolvesTo: move.targetSymbol ? prettySymbol(move.targetSymbol) : null,
      voicingHint: move.voicingHint ? { lh: move.voicingHint.lh.map(pn), rh: move.voicingHint.rh.map(pn) } : null,
      voiceLeading: move.voiceLeading.map(
        (v) => `${pn(v.from)} → ${pn(v.to)} (${v.semitones >= 0 ? "+" : ""}${v.semitones}, lands on the ${pn(v.toDegree)})`,
      ),
      melodyCheck: move.checks.melody.map((m) => ({ over: prettySymbol(m.chordSymbol), note: pn(m.note), role: pn(m.role), verdict: m.verdict })),
      melodyVerified: move.checks.melodyVerified,
    },
    engineFacts: JSON.parse(JSON.stringify(move.facts), (_k, v) => (typeof v === "string" && /^[A-G][b#]*$/.test(v) ? pn(v) : v)),
    scales,
    draft: move.text,
  };
}

// ── cache: memory + a JSON file, keyed by prompt version + model + facts ──
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".cache", "explanations.json");
let cache: Record<string, Explanation & { model: string; createdAt: string }> | null = null;

async function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

async function saveCache() {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

const keyOf = (facts: unknown) => createHash("sha256").update(`${PROMPT_VERSION}|${MODEL}|${JSON.stringify(facts)}`).digest("hex");

let client: Anthropic | null = null;

export async function explainMove(tune: Tune, move: ReharmMove, { fresh = false } = {}) {
  const facts = buildFacts(tune, move);
  const key = keyOf(facts);
  const store = await loadCache();
  if (!fresh && store[key]) return { ...store[key], cached: true };

  try {
    client ??= new Anthropic(); // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Opus 5.5 defaults to medium effort; set it explicitly. Writing ~300 words from given facts doesn't need more.
      output_config: { effort: "medium", format: betaZodOutputFormat(ExplanationSchema) },
      // If a safety classifier declines, the API retries on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: EXPLAIN_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `<facts>\n${JSON.stringify(facts, null, 2)}\n</facts>` }],
    });

    if (response.stop_reason === "refusal") {
      throw new ExplainError(`The model declined to explain this move (${response.stop_details?.category ?? "no category"}).`, 502);
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new ExplainError("The model's answer was cut off or didn't match the schema. Try again.", 502);
    }

    const entry = { ...response.parsed_output, model: response.model, createdAt: new Date().toISOString() };
    store[key] = entry;
    await saveCache();
    console.log(
      `[explain] ${move.id} · ${response.usage.input_tokens} in (+${response.usage.cache_read_input_tokens ?? 0} cached) / ${response.usage.output_tokens} out`,
    );
    return { ...entry, cached: false };
  } catch (err) {
    if (err instanceof ExplainError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new ExplainError("Anthropic rejected the API key. Check ANTHROPIC_API_KEY in apps/api/.env.", 401, "bad_key");
    if (err instanceof Anthropic.RateLimitError) throw new ExplainError("Rate limited by the Anthropic API. Wait a moment and retry.", 429, "rate_limited");
    if (err instanceof Anthropic.APIError) throw new ExplainError(`Anthropic API error ${err.status ?? ""}: ${err.message}`, 502);
    if (err instanceof Error && /api ?key|auth/i.test(err.message)) {
      throw new ExplainError("No Anthropic credentials found. Put ANTHROPIC_API_KEY in apps/api/.env and restart the API.", 503, "no_key");
    }
    throw err;
  }
}
