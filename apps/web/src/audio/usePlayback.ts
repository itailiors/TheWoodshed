import type { TimePos } from "@reharm/theory-core";
import { useCallback, useEffect, useState } from "react";
import { player, type Arrangement, type InstrumentSource } from "./player";

export type PlaybackStatus = "idle" | "loading" | "playing" | "error";

/** React face of the shared player. Changing `arrangement` while playing swaps the chords in seamlessly. */
export function usePlayback(arrangement: Arrangement, tempo: number) {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [source, setSource] = useState<InstrumentSource | null>(null);
  const [position, setPosition] = useState<TimePos | null>(null);

  useEffect(() => {
    const off = player.onPosition((pos) => {
      setPosition(pos);
      // A null position means the player stopped (including being torn down by a hot reload).
      if (pos === null) setStatus((s) => (s === "playing" ? "idle" : s));
    });
    return () => {
      off();
      player.stop();
    };
  }, []);

  // Rebuild the part whenever chords / loop change. Only once audio is unlocked.
  useEffect(() => {
    if (status === "playing" || status === "idle") {
      if (player.source) player.update(arrangement, tempo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement]);

  useEffect(() => {
    if (player.source) player.setTempo(tempo);
  }, [tempo]);

  const toggle = useCallback(async () => {
    if (player.playing) {
      player.stop();
      setStatus("idle");
      return;
    }
    try {
      setStatus("loading");
      setSource(await player.init());
      player.update(arrangement, tempo);
      await player.play();
      setStatus("playing");
    } catch (err) {
      console.error("[audio] could not start playback", err);
      setStatus("error");
    }
  }, [arrangement, tempo]);

  return { status, source, position, toggle };
}
