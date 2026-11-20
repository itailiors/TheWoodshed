import { readFileSync } from "node:fs";
import { buildPathway, BUNDLED_TUNES, canonicalLesson, generateMoves, hasRuleLesson, KEYS, lessonForMove, RULES, type Lesson } from "@reharm/theory-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noteBus, type NoteMsg } from "../../midi/noteBus";
import { askIsOpen, pressKey, TAP_MS } from "./stepperInput";

vi.mock("../../audio/player", () => ({ player: { playNotes: vi.fn(() => Promise.resolve()) } }));

/*
 * Grader isolation, the heatmap half (PLAN safety rule 3). Study's improv heatmap (behind "Solo
 * over it") hears the note bus and SAVES a run from what it hears (`ImprovHeatmap.tsx`:
 * `useNoteBus` → notes → `savePass` → `saveImprovRun`). A lesson stepper can share the screen
 * with it, so while it's mounted App turns the stepper's asks off, and with asks off no key the
 * stepper offers reaches the bus: the heatmap's only way in.
 */

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

/** Every lesson Study can show: each bundled tune's moves at every level, and every rule's canonical lesson in all 12 keys. */
function everyLesson(): Lesson[] {
  const out: Lesson[] = [];
  for (const tune of BUNDLED_TUNES) {
    const { accepted } = generateMoves(tune);
    for (const m of buildPathway(accepted, 4)) {
      const l = lessonForMove(m);
      if (l) out.push(l);
    }
  }
  for (const { id } of RULES.filter((r) => hasRuleLesson(r.id))) {
    for (const k of KEYS) {
      const l = canonicalLesson(id, k);
      if (l) out.push(l);
    }
  }
  return out;
}

describe("stepper keys never reach the heatmap's save path", () => {
  const heard: NoteMsg[] = [];
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    heard.length = 0;
    // the heatmap's listener, as it subscribes: anything here would be graded and saved
    off = noteBus.on((m) => heard.push(m));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  const lessons = everyLesson();
  const asks = lessons.flatMap((l) => l.steps.filter((s) => s.ask));

  it("covers real asks", () => {
    expect(lessons.length).toBeGreaterThan(60);
    expect(asks.length).toBeGreaterThan(60);
  });

  it("with asks off (the heatmap mounted), no ask is open and every key stays off the bus", () => {
    for (const step of asks) {
      const open = askIsOpen(step, false, undefined);
      expect(open).toBe(false);
      for (let m = 36; m <= 96; m++) pressKey(m, open);
    }
    vi.advanceTimersByTime(TAP_MS * 2);
    expect(heard).toEqual([]);
  });

  it("control: with asks on and no heatmap, an open ask does put the key on the bus, with its note-off", () => {
    const step = asks[0];
    const open = askIsOpen(step, true, undefined);
    expect(open).toBe(true);
    pressKey(60, open);
    vi.advanceTimersByTime(TAP_MS);
    expect(heard.map((m) => `${m.type}${m.note}`)).toEqual(["on60", "off60"]);
    // answered or shown: closed again, so keys stop reaching the bus
    expect(askIsOpen(step, true, "shown")).toBe(false);
    expect(askIsOpen({ ...step, ask: undefined }, true, undefined)).toBe(false);
  });

  it("is wired that way: App ties asks to Solo over it, MoveCard and the stepper pass it through", () => {
    const app = src("../../App.tsx");
    // the heatmap mounts only inside the Solo over it reveal (folded = unmounted)…
    expect(app).toMatch(/<Reveal label="🎹 Solo over it" open=\{soloOpen\}[\s\S]*?<ImprovHeatmap[\s\S]*?<\/Reveal>/);
    // …and every move card's asks are off exactly while it's open
    expect(app).toMatch(/<MoveCard[\s\S]*?asksEnabled=\{!soloOpen\}[\s\S]*?\/>/);
    expect(src("../MoveCard.tsx")).toMatch(/<LessonStepper[\s\S]*?asksEnabled=\{asksEnabled\}/);
    const stepper = src("./LessonStepper.tsx");
    expect(stepper).toMatch(/const askOpen = askIsOpen\(step, asksEnabled, revealed\[at\]\);/);
    // the stepper's keys and its answer listener go through the gate, and nothing else emits
    expect(stepper).toMatch(/onKey=\{\(m\) => pressKey\(m, askOpen\)\}/);
    expect(stepper).toMatch(/useTapAnswer\([^)]*askOpen/);
    expect(stepper).not.toMatch(/noteBus/);
  });

  it("the heatmap's only way in is the note bus", () => {
    const heat = src("../practice/ImprovHeatmap.tsx");
    expect(heat.match(/useNoteBus\(/g)).toHaveLength(1);
    expect(heat).not.toMatch(/noteBus\.on\(|useChordStrikes|onmidimessage/);
    // saving happens only in savePass
    expect(heat.match(/saveImprovRun\(/g)).toHaveLength(1);
  });
});
