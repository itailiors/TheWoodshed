/**
 * When to tell the user the browser is holding the sound back.
 *
 * A suspended AudioContext is normal before the first click (the engine pre-warms without
 * one), so "suspended" alone says nothing. It becomes a problem when something *asks* for
 * sound and the context stays asleep: MIDI notes after a page refresh (MIDI messages aren't
 * user gestures), or iOS interrupting the context mid-tune (a call, an app switch).
 *
 * `blocked` turns on only after a short grace period, because a click on Play is itself the
 * gesture that wakes the context; without the grace the warning would flash on every first
 * Play. It turns off the moment the context runs. Tone-free, so it's unit-tested directly.
 */
export type ContextState = "none" | "running" | "suspended" | "interrupted" | "closed";

export interface GateTimers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

const realTimers: GateTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export const BLOCKED_GRACE_MS = 700;

export class AudioGate {
  private state: ContextState = "none";
  /** A sound was asked for since the context last ran. */
  private wanted = false;
  private timer: unknown = null;
  blocked = false;

  constructor(
    private notify: () => void,
    private graceMs = BLOCKED_GRACE_MS,
    private timers: GateTimers = realTimers,
  ) {}

  /** Something wants to be heard (Play, a key, an audition). */
  want() {
    if (this.state === "running") return;
    this.wanted = true;
    this.arm();
  }

  /** The context changed state. `playing`: the band was running, so a drop to suspended is a problem even without a new request. */
  setState(s: string, playing = false) {
    this.state = s === "running" || s === "suspended" || s === "interrupted" || s === "closed" ? s : "none";
    if (this.state === "running") {
      this.wanted = false;
      this.disarm();
      this.set(false);
      return;
    }
    if (playing) this.wanted = true;
    if (this.wanted) this.arm();
    else this.set(false);
  }

  dispose() {
    this.disarm();
  }

  private arm() {
    if (this.timer !== null) return;
    this.timer = this.timers.set(() => {
      this.timer = null;
      this.set(this.wanted && (this.state === "suspended" || this.state === "interrupted"));
    }, this.graceMs);
  }

  private disarm() {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  private set(b: boolean) {
    if (b === this.blocked) return;
    this.blocked = b;
    this.notify();
  }
}
