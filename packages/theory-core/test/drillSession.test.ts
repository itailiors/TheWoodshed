import { describe, expect, it } from "vitest";
import { conceptDrillSteps } from "../src/coach";
import {
  drillStep,
  drillView,
  startDrillSession,
  type DrillEffect,
  type DrillEvent,
  type DrillRun,
  type DrillSession,
  type KeyPlan,
} from "../src/drillSession";
import { drillKeyOrder } from "../src/srs";
import { voicedForm, voiceLeadForms, voicingForms, voiceMotion } from "../src/voicingForms";
import type { Quality } from "../src/types";

// Dm9 → G7(♭9) → Cmaj7 in C. Targets: [38|60,64,65,69] → [43|59,62,65,68] → [48|59,62,64,67].
const moveIn = (key: string): DrillRun => {
  const { move, steps } = conceptDrillSteps("functional.secondaryTwoFive", key);
  return { kind: "move", steps, tuneId: "concept", moveId: move!.id, ruleId: move!.ruleId };
};
const played = (run: DrillRun, i: number) => {
  if (run.kind !== "move") throw new Error("not a move");
  return [run.steps[i].target.bass, ...run.steps[i].target.upper];
};
const mk = (root: string, quality: Quality, alterations: string[] = []) => ({ root, quality, extensions: [], alterations });
const shapeIn = (key: string): DrillRun => {
  const chord = mk(key, "maj7");
  return { kind: "shape", form: voicingForms(chord, "shell")[0], chord };
};
const shapeNotes = (run: DrillRun) => (run.kind === "shape" ? run.form.notes.map((n) => n.midi) : []);

const HOLD: KeyPlan = { kind: "flow", flow: "hold" };

/** Feed events in order; collect every effect. */
function play(s: DrillSession, events: DrillEvent[]) {
  const effects: DrillEffect[] = [];
  for (const e of events) {
    const r = drillStep(s, e);
    s = r.session;
    effects.push(...r.effects);
  }
  return { session: s, effects };
}
const strike = (notes: number[]): DrillEvent => ({ type: "strike", notes });
const waitOf = (effects: DrillEffect[]) => effects.find((e) => e.type === "wait") as Extract<DrillEffect, { type: "wait" }> | undefined;

describe("drill session: a Coach run (one move, three chords)", () => {
  it("files once with its misses, leaps and largest leap; later strikes emit nothing", () => {
    const run = moveIn("C");
    const s0 = startDrillSession([run], "C", HOLD, 1);
    const { session, effects } = play(s0, [
      strike([38, 61, 64, 65]), // C♯ isn't in Dm9: a miss
      strike(played(run, 0)),
      strike([43, 71, 74, 77, 80]), // G7♭9 an octave up: the top voice leaps 11 semitones
      strike([48, 71, 74, 76, 79]), // Cmaj7 right next to it: smooth
    ]);
    const files = effects.filter((e) => e.type === "file");
    expect(files).toEqual([
      {
        type: "file",
        record: { kind: "move", tuneId: "concept", moveId: run.kind === "move" ? run.moveId : "", ruleId: "functional.secondaryTwoFive", keyTonic: "C", misses: 1, leaps: 1, maxLeap: 11, gradedBy: "engine" },
      },
    ]);
    const v = drillView(session);
    expect(v).toMatchObject({ finished: true, clean: false, misses: 1, leaps: 1, maxLeap: 11, filed: true });
    expect(drillStep(session, strike(played(run, 2))).effects).toEqual([]);
  });

  it("a run with any self-checked chord is filed as self-graded, and that chord gives the next no voice-leading reference", () => {
    const run = moveIn("C");
    const { session, effects } = play(startDrillSession([run], "C", HOLD, 1), [
      { type: "self", pass: true },
      strike([43, 71, 74, 77, 80]), // would be a leap from Dm9's notes, but none were heard
      strike([48, 71, 74, 76, 79]),
    ]);
    expect(effects.filter((e) => e.type === "file")).toEqual([
      { type: "file", record: expect.objectContaining({ misses: 0, leaps: 0, maxLeap: 1, gradedBy: "self" }) },
    ]);
    expect(drillView(session).attempts[1]).toMatchObject({ by: "engine", vl: null });
  });
});

