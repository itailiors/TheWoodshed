import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pedal } from "./pedal";

/*
 * Sustain-pedal policy (CLAUDE.md rule 13): the pedal is SOUND ONLY.
 *  - `midi/monitor.ts` honours CC64 so released keys ring through the app's piano.
 *  - Everything that grades or draws (chord strikes, the Coach, the heatmap, Changes) reads
 *    `noteBus`, which carries keys only: a key let go under the pedal is a note-off there.
 *    The Coach grades what your fingers hold; a pedal smear can't make a sloppy change pass.
 *  - CC64 never moves the reharm dial (only CC1 / CC11 can be linked).
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const all = files(SRC).map((f) => ({ rel: relative(SRC, f).replace(/\\/g, "/"), src: code(readFileSync(f, "utf8")) }));

describe("sustain pedal is sound-only", () => {
  it("only the sound monitor and the level pedal listen to the control bus", () => {
    const listeners = all.filter((f) => /controlBus\.on\(|useControlBus\(/.test(f.src) && f.rel !== "midi/controlBus.ts").map((f) => f.rel);
    expect(listeners.sort()).toEqual(["midi/monitor.ts", "midi/pedal.ts"]);
  });

  it("the monitor never feeds pedal-held notes back into the note bus", () => {
    const monitor = all.find((f) => f.rel === "midi/monitor.ts")!;
    expect(monitor.src).not.toMatch(/noteBus\.emit/);
  });

  it("strike grouping knows nothing about the pedal", () => {
    const bus = all.find((f) => f.rel === "midi/noteBus.ts")!;
    expect(bus.src).not.toMatch(/controlBus|\b64\b|sustain/i);
  });

  it("CC64 never moves a linked reharm dial", () => {
    const levels: number[] = [];
    const off = pedal.onLevel((l) => levels.push(l));
    pedal.setLinked(true);
    pedal.input(64, 127);
    pedal.input(64, 0);
    expect(levels).toEqual([]);
    expect(pedal.get().value).toBeNull();
    pedal.setLinked(false);
    off();
  });
});
