import { serve } from "@hono/node-server";
import { generateMoves, someday, type Tune } from "@reharm/theory-core";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";

// Load apps/api/.env (Node 22 built-in; no dotenv needed). Must run before explain.ts reads env.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // no .env file: fine if the key comes from the shell or an `ant auth login` profile
}
const { explainMove, ExplainError, MODEL } = await import("./explain");

/**
 * Thin API: persistence, imports, and LLM-written explanations.
 * The theory engine runs in the browser; this server never decides pitches.
 */
const tunes = new Map<string, Tune>([[someday.id, someday]]); // TODO: SQLite + Drizzle

const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({ ok: true, model: MODEL, anthropicKey: process.env.ANTHROPIC_API_KEY ? "set" : "missing" }),
);

app.get("/tunes", (c) => c.json([...tunes.values()].map(({ id, title, composer }) => ({ id, title, composer }))));

app.get("/tunes/:id", (c) => {
  const tune = tunes.get(c.req.param("id"));
  return tune ? c.json(tune) : c.json({ error: "not found" }, 404);
});

app.get("/tunes/:id/moves", (c) => {
  const tune = tunes.get(c.req.param("id"));
  return tune ? c.json(generateMoves(tune)) : c.json({ error: "not found" }, 404);
});

/**
 * POST /api/explain { tuneId, moveId, fresh? }
 * Recomputes the move server-side (never trusts client-sent facts), asks Claude for
 * { summary, deepDive, recreateRule }, and caches by hash(prompt version, model, facts).
 */
app.post("/explain", async (c) => {
  const body = await c.req.json<{ tuneId?: string; moveId?: string; fresh?: boolean }>().catch(() => ({}) as Record<string, never>);
  if (!body.tuneId || !body.moveId) return c.json({ error: "tuneId and moveId are required" }, 400);
  const tune = tunes.get(body.tuneId);
  const move = tune && generateMoves(tune).accepted.find((m) => m.id === body.moveId);
  if (!tune || !move) return c.json({ error: "move not found" }, 404);
  try {
    return c.json(await explainMove(tune, move, { fresh: !!body.fresh }));
  } catch (err) {
    if (err instanceof ExplainError) return c.json({ error: err.message }, err.status);
    console.error("[explain] unexpected error", err);
    return c.json({ error: "Unexpected server error. See the API console." }, 502);
  }
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () =>
  console.log(`api listening on http://localhost:${port}/api · model ${MODEL} · key ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"}`),
);
