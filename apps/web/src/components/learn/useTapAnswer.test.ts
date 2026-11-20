import { describe, expect, it, vi } from "vitest";
import { noteBus } from "../../midi/noteBus";
import { answerPcs, notLine, tap, TAP_START, tapListener, type TapState } from "./useTapAnswer";

const on = (note: number, source: "midi" | "virtual" | "qwerty" = "midi") => noteBus.emit({ type: "on", note, velocity: 0.8, source });
const off = (note: number) => noteBus.emit({ type: "off", note, velocity: 0, source: "midi" });

describe("tap answers", () => {
  it("E answers F♭ (and the other way round): pitch class, any spelling", () => {
    const fb = answerPcs(["Fb"]);
    expect(tap(TAP_START, fb, 64).done).toBe(true); // E4
    const e = answerPcs(["E"]);
    expect(tap(TAP_START, e, 52).done).toBe(true); // E3, another octave
    expect(answerPcs(["Fb", "E"])).toEqual([4]);
  });

  it("any octave and any order", () => {
    const ans = answerPcs(["B", "F"]);
    const a = tap(TAP_START, ans, 77); // F5 first
    expect(a).toMatchObject({ hits: [5], done: false });
    expect(tap(a, ans, 47).done).toBe(true); // B2
  });

  it("a wrong key is shown but not counted", () => {
    const ans = answerPcs(["B", "F"]);
    const w = tap(TAP_START, ans, 70); // B♭
    expect(w).toEqual({ hits: [], wrong: 10, done: false });
    expect(notLine(10)).toBe("Not B♭");
    const right = tap(w, ans, 71);
    expect(right).toEqual({ hits: [11], wrong: null, done: false });
    // a wrong note between right ones takes nothing away
    const again = tap(right, ans, 60);
    expect(again.hits).toEqual([11]);
    expect(tap(again, ans, 65).done).toBe(true);
  });

  it("repeating a right note doesn't finish a two-note ask", () => {
    const ans = answerPcs(["B", "F"]);
    const s = tap(tap(TAP_START, ans, 59), ans, 71);
    expect(s).toMatchObject({ hits: [11], done: false });
  });

  it("a struck chord answers at once, before any key is let go", () => {
    const states: TapState[] = [];
    const done = vi.fn();
    const stop = noteBus.on(tapListener(answerPcs(["B", "F"]), (s) => states.push(s), done));
    // MIDI chord G3 B3 F4 arriving together
    on(55);
    on(59);
    on(65);
    expect(done).toHaveBeenCalledTimes(1);
    off(55);
    off(59);
    off(65);
    on(59); // later notes change nothing once answered
    expect(done).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toMatchObject({ done: true, hits: [11, 5] });
    stop();
  });

  it("note-offs and other sources' note-offs are ignored; on-screen and computer keys count like MIDI", () => {
    const done = vi.fn();
    const stop = noteBus.on(tapListener(answerPcs(["Db"]), () => {}, done));
    off(61);
    expect(done).not.toHaveBeenCalled();
    on(73, "virtual");
    expect(done).toHaveBeenCalledTimes(1);
    stop();
    const done2 = vi.fn();
    const stop2 = noteBus.on(tapListener(answerPcs(["C#"]), () => {}, done2));
    on(49, "qwerty");
    expect(done2).toHaveBeenCalledTimes(1);
    stop2();
  });
});
