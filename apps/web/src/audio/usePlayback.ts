import type { TimePos } from "@reharm/theory-core";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { player, type Arrangement, type CountInBars, type InstrumentSource } from "./player";

export type PlaybackStatus = "idle" | "loading" | "playing" | "error";

const subscribeCount = (cb: () => void) => player.onCount(cb);

/** React face of the shared player. Changing `arrangement` while playing swaps the chords in seamlessly. */
export function usePlayback(arrangement: Arrangement, tempo: number) {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [source, setSource] = useState<InstrumentSource | null>(null);
  const [bandSource, setBandSource] = useState(player.bandSource);
  const [position, setPosition] = useState<TimePos | null>(null);
  /** Increments on every beat, so a pulse re-fires even when the position repeats (a 1-bar loop). */
  const [beatTick, setBeatTick] = useState(0);
  const count = useSyncExternalStore(subscribeCount, () => player.count);
  const countInBars = useSyncExternalStore(subscribeCount, () => player.countInBars);

  // play() may run in the same tick as a state change (e.g. "practice this move" sets the
  // loop and starts playback at once), so it reads the newest arrangement from a ref.
  const latest = useRef({ arrangement, tempo });
  latest.current = { arrangement, tempo };

  useEffect(() => {
    const off = player.onPosition((pos) => {
      setPosition(pos);
      if (pos) setBeatTick((t) => t + 1);
      // A null position means the player stopped (including being torn down by a hot reload).
      else setStatus((s) => (s === "playing" ? "idle" : s));
    });
    return () => {
      off();
      player.stop();
    };
  }, []);

  // Rebuild the parts whenever chords / loop change. Only once audio is unlocked.
  useEffect(() => {
    if (status === "playing" || status === "idle") {
      if (player.source) player.update(arrangement, tempo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement]);

  useEffect(() => {
    if (player.source) player.setTempo(tempo);
  }, [tempo]);

  /** Start (from the top of the loop, after the count-in). A no-op if already playing. */
  const play = useCallback(async () => {
    if (player.playing) return;
    try {
      setStatus("loading");
      setSource(await player.init());
      setBandSource(player.bandSource);
      player.update(latest.current.arrangement, latest.current.tempo);
      await player.play();
      setStatus("playing");
    } catch (err) {
      console.error("[audio] could not start playback", err);
      setStatus("error");
    }
  }, []);

  const toggle = useCallback(async () => {
    if (player.playing) {
      player.stop();
      setStatus("idle");
      return;
    }
    await play();
  }, [play]);

  const setCountIn = useCallback((bars: CountInBars) => player.setCountIn(bars), []);

  return { status, source, bandSource, position, beatTick, count, countInBars, setCountIn, play, toggle };
}

export type Playback = ReturnType<typeof usePlayback>;