describe("drill session: the key plan", () => {
  const cleanRun = (run: DrillRun) => [0, 1, 2].map((i) => strike(played(run, i)));

  it("a key flow in fourths waits after a clean run, then moves a fourth up; an unclean run stays; a stale token is a no-op", () => {
    const run = moveIn("C");
    const s0 = startDrillSession([run], "C", { kind: "flow", flow: "fourths" }, 1);
    const clean = play(s0, cleanRun(run));
    const w = waitOf(clean.effects);
    expect(w).toBeDefined();
    expect(drillView(clean.session).nextKey).toBe("F");
    expect(drillStep(clean.session, { type: "elapsed", token: w!.token + 1 }).effects).toEqual([]);
    expect(drillStep(clean.session, { type: "elapsed", token: w!.token }).effects).toEqual([{ type: "setKey", key: "F" }]);
    // restarting while it waits makes the token stale
    const restarted = drillStep(clean.session, { type: "restart" }).session;
    expect(drillStep(restarted, { type: "elapsed", token: w!.token }).effects).toEqual([]);

    const unclean = play(s0, [strike([38, 61, 64, 65]), ...cleanRun(run)]);
    expect(unclean.effects.map((e) => e.type)).toEqual(["file"]);
    expect(drillView(unclean.session).nextKey).toBeNull();
  });

  it("transfer (a random key) is reproducible from the seed, never repeats the key, and lands where it said it would", () => {
    const run = moveIn("C");
    const transfer: KeyPlan = { kind: "flow", flow: "random" };
    for (let seed = 0; seed < 40; seed++) {
      const a = play(startDrillSession([run], "C", transfer, seed), cleanRun(run));
      const b = play(startDrillSession([run], "C", transfer, seed), cleanRun(run));
      const said = drillView(a.session).nextKey;
      expect(said).toBe(drillView(b.session).nextKey);
      expect(said).not.toBe("C");
      const landed = drillStep(a.session, { type: "elapsed", token: waitOf(a.effects)!.token }).effects;
      expect(landed).toEqual([{ type: "setKey", key: said }]);
    }
  });

  it("a 12-key lap marks each key, moves on even after a miss, stops after 12, and ends on a hand pick", () => {
    const keys = drillKeyOrder([], "C", new Date("2026-11-19T12:00:00Z"));
    let s = startDrillSession([shapeIn("C")], "C", { kind: "lap", keys }, 1);
    for (let i = 0; i < 12; i++) {
      const run = shapeIn(keys[i].key);
      s = drillStep(s, { type: "runs", runs: [run], key: keys[i].key }).session;
      const miss = i === 0 ? [strike([...shapeNotes(run), shapeNotes(run)[1] + 1])] : [];
      const r = play(s, [...miss, strike(shapeNotes(run))]);
      const w = waitOf(r.effects);
      expect(w, `key ${i + 1} waits`).toBeDefined();
      const next = drillStep(r.session, { type: "elapsed", token: w!.token });
      s = next.session;
      expect(next.effects).toEqual(i < 11 ? [{ type: "setKey", key: keys[i + 1].key }] : []);
    }
    const lap = drillView(s).lap!;
    expect(lap.at).toBe(12);
    expect(lap.finished).toBe(true);
    expect(lap.done[keys[0].key]).toBe(false); // the miss
    expect(Object.values(lap.done).filter(Boolean)).toHaveLength(11);
    // no 13th key: a fresh run in the first key files but the lap doesn't move
    const again = play(drillStep(s, { type: "runs", runs: [shapeIn("C")], key: "C" }).session, [strike(shapeNotes(shapeIn("C")))]);
    expect(again.effects.map((e) => e.type)).toEqual(["file"]);

    // a key picked by hand ends a lap
    const fresh = startDrillSession([shapeIn("C")], "C", { kind: "lap", keys }, 1);
    expect(drillView(drillStep(fresh, { type: "changeKey", key: "E", byHand: true }).session).lap).toBeNull();
  });
});

