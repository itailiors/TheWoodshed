import { serve } from "@hono/node-server";
import { generateMoves, IRealParseError, parseIRealUrl, someday } from "@reharm/theory-core";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";

// Load apps/api/.env (Node 22 built-in; no dotenv needed). Must run before explain.ts reads env.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // no .env file: fine if the key comes from the shell or an `ant auth login` profile
}
const { explainMove, ExplainError, MODEL } = await import("./explain");
const { openDb, DB_FILE } = await import("./db/client");
const repo = await import("./db/repo");

await openDb();
if (repo.countTunes() === 0) repo.upsertTune(someday); // first run: seed the reference tune

/**
 * Thin API: the tune library (SQLite), iReal Pro import, and LLM-written explanations.
 * The theory engine runs in the browser; this server never decides pitches.
 */
const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({ ok: true, model: MODEL, anthropicKey: process.env.ANTHROPIC_API_KEY ? "set" : "missing", tunes: repo.countTunes() }),
);

// ── library ──
app.get("/tunes", (c) => c.json(repo.listTunes()));

app.get("/tunes/:id", (c) => {
  const tune = repo.getTune(c.req.param("id"));
  return tune ? c.json(tune) : c.json({ error: "not found" }, 404);
});

app.delete("/tunes/:id", (c) => (repo.deleteTune(c.req.param("id")) ? c.json({ ok: true }) : c.json({ error: "not found" }, 404)));

app.get("/tunes/:id/moves", (c) => {
  const tune = repo.getTune(c.req.param("id"));
  return tune ? c.json(generateMoves(tune)) : c.json({ error: "not found" }, 404);
});

app.get("/setlists", (c) => c.json(repo.listSetlists()));

/**
 * POST /api/import/ireal { url }
 * Parses an irealb:// or irealbook:// link (one song or a whole playlist), saves every song,
 * and turns a playlist into a setlist. Re-importing the same song updates it in place.
 */
app.post("/import/ireal", async (c) => {
  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string });
  if (!body.url?.trim()) return c.json({ error: "Paste an iReal Pro link first." }, 400);
  let parsed;
  try {
    parsed = parseIRealUrl(body.url);
  } catch (err) {
    if (err instanceof IRealParseError) return c.json({ error: err.message }, 422);
    console.error("[import] unexpected parser error", err);
    return c.json({ error: "Couldn't read that link. See the API console for details." }, 422);
  }

  const imported = repo.batch(() => {
    const seen = new Map<string, number>();
    const out = parsed.songs.map(({ tune, style, warnings }) => {
      // two different songs with the same title + composer in one playlist get distinct ids
      const n = (seen.get(tune.id) ?? 0) + 1;
      seen.set(tune.id, n);
      const id = n > 1 ? `${tune.id}-${n}` : tune.id;
      const existed = repo.tuneExists(id);
      repo.upsertTune({ ...tune, id }, { style, warnings }, false);
      return { id, title: tune.title, bars: repo.totalBars(tune), warnings, updated: existed };
    });
    if (parsed.playlist) repo.saveSetlist(parsed.playlist, out.map((s) => s.id), false);
    return out;
  });
  return c.json({ playlist: parsed.playlist, imported });
});

/**
 * POST /api/explain { tuneId, moveId, fresh? }
 * Recomputes the move server-side (never trusts client-sent facts), asks Claude for
 * { summary, deepDive, recreateRule }, and caches by hash(prompt version, model, facts).
 */
app.post("/explain", async (c) => {
  const body = await c.req.json<{ tuneId?: string; moveId?: string; fresh?: boolean }>().catch(() => ({}) as Record<string, never>);
  if (!body.tuneId || !body.moveId) return c.json({ error: "tuneId and moveId are required" }, 400);
  const tune = repo.getTune(body.tuneId);
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
  console.log(
    `api listening on http://localhost:${port}/api · db ${DB_FILE} · model ${MODEL} · key ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"}`,
  ),
);
