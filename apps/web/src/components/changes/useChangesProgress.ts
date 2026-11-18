import { LEVELS, masteryProgress, motionOfRuleId, type EarMotionId, type LevelId, type Mastery } from "@reharm/theory-core";
import { useEffect, useState } from "react";
import { fetchChangesSessions, fetchEarDue, onPracticeSaved, type DueItem } from "../../library/practice";
import type { ChangesSessionRecord } from "../../library/localPractice";

/*
 * What the game remembers between visits: every saved session (in this browser) and the
 * scheduler's due `ear:*` reviews. From them, each level's mastery and the "next up" level:
 * the first one not yet mastered.
 */

export interface ChangesProgress {
  sessions: ChangesSessionRecord[];
  mastery: Record<LevelId, Mastery>;
  nextUp: LevelId | null;
  due: DueItem[];
  totalPoints: number;
}

/** The lowest level that teaches a motion: where its reviews are played. */
export const levelFor = (m: EarMotionId): LevelId => LEVELS.find((l) => l.motions.includes(m))!.id;

export function progressFrom(sessions: ChangesSessionRecord[], due: DueItem[]): ChangesProgress {
  const mastery = Object.fromEntries(
    LEVELS.map((l) => [l.id, masteryProgress(l.id, sessions.filter((s) => s.level === l.id).flatMap((s) => s.answers), l.keys)]),
  ) as Record<LevelId, Mastery>;
  return {
    sessions,
    mastery,
    nextUp: LEVELS.find((l) => !mastery[l.id].mastered)?.id ?? null,
    due: due.filter((d) => motionOfRuleId(d.ruleId) !== null),
    totalPoints: sessions.reduce((n, s) => n + s.points, 0),
  };
}

export function useChangesProgress(): ChangesProgress | null {
  const [p, setP] = useState<ChangesProgress | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      void Promise.all([fetchChangesSessions(), fetchEarDue()]).then(([sessions, due]) => live && setP(progressFrom(sessions, due)));
    load();
    const off = onPracticeSaved(load);
    return () => {
      live = false;
      off();
    };
  }, []);
  return p;
}
