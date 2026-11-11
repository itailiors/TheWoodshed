import { useCallback, useSyncExternalStore } from "react";
import { player, type Instrument } from "./player";

/** The trio mixer, shared by every view (the state lives on the one player). */
export function useMixer() {
  const mix = useSyncExternalStore(
    (cb) => player.onMix(cb),
    () => player.mix,
  );
  const toggle = useCallback((inst: Instrument) => player.setMix(inst, !player.mix[inst]), []);
  return { mix, toggle };
}
