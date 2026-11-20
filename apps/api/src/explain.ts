import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  conceptNode,
  GLOSSARY,
  improvMap,
  learnName,
  lessonForMove,
  prettyNote as pn,
  prettySymbol,
  realize,
  RULES,
  symbol,
  type Lesson,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { templateExplanation } from "./demo";
import { EXPLAIN_SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt";
import { validateExplanation, type CheckFailure } from "./validateExplain";

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

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// plain terms match as whole words, any case, with "borrows"/"tonicized" counting; numerals match exactly and stand alone
const termRe = (form: string) => new RegExp(`(?<![\\p{L}])${esc(form)}(?:s|es|ed|ing)?(?![\\p{L}])`, "iu");
const numeralRe = (form: string) => new RegExp(`(?<![\\p{L}\\p{N}♭♯])${esc(form)}(?![\\p{L}\\p{N}])`, "u");

/** The glossary entries a lesson's words use (its steps' new terms, other terms and the numerals), in glossary order. */
function lessonGlossary(lesson: Lesson): { term: string; gloss: string }[] {
  const text = [lesson.headline, ...lesson.steps.map((s) => s.text), lesson.rule].join("\n");
  const named = new Set(lesson.steps.map((s) => s.term).filter(Boolean));
  return GLOSSARY.filter((g) => {
    if (g.kind === "category" || g.kind === "level") return false;
    if (named.has(g.term)) return true;
    const forms = [g.term, ...g.aliases];
    return forms.some((f) => (g.kind === "numeral" ? numeralRe(f) : termRe(f)).test(text));
  }).map((g) => ({ term: g.term, gloss: g.gloss }));
}

/** A note or chord symbol in engine spelling ("Bb", "Gb9", "Ebm7", "C7(b9)"), not a word that starts with A–G ("Above"). */
const ENGINE_SYMBOL = /^[A-G][b#]*(?:$|[^a-z\s]|m|maj|dim|aug|sus|add)\S*$/;

/** A chord degree in engine spelling ("b9", "#11", "bb7"). */
const DEGREE_CODE = /^(?:bb|b|#)\d{1,2}$/;

/** Everything the model may talk about, and nothing else. No raw tune data. */
export function buildFacts(tune: Tune, move: ReharmMove) {
  // `learn` (the lesson layer's fields) stays out: it is for the UI, and adding it would roll every cache key.
  const { learn: _learn, ...engineFacts } = move.facts;
  const chords = realize(tune, [move]);
  const scales = improvMap(tune, chords)
    .filter((e) => move.chords.some((c) => c.id === e.chord.id))
    .map((e) => ({
      chord: prettySymbol(symbol(e.chord)),
      scales: e.scales.map((s) => ({ name: s.name, notes: s.notes.map(pn), parent: s.parent ?? null, avoidAsLongNotes: s.avoid.map(pn) })),
      guideTones: e.guideTones.map((g) => `${pn(g.note)} (${pn(g.degree)})`),
      guideToneTargets: e.targets.map((t) => `${pn(t.from)} → ${pn(t.to)} (${t.semitones >= 0 ? "+" : ""}${t.semitones})`),
    }));
  // the lesson the player has already seen, as display prose (its keyboard data stays in the UI)
  const lesson = lessonForMove(move);
  const pedagogy = RULES.find((r) => r.id === move.ruleId)?.pedagogy;
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
    // notes and chord symbols in display spelling ("Gb9" → "G♭9"), so nothing in the facts shows the model an ASCII accidental
    // (degree codes too: one-note-on-top's roles "b9", "#11" → "♭9", "♯11")
    engineFacts: JSON.parse(JSON.stringify(engineFacts), (_k, v) =>
      typeof v !== "string" ? v : ENGINE_SYMBOL.test(v) ? prettySymbol(v) : DEGREE_CODE.test(v) ? pn(v) : v,
    ),
    scales,
    draft: move.text,
    lesson: lesson ? { headline: lesson.headline, steps: lesson.steps.map((s) => s.text), rule: lesson.rule } : null,
    pedagogy: pedagogy ? { formula: pedagogy.formula, whenToUse: pedagogy.whenToUse, bandstandCue: pedagogy.bandstandCue } : null,
    prereqs: (conceptNode(move.ruleId)?.hard ?? []).map(learnName),
    glossary: lesson ? lessonGlossary(lesson) : [],
  };
}

// ── cache: memory + a JSON file, keyed by prompt version + model + facts ──
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".cache", "explanations.json");
type CacheEntry = Explanation & { model: string; createdAt: string };

/** Where good answers are kept. The default is memory backed by `apps/api/.cache/explanations.json`; tests pass a map. */
export interface ExplainCache {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): Promise<void>;
}

