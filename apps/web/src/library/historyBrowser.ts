import { summariseProgress } from "@reharm/theory-core";
import type { Backend } from "./localPractice";
import type { CoachRunResult, CoachRunWrite, ImprovRunInput, PracticeHistory, Progress } from "./practice";

/*
 * Practice history kept in this browser: the static demo's adapter (it has no API). Runs are
 * graded, scheduled and summarised by the same theory-core functions the server uses.
 *
 * Until the visitor saves a run, `progress()` returns the seeded sample notebook, marked
 * `sample` so the UI labels it. `due()` never does: the sample is someone else's practice, so
 * it never orders a drill or a review (rule 11).
 */

export interface BrowserHistoryDeps {
  store: () => Promise<Backend>;
  /** The sample notebook, shown before the first saved run (lazy, so normal builds don't carry it). */
  sample: () => Promise<Progress>;
  /** The browser refused storage: runs last only as long as this tab. Called after each such save. */
  onTabOnly: () => void;
}

export function browserHistory({ store, sample, onTabOnly }: BrowserHistoryDeps): PracticeHistory {
  const own = async (chart?: string) => {
    const s = await store();
    const all = await s.readAll();
    return {
      summary: summariseProgress(all, new Date(), chart),
      empty: all.attempts.length === 0 && all.improv.length === 0,
      persistent: s.persistent,
    };
  };

  return {
    async saveCoachRun(run: CoachRunWrite): Promise<CoachRunResult> {
      const s = await store();
      const { grade, clean, review } = await s.recordCoachRun(
        { tuneId: run.tuneId, moveId: run.moveId, ruleId: run.ruleId, keyTonic: run.keyTonic, misses: run.misses, leaps: run.leaps },
        new Date(),
      );
      if (!s.persistent) onTabOnly();
      return { grade, clean, review: { ...review, dueAt: review.dueAt.toISOString(), lastReviewedAt: review.lastReviewedAt?.toISOString() ?? null } };
    },

    async saveImprovRun(run: ImprovRunInput) {
      const s = await store();
      await s.recordImprovRun(run, new Date());
      if (!s.persistent) onTabOnly();
      return true;
    },

    async progress(chart) {
      const local = await own(chart);
      if (local.empty) return { ...(await sample()), sample: true };
      return { ...local.summary, storedIn: local.persistent ? "browser" : "tab" };
    },

    async due() {
      return (await own()).summary.due;
    },
  };
}