describe("drill session: shape runs (Voicings)", () => {
  it("re-grades after filing but never files twice; a root that isn't a plain key name never files", () => {
    const run = shapeIn("Eb");
    const notes = shapeNotes(run);
    const { session, effects } = play(startDrillSession([run], "Eb", HOLD, 1), [strike(notes), strike([notes[0], notes[1] + 1, notes[2]]), strike(notes)]);
    expect(effects).toEqual([{ type: "file", record: { kind: "shape", ruleId: "shape:shell:maj7", keyTonic: "Eb", misses: 0 } }]);
    expect(drillView(session).attempts.map((a) => a.pass)).toEqual([true, false, true]);
    expect(drillView(session).lastAttempt?.pass).toBe(true);

    const odd = mk("Bbb", "maj7");
    const fallback: DrillRun = { kind: "shape", form: voicingForms(odd, "shell")[0], chord: odd };
    const r = play(startDrillSession([fallback], "Bbb", HOLD, 1), [strike(shapeNotes(fallback))]);
    expect(drillView(r.session).lastAttempt?.pass).toBe(true);
    expect(r.effects.filter((e) => e.type === "file")).toEqual([]);
  });

  it("a ii–V–I is three runs: a pass moves on to the next one, and new runs mid-wait cancel the move", () => {
    const chords = [mk("D", "m7"), mk("G", "7"), mk("C", "maj7")];
    const path = voiceLeadForms(chords, "shell");
    const runs: DrillRun[] = path.map((form, i) => ({ kind: "shape", form, chord: chords[i] }));
    const s0 = startDrillSession(runs, "C", HOLD, 1);
    const first = play(s0, [strike(shapeNotes(runs[0]))]);
    expect(first.effects.map((e) => e.type)).toEqual(["file", "wait"]);
    const moved = drillStep(first.session, { type: "elapsed", token: waitOf(first.effects)!.token }).session;
    expect(drillView(moved).run).toBe(1);
    expect(drillView(moved).attempts).toEqual([]);

    const second = play(moved, [strike(shapeNotes(runs[1]))]);
    const replaced = drillStep(second.session, { type: "runs", runs, key: "C" }).session;
    const late = drillStep(replaced, { type: "elapsed", token: waitOf(second.effects)!.token });
    expect(late.effects).toEqual([]);
    expect(drillView(late.session).run).toBe(0);
  });
});

describe("voiceMotion: how the voices got from one chord to the next", () => {
  it("counts held voices, spells each moving voice in its chord with its interval, and says the bass separately", () => {
    const { steps } = conceptDrillSteps("functional.secondaryTwoFive", "C");
    // Dm9 [38|60,64,65,69] → G7♭9 [43|59,62,65,68]: F held; C→B, E→D, A→A♭
    expect(voiceMotion(steps[0], steps[1])).toBe("1 held · C→B (−1) · E→D (−2) · A→A♭ (−1) · bass D→G");
  });

  it("names a shape's colour tones from the chord (a ii–V–I's shells, bass first)", () => {
    const chords = [mk("D", "m7"), mk("G", "7"), mk("C", "maj7")];
    const [dm, g7] = voiceLeadForms(chords, "shell");
    // D38 F53 C60 → G43 F53 B59
    expect(voiceMotion(voicedForm(dm, chords[0]), voicedForm(g7, chords[1]))).toBe("1 held · C→B (−1) · bass D→G");
  });
});
