import { Hono } from "hono";
import { z } from "zod";

const pct = z.number().int().min(0).max(100);

const SessionBody = z.object({
  tuneId: z.string().max(200).nullish(),
  mode: z.enum(["coach", "improv"]),
  tempo: z.number().int().min(20).max(400).nullish(),
});

const CoachAttemptBody = z.object({
  sessionId: z.number().int().positive(),
  tuneId: z.string().max(200).nullish(),
  moveId: z.string().min(1).max(200),
  ruleId: z.string().min(1).max(100),
  keyTonic: z.string().regex(/^[A-G][b#]?$/),
  misses: z.number().int().min(0).max(1000),
  leaps: z.number().int().min(0).max(1000),
  maxLeap: z.number().int().min(0).max(127),
});

const ImprovRunBody = z.object({
  sessionId: z.number().int().positive(),
  tuneId: z.string().max(200).nullish(),
  level: z.number().int().min(0).max(4),
  view: z.enum(["reharm", "original"]),
  loopStartBar: z.number().int().min(1),
  loopEndBar: z.number().int().min(1),
  notes: z.number().int().min(0),
  chordTonePct: pct,
  tensionPct: pct,
  avoidPct: pct,
  outsidePct: pct,
  strongBeatChordTonePct: pct.nullable(),
  guideToneLandings: z.number().int().min(0),
  heldAvoidNotes: z.number().int().min(0),
});

/**
 * /api/practice: saved practice history and the spaced-repetition queue.
 * Disabled (404 for reads; writes already refused) in the read-only demo.
 */
export function practiceRoutes({ enabled }: { enabled: boolean }) {
  const r = new Hono();
  if (!enabled) {
    r.all("*", (c) => c.json({ error: "Practice history isn't available in the read-only demo." }, 404));
    return r;
  }

  const repo = () => import("../db/practiceRepo");
  const parse = async <T extends z.ZodTypeAny>(schema: T, req: Request): Promise<z.infer<T> | { error: string }> => {
    const json = await req.json().catch(() => undefined);
    const res = schema.safeParse(json);
    return res.success ? res.data : { error: res.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") };
  };
  const isError = (x: unknown): x is { error: string } => typeof x === "object" && x !== null && "error" in x;

  r.post("/sessions", async (c) => {
    const body = await parse(SessionBody, c.req.raw);
    if (isError(body)) return c.json(body, 400);
    return c.json({ id: (await repo()).startSession(body) }, 201);
  });

  r.post("/sessions/:id/end", async (c) => {
    const id = Number(c.req.param("id"));
    const p = await repo();
    if (!Number.isInteger(id) || !p.sessionExists(id)) return c.json({ error: "session not found" }, 404);
    p.endSession(id);
    return c.json({ ok: true });
  });

  r.post("/coach-attempts", async (c) => {
    const body = await parse(CoachAttemptBody, c.req.raw);
    if (isError(body)) return c.json(body, 400);
    const p = await repo();
    if (!p.sessionExists(body.sessionId)) return c.json({ error: "session not found" }, 404);
    return c.json(p.recordCoachAttempt(body), 201);
  });

  r.post("/improv-runs", async (c) => {
    const body = await parse(ImprovRunBody, c.req.raw);
    if (isError(body)) return c.json(body, 400);
    if (body.loopEndBar < body.loopStartBar) return c.json({ error: "loopEndBar must be ≥ loopStartBar" }, 400);
    const p = await repo();
    if (!p.sessionExists(body.sessionId)) return c.json({ error: "session not found" }, 404);
    return c.json({ id: p.recordImprovRun(body) }, 201);
  });

  /** Everything the practice UI needs: per-concept SRS state, clean keys, due queue, recent improv runs. */
  r.get("/progress", async (c) => {
    const p = await repo();
    const now = new Date();
    return c.json({
      concepts: p.allConcepts(),
      cleanKeys: p.cleanKeys(),
      due: p.dueConcepts(now),
      recentImprov: p.recentImprovRuns(c.req.query("tuneId")),
    });
  });

  r.get("/due", async (c) => c.json((await repo()).dueConcepts(new Date())));

  return r;
}