let fileStore: Record<string, CacheEntry> | null = null;
const fileCache: ExplainCache = {
  async get(key) {
    if (!fileStore) {
      try {
        fileStore = JSON.parse(await readFile(CACHE_FILE, "utf8"));
      } catch {
        fileStore = {};
      }
    }
    return fileStore![key];
  },
  async set(key, entry) {
    await this.get(key); // loads the file first, so a write never drops entries
    fileStore![key] = entry;
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(fileStore, null, 2));
  },
};

export const keyOf = (facts: unknown) => createHash("sha256").update(`${PROMPT_VERSION}|${MODEL}|${JSON.stringify(facts)}`).digest("hex");

// ── the client, narrowed to the one call this file makes (tests pass a stub; no network in tests) ──
type ParseParams = Parameters<Anthropic["beta"]["messages"]["parse"]>[0];
export interface ParseResult {
  stop_reason: string | null;
  stop_details?: { category?: string | null } | null;
  parsed_output: Explanation | null;
  model: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null };
}
export interface ExplainClient {
  beta: { messages: { parse(params: ParseParams): Promise<ParseResult> } };
}

/** Debug logging for the explain path, only when the API runs with `--dev` (the `dev` script) or REHARM_DEV=true. */
export const DEV = process.argv.includes("--dev") || process.env.REHARM_DEV === "true";

/**
 * A move whose answers failed validation twice is not sent to Claude again for this long: it gets
 * the template at once. In memory only, so a restart (or a new prompt version) tries again.
 */
export const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;
const negativeCache = new Map<string, number>();

export interface ExplainDeps {
  client?: ExplainClient;
  cache?: ExplainCache;
  /** cache key → time (ms) until which the move gets the template without a call. */
  negative?: Map<string, number>;
  now?: () => number;
  log?: (line: string) => void;
}

let defaultClient: ExplainClient | null = null;

const factsTurn = (facts: unknown) => `<facts>\n${JSON.stringify(facts, null, 2)}\n</facts>`;
const retryTurn = (failures: CheckFailure[]) =>
  `That answer failed ${failures.length === 1 ? "this check" : "these checks"}:\n${failures.map((f) => `- ${f.message}`).join("\n")}\nRewrite all three fields so every check passes, keeping every other instruction.`;

/**
 * The Deep Dive for a move: from the cache, else from Claude. Each answer is validated
 * (`validateExplain.ts`); a failing one is retried at most once with the failed checks listed.
 * If the retry fails too, the player gets the engine's template (not cached) and the move goes
 * on the negative cache, so repeat clicks don't pay for another two calls. Never loops.
 */
export async function explainMove(tune: Tune, move: ReharmMove, { fresh = false } = {}, deps: ExplainDeps = {}) {
  const cache = deps.cache ?? fileCache;
  const negative = deps.negative ?? negativeCache;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (DEV ? (line: string) => console.log(line) : () => {});

  const facts = buildFacts(tune, move);
  const key = keyOf(facts);
  const hit = fresh ? undefined : await cache.get(key);
  if (hit) return { ...hit, cached: true };

  const template = () => ({ ...templateExplanation(move), cached: false, source: "template" as const });
  const blockedUntil = negative.get(key);
  if (blockedUntil !== undefined) {
    if (now() < blockedUntil) return template();
    negative.delete(key);
  }

  try {
    // reads ANTHROPIC_API_KEY (or an `ant auth login` profile); a test's stub never constructs it
    const client = deps.client ?? (defaultClient ??= new Anthropic() as unknown as ExplainClient);
    const messages: ParseParams["messages"] = [{ role: "user", content: factsTurn(facts) }];

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        // Opus 5.5 defaults to medium effort; set it explicitly. Writing ~150 words from given facts doesn't need more.
        output_config: { effort: "medium", format: betaZodOutputFormat(ExplanationSchema) },
        // If a safety classifier declines, the API retries on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: EXPLAIN_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [...messages],
      });

      if (response.stop_reason === "refusal") {
        throw new ExplainError(`The model declined to explain this move (${response.stop_details?.category ?? "no category"}).`, 502);
      }
      if (response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new ExplainError("The model's answer was cut off or didn't match the schema. Try again.", 502);
      }
      log(
        `[explain] ${move.id} · attempt ${attempt} · ${response.usage.input_tokens} in (+${response.usage.cache_read_input_tokens ?? 0} cached) / ${response.usage.output_tokens} out`,
      );

      const answer = response.parsed_output;
      const failures = validateExplanation(answer, facts);
      if (!failures.length) {
        const entry = { ...answer, model: response.model, createdAt: new Date(now()).toISOString() };
        await cache.set(key, entry);
        return { ...entry, cached: false };
      }
      log(`[explain] ${move.id} · attempt ${attempt} failed: ${failures.map((f) => f.check).join(", ")}`);
      messages.push({ role: "assistant", content: JSON.stringify(answer) }, { role: "user", content: retryTurn(failures) });
    }

    negative.set(key, now() + NEGATIVE_TTL_MS);
    log(`[explain] ${move.id} · serving the template; no new call for this move for ${NEGATIVE_TTL_MS / 3_600_000} h`);
    return template();
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
