import { generateMoves, scramble, someday, transposeTune } from "@reharm/theory-core";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import initSqlJs from "sql.js";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

type App = Awaited<ReturnType<typeof createApp>>["app"];
const tmp = () => mkdtempSync(path.join(tmpdir(), "reharm-test-"));
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
async function call(app: App, url: string, init?: RequestInit) {
  const res = await app.request(url, init);
  return { status: res.status, body: (await res.json()) as any };
}

// an original two-song playlist (no copyrighted charts in tests)
const song = (title: string, key: string, music: string) =>
  [title, "Lior Itai", "", "Medium Swing", key, "", "1r34LbKcu7" + scramble(music), "", "0", "3"].join("=");
const PLAYLIST =
  "irealb://" +
  encodeURIComponent(
    [song("Test One", "C", "[T44*AC^7 |A7 |D-7 |G7 |C^7 |F^7 |C^7 |G7 Z"), song("Test Two", "F", "[T44F^7 |G-7 C7 |F^7 |F^7 Z"), "Test Set"].join("==="),
  );

describe("read-only demo mode", () => {
  let app: App;
  const someMove = generateMoves(someday).accepted[0];

  beforeAll(async () => {
    // a real-looking key that would fail if anything tried to call Anthropic
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-not-a-real-key";
    const dir = tmp();
    const file = path.join(dir, "explanations.json");
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        tuneId: someday.id,
        generatedAt: "2026-01-01T00:00:00Z",
        source: "claude",
        explanations: { [someMove.id]: { summary: "S", deepDive: "D", recreateRule: "R", model: "claude-opus-5-5" } },
      }),
    );
    ({ app } = await createApp({ demo: true, demoExplanationsFile: file }));
  });

  it("serves only the demo tune", async () => {
    const health = await call(app, "/api/health");
    expect(health.body).toMatchObject({ demo: true, anthropicKey: "unused", tunes: 1 });
    const list = await call(app, "/api/tunes");
    expect(list.body.map((t: any) => t.id)).toEqual([someday.id]);
    expect((await call(app, `/api/tunes/${someday.id}`)).status).toBe(200);
    expect((await call(app, "/api/tunes/anything-else")).status).toBe(404);
  });

  it("refuses every write", async () => {
    expect((await call(app, "/api/import/ireal", json("POST", { url: PLAYLIST }))).status).toBe(403);
    expect((await call(app, `/api/tunes/${someday.id}`, json("DELETE"))).status).toBe(403);
    expect((await call(app, "/api/practice/sessions", json("POST", { mode: "coach" }))).status).toBe(403);
    expect((await call(app, "/api/practice/progress")).status).toBe(404);
  });

  it("serves Deep Dives from the pre-generated file and never calls Anthropic", async () => {
    const hit = await call(app, "/api/explain", json("POST", { tuneId: someday.id, moveId: someMove.id }));
    expect(hit.status).toBe(200);
    expect(hit.body).toMatchObject({ summary: "S", deepDive: "D", recreateRule: "R", source: "demo-claude", cached: true });

    // a move missing from the file falls back to the engine's own text, still with no API call
    const other = generateMoves(someday).accepted[1];
    const miss = await call(app, "/api/explain", json("POST", { tuneId: someday.id, moveId: other.id, fresh: true }));
    expect(miss.status).toBe(200);
    expect(miss.body).toMatchObject({ summary: other.text.summary, recreateRule: other.text.recreateRule, source: "demo-template" });
  });

  it("explains a move in the key the user transposed to (tuneId@Key)", async () => {
    const inDb = transposeTune(someday, "Db");
    const moved = generateMoves(inDb).accepted.find((m) => m.id === someMove.id)!;
    const res = await call(app, "/api/explain", json("POST", { tuneId: `${someday.id}@Db`, moveId: someMove.id }));
    expect(res.status).toBe(200);
    // the pre-written text names B♭-major notes, so a transposed move gets the engine's text, in D♭
    expect(res.body).toMatchObject({ summary: moved.text.summary, source: "demo-template" });
    expect(moved.text.summary).not.toBe(someMove.text.summary);
    // the tune's own key is the same as no key at all
    expect((await call(app, "/api/explain", json("POST", { tuneId: `${someday.id}@${someday.key.tonic}`, moveId: someMove.id }))).body.source).toBe("demo-claude");
    expect((await call(app, "/api/explain", json("POST", { tuneId: `${someday.id}@H`, moveId: someMove.id }))).status).toBe(400);
  });

  it("ships a demo file that covers every move the demo tune can show", async () => {
    const { loadDemoExplanations } = await import("../src/demo");
    const shipped = loadDemoExplanations();
    expect(shipped).not.toBeNull();
    for (const m of generateMoves(someday).accepted) expect(Object.keys(shipped!.explanations)).toContain(m.id);
  });
});

