import { generateMoves, prettyNote, type Catch, type Tune } from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { player } from "../audio/player";
import { toast } from "../components/Toaster";
import { useChordStrikes } from "../midi/noteBus";
import { createCatcherSession, type CatcherSession } from "./catcherSession";

/*
 * Harmony Catcher in Practice (docs/plans/harmony-catcher.md, 7d): while the band loops the tune,
 * your settled chord strikes (keys only: the pedal never counts, as in the Coach) are matched
 * against the tune's own moves, and one you play unasked is stamped. Opt-in, remembered.
 */

const STORE = "reharm.catcher";

let enabled = false;
try {
  enabled = localStorage.getItem(STORE) === "on";
} catch {
  /* blocked storage: off */
}
const subs = new Set<() => void>();

export const catcherPref = {
  get: () => enabled,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
  toggle() {
    enabled = !enabled;
    try {
      localStorage.setItem(STORE, enabled ? "on" : "off");
    } catch {
      /* not remembered, still works */
    }
    subs.forEach((f) => f());
  },
};

export const useCatcherEnabled = () => useSyncExternalStore(catcherPref.subscribe, catcherPref.get);

/** The stamp's words: "🕵️ Caught: Backdoor ii–V · bar 10, in F". */
export const catchText = (c: Catch) => `🕵️ Caught: ${c.title} · bar ${c.bar}, in ${prettyNote(c.keyTonic)}`;

/** The settle window `useChordStrikes` waits before a strike is reported: the strike began this long before. */
const SETTLE_MS = 45;
const TICK_MS = 250;

export function useHarmonyCatcher(opts: {
  tune: Tune;
  /** The loop in bars, inclusive. */
  loop: { startBar: number; endBar: number };
  /** Move ids the band is playing (the pathway, when the reharm is on). */
  active: string[];
  playing: boolean;
  tempo: number;
  onCatch?: (c: Catch) => void;
}) {
  const on = useCatcherEnabled();
  const listening = on && opts.playing;
  const { tune, loop, tempo } = opts;
  const bpb = tune.meter[0];
  const moves = useMemo(() => (on ? generateMoves(tune).accepted : []), [tune, on]);
  const activeKey = opts.active.join("|");
  const onCatch = useRef(opts.onCatch);
  onCatch.current = opts.onCatch;

  // a fresh session per tune, loop, pathway and play: nothing carries over a stop
  const session = useRef<CatcherSession | null>(null);
  useEffect(() => {
    session.current = listening
      ? createCatcherSession({ tune, moves, loop: { start: (loop.startBar - 1) * bpb, end: loop.endBar * bpb }, active: activeKey ? activeKey.split("|") : [] })
      : null;
  }, [listening, tune, moves, loop.startBar, loop.endBar, bpb, activeKey]);

  const announce = (caught: Catch[]) =>
    caught.forEach((c) => {
      toast(catchText(c), { ttl: 6000 });
      onCatch.current?.(c);
    });

  useChordStrikes((notes) => {
    const beat = player.currentBeat();
    if (beat === null || beat < 0 || !session.current) return;
    announce(session.current.strike(beat - (SETTLE_MS / 1000) * (tempo / 60), notes));
  }, listening);

  // the playhead passing a move's end confirms it, struck or not
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => {
      const beat = player.currentBeat();
      if (beat !== null && beat >= 0 && session.current) announce(session.current.tick(beat));
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  return { on, toggle: catcherPref.toggle };
}
