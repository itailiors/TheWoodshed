import { describe, expect, it } from "vitest";
import { BUNDLED_TUNES, referenceTune } from "../src";
import { chordTones, symbol } from "../src/chords";
import { hintToVoicing } from "../src/coach";
import { generateMoves } from "../src/engine";
import { catchMoves, catchMovesTraced, type Strike } from "../src/harmonyCatcher";
import { chroma, midiOf, mod } from "../src/pitch";
import { absBeat, sortedHarmony } from "../src/time";
import type { ChordEvent, ReharmMove, Tune } from "../src/types";

const bpb = (t: Tune) => t.meter[0];

/** Root (or slash bass) in the left hand, every chord tone above: an unambiguous grip. */
const rootful = (c: ChordEvent) => {
  const v = hintToVoicing({ lh: [c.bass ?? c.root], rh: chordTones(c).map((t) => t.note) });
  return [v.bass, ...v.upper];
};
/** Rootless: drop the root and 5th, keep 3rd, 7th and colours (the Bill Evans A/B idea). */
const rootless = (c: ChordEvent) => {
  let prev = 51;
  return chordTones(c)
    .filter((t) => t.degree !== "1" && t.degree !== "5")
    .map((t) => (prev = prev + 1 + mod(chroma(t.note) - (prev + 1), 12)));
};

const strikesOf = (t: Tune, chords: ChordEvent[], voice = rootful): Strike[] =>
  chords.map((c) => ({ beat: absBeat(c.at, bpb(t)), notes: voice(c) }));

/** The whole chorus as written, with one move's chords in place of the ones it replaces. */
function playMove(t: Tune, move: ReharmMove, voice = rootful): Strike[] {
  const kept = sortedHarmony(t).filter((c) => !move.replaces.includes(c.id));
  return strikesOf(t, [...kept, ...move.chords], voice).sort((a, b) => a.beat - b.beat);
}

/** The chorus with a voicing move's own grips (its hints, LH up from the bass) in place of its chords. */
function playGrips(t: Tune, move: ReharmMove): Strike[] {
  const kept = sortedHarmony(t).filter((c) => !move.replaces.includes(c.id));
  const grips = move.chords.map((c, i) => {
    const hint = move.voicingHints?.[i] ?? move.voicingHint!;
    const v = hintToVoicing(hint);
    return { beat: absBeat(c.at, bpb(t)), notes: [v.bass, ...v.upper] };
  });
  return [...strikesOf(t, kept), ...grips].sort((a, b) => a.beat - b.beat);
}

const harmonicMoves =(t: Tune) => generateMoves(t).accepted.filter((m) => m.category !== "voicing" && m.ruleId !== "melody.oneNoteOnTop");
const move = (id: string) => {
  const m = generateMoves(referenceTune).accepted.find((x) => x.id === id);
  if (!m) throw new Error(`no move ${id} on ${referenceTune.id}`);
  return m;
};
const same = (a: ReharmMove, b: ReharmMove) =>
  a.spanBeats.start === b.spanBeats.start && a.spanBeats.end === b.spanBeats.end && a.chords.map(symbol).join() === b.chords.map(symbol).join();