describe("library mode: import + practice history", () => {
  let app: App;
  let dbFile: string | undefined;

  beforeAll(async () => {
    ({ app, dbFile } = await createApp({ demo: false, dbFile: path.join(tmp(), "test.sqlite") }));
  });

  it("seeds the reference tune on first run", async () => {
    expect(dbFile).toMatch(/test\.sqlite$/);
    const list = await call(app, "/api/tunes");
    expect(list.body.map((t: any) => t.id)).toEqual([someday.id]);
  });

  it("imports a playlist as a setlist; re-import updates in place; bad links get a 422", async () => {
    const first = await call(app, "/api/import/ireal", json("POST", { url: PLAYLIST }));
    expect(first.status).toBe(200);
    expect(first.body.playlist).toBe("Test Set");
    expect(first.body.imported.map((s: any) => [s.title, s.bars, s.updated])).toEqual([
      ["Test One", 8, false],
      ["Test Two", 4, false],
    ]);
    const again = await call(app, "/api/import/ireal", json("POST", { url: PLAYLIST }));
    expect(again.body.imported.every((s: any) => s.updated)).toBe(true);
    expect((await call(app, "/api/import/ireal", json("POST", { url: "not a link" }))).status).toBe(422);
    const sets = await call(app, "/api/setlists");
    expect(sets.body).toEqual([{ id: 1, name: "Test Set", tuneIds: ["test-one-itai-lior", "test-two-itai-lior"] }]);
  });

  it("validates practice payloads", async () => {
    expect((await call(app, "/api/practice/sessions", json("POST", { mode: "jam" }))).status).toBe(400);
    expect((await call(app, "/api/practice/coach-attempts", json("POST", { sessionId: 999, moveId: "x" }))).status).toBe(400);
    const missingSession = await call(
      app,
      "/api/practice/coach-attempts",
      json("POST", { sessionId: 999, moveId: "m", ruleId: "r", keyTonic: "C", misses: 0, leaps: 0, maxLeap: 1 }),
    );
    expect(missingSession.status).toBe(404);
  });

  it("records coach runs, tracks clean keys and schedules reviews", async () => {
    const session = await call(app, "/api/practice/sessions", json("POST", { tuneId: someday.id, mode: "coach", tempo: 152 }));
    expect(session.status).toBe(201);
    const sessionId = session.body.id;
    const attempt = (keyTonic: string, misses: number, leaps = 0) =>
      call(
        app,
        "/api/practice/coach-attempts",
        json("POST", { sessionId, tuneId: someday.id, moveId: "dominant.tritoneSub@4.1", ruleId: "dominant.tritoneSub", keyTonic, misses, leaps, maxLeap: leaps ? 12 : 2 }),
      );

    const a = await attempt("Bb", 0);
    expect(a.body).toMatchObject({ grade: 5, clean: true, review: { reps: 1, intervalDays: 1 } });
    const b = await attempt("A#", 0); // same key, other spelling
    expect(b.body.review).toMatchObject({ keyTonic: "Bb", reps: 2, intervalDays: 3, cleanRuns: 2 });
    const c = await attempt("D", 2); // a few misses: reset, retry in 10 minutes
    expect(c.body).toMatchObject({ grade: 2, clean: false, review: { keyTonic: "D", reps: 0 } });
    await attempt("Ab", 0, 1); // right notes but a leap: not clean

    const progress = await call(app, "/api/practice/progress");
    expect(progress.body.cleanKeys).toEqual({ "dominant.tritoneSub": ["Bb"] });
    expect(progress.body.concepts.map((x: any) => [x.keyTonic, x.attempts])).toEqual([
      ["Ab", 1],
      ["Bb", 2],
      ["D", 1],
    ]);
    expect((await call(app, `/api/practice/sessions/${sessionId}/end`, json("POST"))).status).toBe(200);
  });

  it("records improv runs and returns them per tune", async () => {
    const { body } = await call(app, "/api/practice/sessions", json("POST", { tuneId: someday.id, mode: "improv" }));
    const run = {
      sessionId: body.id,
      tuneId: someday.id,
      level: 2,
      view: "reharm",
      loopStartBar: 1,
      loopEndBar: 8,
      notes: 40,
      chordTonePct: 55,
      tensionPct: 30,
      avoidPct: 5,
      outsidePct: 10,
      strongBeatChordTonePct: 70,
      guideToneLandings: 4,
      heldAvoidNotes: 1,
    };
    expect((await call(app, "/api/practice/improv-runs", json("POST", run))).status).toBe(201);
    expect((await call(app, "/api/practice/improv-runs", json("POST", { ...run, chordTonePct: 120 }))).status).toBe(400);
    const progress = await call(app, `/api/practice/progress?tuneId=${someday.id}`);
    expect(progress.body.recentImprov).toHaveLength(1);
    expect(progress.body.recentImprov[0]).toMatchObject({ chordTonePct: 55, guideToneLandings: 4 });
  });

  it("every write lands in the file that was opened, never the default database", async () => {
    const { DB_FILE } = await import("../src/db/client");
    expect(DB_FILE).toBe(process.env.REHARM_DB); // the sentinel from test/setup.ts
    expect(existsSync(DB_FILE)).toBe(false);
    const SQL = await initSqlJs();
    const onDisk = new SQL.Database(readFileSync(dbFile!));
    expect(onDisk.exec("select count(*) from tunes")[0].values[0][0]).toBe(3);
    expect(onDisk.exec("select count(*) from coach_attempts")[0].values[0][0]).toBe(4);
  });

  it("deleting a tune keeps its practice history (tune link set to null)", async () => {
    expect((await call(app, "/api/tunes/test-one-itai-lior", json("DELETE"))).status).toBe(200);
    const sets = await call(app, "/api/setlists");
    expect(sets.body[0].tuneIds).toEqual(["test-two-itai-lior"]);
    expect((await call(app, "/api/practice/progress")).body.concepts.length).toBe(3);
  });
});
