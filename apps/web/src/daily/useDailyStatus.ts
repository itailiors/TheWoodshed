import { useEffect, useState } from "react";
import { readDailyStatus, type DailyStatus } from "./dailyStatus";

const read = () => readDailyStatus(() => window.localStorage);

/**
 * Today's Reharm Daily status, re-read whenever it may have changed: back on this tab (focus,
 * visibilitychange), a game finished in another tab (storage), and at local midnight.
 */
export function useDailyStatus(): DailyStatus {
  const [status, setStatus] = useState<DailyStatus>(read);
  useEffect(() => {
    const refresh = () => setStatus((prev) => {
      const next = read();
      return prev.kind === next.kind && (prev.kind === "blocked" || (next.kind === "ok" && prev.unplayed === next.unplayed)) ? prev : next;
    });
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", onVisible);
    // the day rolls over at local midnight: a tab left open overnight shows the new puzzles
    let timer = 0;
    const arm = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => {
        refresh();
        arm();
      }, next.getTime() - now.getTime() + 1000);
    };
    arm();
    refresh();
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(timer);
    };
  }, []);
  return status;
}