describe("catchMoves: the move must explain it, the original must not", () => {
  it(`every harmonic move on ${referenceTune.id}, played in an otherwise plain chorus, is caught, and only it`, () => {
    for (const m of harmonicMoves(referenceTune)) {
      expect(
        catchMoves(referenceTune, playMove(referenceTune, m)).map((c) => c.moveId),
        m.id,
      ).toEqual([m.id]);
    }
  });

  it("every harmonic move on every bundled tune is caught (or an identical move on the same span is)", () => {
    for (const t of BUNDLED_TUNES) {
      const generated = generateMoves(t).accepted;
      const all = harmonicMoves(t);
      for (const m of all) {
        const caught = catchMoves(t, playMove(t, m), { moves: generated }).map((c) => all.find((x) => x.id === c.moveId)!);
        expect(
          caught.some((c) => c.id === m.id || same(c, m)),
          `${t.id} ${m.id}`,
        ).toBe(true);
      }
    }
  });

  it("the changes as written are never caught, rootful or rootless, on every bundled tune", () => {
    for (const t of BUNDLED_TUNES)
      for (const voice of [rootful, rootless]) {
        expect(catchMoves(t, strikesOf(t, sortedHarmony(t), voice)), `${t.id} ${voice.name}`).toEqual([]);
      }
  });

  it("a catch carries the rule, the tune's key and where it starts", () => {
    const m = move("modal.backdoorTwoFive@10.1");
    expect(catchMoves(referenceTune, playMove(referenceTune, m))).toEqual([
      { moveId: m.id, ruleId: "modal.backdoorTwoFive", title: m.title, level: m.level, keyTonic: referenceTune.key.tonic, bar: 10, beat: 1 },
    ]);
  });

  it("tritone sub: a rootless G♭9 over C7 is just C7alt; with G♭ in the bass it's the sub", () => {
    const sub = move("dominant.tritoneSub@10.1");
    const caughtIds = (s: Strike[]) => catchMoves(referenceTune, s).map((c) => c.moveId);
    expect(caughtIds(playMove(referenceTune, sub, rootless))).not.toContain(sub.id);
    expect(caughtIds(playMove(referenceTune, sub, rootful))).toContain(sub.id);
    const trace = catchMovesTraced(referenceTune, playMove(referenceTune, sub, rootless));
    expect(trace.attempts.find((a) => a.moveId === sub.id)?.outcome).toBe("same-as-original");
  });

  it("an anticipation an eighth early counts; a quarter early doesn't", () => {
    const m = move("modal.backdoorTwoFive@10.1");
    const shifted = (by: number) =>
      playMove(referenceTune, m).map((s) => (s.beat === m.spanBeats.start ? { ...s, beat: s.beat - by } : s));
    expect(catchMoves(referenceTune, shifted(0.5)).map((c) => c.moveId)).toEqual([m.id]);
    expect(catchMoves(referenceTune, shifted(1))).toEqual([]);
  });

  it("an anticipation at the end of the chorus counts for bar 1", () => {
    const m = move("chromatic.constantStructure@1.1");
    const total = Math.max(...sortedHarmony(referenceTune).map((c) => absBeat(c.at, 4) + c.beats));
    const s = playMove(referenceTune, m).map((x) => (x.beat === 0 ? { ...x, beat: total - 0.5 } : x));
    expect(catchMoves(referenceTune, s).map((c) => c.moveId)).toEqual([m.id]);
  });

  it("half a move is no catch", () => {
    const m = move("modal.backdoorTwoFive@10.1");
    const half = playMove(referenceTune, m).filter((s) => s.beat !== m.spanBeats.start + 2);
    half.push({ beat: m.spanBeats.start + 2, notes: rootful(m.original[0]) });
    expect(catchMoves(referenceTune, half)).toEqual([]);
    expect(catchMovesTraced(referenceTune, half).attempts.find((a) => a.moveId === m.id)?.outcome).toBe("incomplete");
  });

  it("a move already in the band's pathway is reading, not discovery", () => {
    const m = move("modal.backdoorTwoFive@10.1");
    expect(catchMoves(referenceTune, playMove(referenceTune, m), { active: [m.id] })).toEqual([]);
    expect(catchMovesTraced(referenceTune, playMove(referenceTune, m), { active: [m.id] }).attempts.find((a) => a.moveId === m.id)?.outcome).toBe("active");
  });

  it("a voicing move needs its shape: D7(♯9,♭13) voiced any old way isn't the B♭ triad over the shell", () => {
    const m = move("voicing.upperStructureBVI@8.3");
    expect(catchMoves(referenceTune, playMove(referenceTune, m))).toEqual([]);
    expect(catchMovesTraced(referenceTune, playMove(referenceTune, m)).attempts.find((a) => a.moveId === m.id)?.outcome).toBe("wrong-shape");
  });

  it("every voicing move on every bundled tune, played with its own grips, is caught", () => {
    let checked = 0;
    for (const t of BUNDLED_TUNES) {
      const generated = generateMoves(t).accepted;
      for (const m of generated.filter((x) => x.category === "voicing")) {
        const caught = catchMoves(t, playGrips(t, m), { moves: generated }).map((c) => c.moveId);
        expect(caught, `${t.id} ${m.id}`).toContain(m.id);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(20); // all three voicing rules fire somewhere in the library
  });

  it("upper structure: the triad on top in any inversion, over a rootless shell too", () => {
    const m = move("voicing.upperStructureBVI@8.3");
    const at = m.spanBeats.start;
    const withChord = (notes: string) => [...sortedHarmony(referenceTune).filter((c) => !m.replaces.includes(c.id)).map((c) => ({ beat: absBeat(c.at, 4), notes: rootful(c) })), { beat: at, notes: notes.split(" ").map(midiOf) }];
    const ids = (notes: string) => catchMoves(referenceTune, withChord(notes)).map((c) => c.moveId);
    expect(ids("D2 C3 F#3 Bb3 D4 F4")).toContain(m.id); // root position triad
    expect(ids("D2 C3 F#3 F4 Bb4 D5")).toContain(m.id); // 2nd inversion: F on the bottom
    expect(ids("C3 F#3 D4 F4 Bb4")).toContain(m.id); // ♭7–3 shell, no root
    expect(ids("D2 C3 F#3 Bb3 F4")).not.toContain(m.id); // B♭ and F without the D: no triad
    expect(ids("D2 Bb2 F#3 C4 F4")).not.toContain(m.id); // the right notes, but the triad isn't on top
  });

  it("rootless ii–V: the A-form ii9 into the B-form V13, root optional underneath; the I isn't needed", () => {
    const t = BUNDLED_TUNES.find((x) => x.id === "sunny-side")!;
    const generated = generateMoves(t).accepted;
    const m = generated.find((x) => x.id === "voicing.rootlessTwoFiveOne@17.1")!;
    const play = (ii: string, v: string) => {
      const kept = sortedHarmony(t).filter((c) => !m.replaces.includes(c.id));
      return [
        ...strikesOf(t, kept),
        { beat: absBeat(m.chords[0].at, 4), notes: ii.split(" ").map(midiOf) },
        { beat: absBeat(m.chords[1].at, 4), notes: v.split(" ").map(midiOf) },
      ];
    };
    const ids = (ii: string, v: string) => catchMoves(t, play(ii, v), { moves: generated }).map((c) => c.moveId);
    expect(ids("Bb3 D4 F4 A4", "Bb3 D4 E4 A4")).toContain(m.id);
    expect(ids("G2 Bb3 D4 F4 A4", "C3 Bb3 D4 E4 A4")).toContain(m.id);
    expect(ids("F3 A3 Bb3 D4", "E3 A3 Bb3 D4")).not.toContain(m.id); // B-form then A-form: the other alternation
    expect(ids("Bb3 D4 F4 A4", "C3 E3 G3 Bb3")).not.toContain(m.id); // plain C7 on the V
  });

  it("is the traced version with the trace dropped", () => {
    const m = move("dominant.tritoneSub@11.3");
    const s = playMove(referenceTune, m);
    expect(catchMoves(referenceTune, s)).toEqual(catchMovesTraced(referenceTune, s).catches);
  });

  it("is key-free: a transposed tune catches the same move ids", async () => {
    const { transposeTune } = await import("../src/transpose");
    const t = transposeTune(referenceTune, "Ab");
    const m = generateMoves(t).accepted.find((x) => x.id === "modal.backdoorTwoFive@10.1")!;
    expect(catchMoves(t, playMove(t, m))).toMatchObject([{ moveId: m.id, keyTonic: "Ab" }]);
  });
});
