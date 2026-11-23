import { describe, expect, it } from "vitest";
import { AudioGate, type GateTimers } from "./audioGate";

/** Manual clock: `tick()` fires every pending timer. */
function fakeTimers() {
  const pending = new Map<number, () => void>();
  let id = 0;
  const timers: GateTimers = {
    set: (fn) => {
      pending.set(++id, fn);
      return id;
    },
    clear: (i) => void pending.delete(i as number),
  };
  const tick = () => {
    const fns = [...pending.values()];
    pending.clear();
    fns.forEach((f) => f());
  };
  return { timers, tick, pending };
}

function setup() {
  const t = fakeTimers();
  let notified = 0;
  const gate = new AudioGate(() => notified++, 700, t.timers);
  return { gate, ...t, notified: () => notified };
}

describe("AudioGate", () => {
  it("a suspended context on its own (pre-warm, no request) is not blocked", () => {
    const { gate, tick } = setup();
    gate.setState("suspended");
    tick();
    expect(gate.blocked).toBe(false);
  });

  it("a request the context wakes for within the grace never shows the warning (a click on Play)", () => {
    const { gate, tick, notified } = setup();
    gate.setState("suspended");
    gate.want();
    gate.setState("running");
    tick();
    expect(gate.blocked).toBe(false);
    expect(notified()).toBe(0);
  });

  it("a request that stays asleep past the grace is blocked (MIDI after a refresh), and running clears it", () => {
    const { gate, tick, notified } = setup();
    gate.setState("suspended");
    gate.want();
    expect(gate.blocked).toBe(false);
    tick();
    expect(gate.blocked).toBe(true);
    gate.setState("running");
    expect(gate.blocked).toBe(false);
    expect(notified()).toBe(2);
  });

  it("a request before the engine exists waits for its state", () => {
    const { gate, tick } = setup();
    gate.want(); // state "none": engine still loading
    tick();
    expect(gate.blocked).toBe(false);
    gate.setState("suspended");
    tick();
    expect(gate.blocked).toBe(true);
  });

  it("an interruption while the band plays is blocked without a new request (iOS call)", () => {
    const { gate, tick } = setup();
    gate.setState("running");
    gate.setState("interrupted", true);
    tick();
    expect(gate.blocked).toBe(true);
  });

  it("an idle suspension (tab in the background, nothing playing) is not blocked", () => {
    const { gate, tick } = setup();
    gate.setState("running");
    gate.setState("suspended", false);
    tick();
    expect(gate.blocked).toBe(false);
  });

  it("requests while already running cost nothing", () => {
    const { gate, pending } = setup();
    gate.setState("running");
    gate.want();
    expect(pending.size).toBe(0);
  });

  it("a closed context is never reported as blocked", () => {
    const { gate, tick } = setup();
    gate.want();
    gate.setState("closed");
    tick();
    expect(gate.blocked).toBe(false);
  });
});
