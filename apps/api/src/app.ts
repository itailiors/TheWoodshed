import { formBars, generateMoves, IRealParseError, parseIRealUrl, someday, type Tune } from "@reharm/theory-core";
import { Hono } from "hono";
import { demoExplain, loadDemoExplanations, DEMO_EXPLANATIONS_FILE } from "./demo";
import { explainMove, ExplainError, MODEL } from "./explain";
import { practiceRoutes } from "./practice/routes";

export interface AppOptions {
  /** Read-only public demo: only the demo tune, no writes, no Anthropic calls. */
  demo: boolean;
  /** SQLite file (ignored in demo mode). */
  dbFile?: string;
  /** Pre-generated Deep Dives for demo mode. */
  demoExplanationsFile?: string;
}

/**
 * Builds the API. Library mode opens the SQLite database; demo mode never touches
 * the database or the Anthropic API, so public traffic can't write data or spend money.
 */
export async function createApp(opts: AppOptions) {
  const app = new Hono().basePath("/api");

  const db = opts.demo ? null : await import("./db/client").then(async (m) => (await m.openDb(opts.dbFile), m));
  const repo = opts.demo ? null : await import("./db/repo");
  if (repo && repo.countTunes() === 0) repo.upsertTune(someday); // first run: seed the reference tune
  const demoFile = opts.demo ? loadDemoExplanations(opts.demoExplanationsFile ?? DEMO_EXPLANATIONS_FILE) : null;

  const getTune = (id: string): Tune | null => (repo ? repo.getTune(id) : id === someday.id ? someday : null);

  // demo mode is read-only: every write is refused up front
  if (opts.demo) {
    app.use("*", async (c, next) => {
      const isWrite = !["GET", "HEAD", "OPTIONS"].includes(c.req.method);
      if (isWrite && !c.req.path.endsWith("/explain")) {
        return c.json({ error: "This is a read-only demo. Clone the repo to import tunes and save practice history." }, 403);
      }
      await next();
    });
  }

  app.get("/health", (c) =>
    c.json({
      ok: true,
      demo: opts.demo,
      model: opts.demo ? null : MODEL,
      anthropicKey: opts.demo ? "unused" : process.env.ANTHROPIC_API_KEY ? "set" : "missing",
      tunes: repo ? repo.countTunes() : 1,
      demoExplanations: opts.demo ? (demoFile ? `${Object.keys(demoFile.explanations).length} (${demoFile.source})` : "engine text only") : undefined,
    }),
  );

  // ── library ──
  app.get("/tunes", (c) =>
    c.json(
      repo
        ? repo.listTunes()
        : [
            {
              id: someday.id,
              title: someday.title,
              composer: someday.composer ?? null,
              key: someday.key.tonic,
              meter: someday.meter.join("/"),
              style: "Jazz Waltz",
              bars: formBars(someday),
              source: someday.source.kind,
              warnings: [],
              setlists: [],
              updatedAt: 0,
            },
          ],
    ),
  );

  app.get("/tunes/:id", (c) => {
    const tune = getTune(c.req.param("id"));
    return tune ? c.json(tune) : c.json({ error: "not found" }, 404);
  });

  app.get("/tunes/:id/moves", (c) => {
    const tune = getTune(c.req.param("id"));
    return tune ? c.json(generateMoves(tune)) : c.json({ error: "not found" }, 404);
  });

  app.get("/setlists", (c) => c.json(repo ? repo.listSetlists() : []));

  if (repo) {
    app.delete("/tunes/:id", (c) => (repo.deleteTune(c.req.param("id")) ? c.json({ ok: true }) : c.json({ error: "not found" }, 404)));

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
          return { id, title: tune.title, bars: formBars(tune), warnings, updated: existed };
        });
        if (parsed.playlist) repo.saveSetlist(parsed.playlist, out.map((s) => s.id), false);
        return out;
      });
      return c.json({ playlist: parsed.playlist, imported });
    });
  }

  /**
   * POST /api/explain { tuneId, moveId, fresh? }
   * Library mode: recomputes the move, asks Claude, caches by hash(prompt version, model, facts).
   * Demo mode: serves the pre-generated file (or the engine's own text). Never calls Anthropic.
   */
  app.post("/explain", async (c) => {
    const body = await c.req.json<{ tuneId?: string; moveId?: string; fresh?: boolean }>().catch(() => ({}) as Record<string, never>);
    if (!body.tuneId || !body.moveId) return c.json({ error: "tuneId and moveId are required" }, 400);
    const tune = getTune(body.tuneId);
    const move = tune && generateMoves(tune).accepted.find((m) => m.id === body.moveId);
    if (!tune || !move) return c.json({ error: "move not found" }, 404);
    if (opts.demo) return c.json(demoExplain(demoFile, move));
    try {
      return c.json(await explainMove(tune, move, { fresh: !!body.fresh }));
    } catch (err) {
      if (err instanceof ExplainError) return c.json({ error: err.message }, err.status);
      console.error("[explain] unexpected error", err);
      return c.json({ error: "Unexpected server error. See the API console." }, 502);
    }
  });

  app.route("/practice", practiceRoutes({ enabled: !opts.demo }));

  return { app, dbFile: db?.currentDbFile() ?? undefined };
}
