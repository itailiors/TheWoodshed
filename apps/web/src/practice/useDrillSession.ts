import {
  drillKeyOrder,
  drillStep,
  drillView,
  startDrillSession,
  type DrillEffect,
  type DrillEvent,
  type DrillRecord,
  type DrillRun,
  type DrillView,
  type KeyPlan,
} from "@reharm/theory-core";
import { useEffect, useReducer, useRef, useState } from "react";
import { fetchProgress, saveCoachRun, saveShapeRun, type CoachRunResult } from "../library/practice";

/*
 * The web side of a drill session (theory-core's `drillSession`): the session lives in a ref,
 * events go through `drillStep`, and its effects run right there in the event handler (never
 * during render, so StrictMode's double render can't repeat a filing). This hook owns the timers
 * and the saving; the page owns the delay, the tap-in notes, the red pen and Study mode.
 */

interface Options {
  /** The targets. New content (a new key, move, form or source) starts the session from the first run. */
  runs: readonly DrillRun[];
  keyTonic: string;
  /** The key flow (the 12-key drill starts through `startTwelveKey`). */
  flow: KeyPlan & { kind: "flow" };
  /** How long a `wait` lasts: Coach 1400 ms, Voicings 900 ms. */
  delayMs: number;
  /** The plan moved the key: the page puts the new key on the stand. */
  onSetKey: (key: string) => void;
  /** Every filed run, as it's filed (the Coach stamps its passport straight away). */
  onFiled?: (record: DrillRecord) => void;
}

/** Same targets, same identity: a re-render that rebuilds equal runs doesn't start the run over. */
const identityOf = (runs: readonly DrillRun[], key: string) =>
  JSON.stringify([
    key,
    runs.map((r) =>
      r.kind === "move"
        ? [r.tuneId, r.moveId, r.ruleId, r.steps.map((s) => [s.symbol, s.target.bass, ...s.target.upper])]
        : [r.form.style, r.form.id, r.form.notes.map((n) => n.midi), r.chord.root, r.chord.quality, r.chord.alterations],
    ),
  ]);

const save = ({ kind: _, ...run }: DrillRecord): Promise<CoachRunResult | null> => ("tuneId" in run ? saveCoachRun(run) : saveShapeRun(run));

export interface DrillSessionApi {
  view: DrillView;
  /** What the scheduler made of this run's filing (null until saved, or once the run starts over). */
  saved: CoachRunResult | null;
  strike: (notes: readonly number[]) => void;
  selfCheck: (pass: boolean) => void;
  restart: () => void;
  goToRun: (index: number) => void;
  stop: () => void;
  changeKey: (key: string, byHand: boolean) => void;
  /** The 12-key drill for one concept: due and weak keys first, from your own history (never the demo's sample). */
  startTwelveKey: (ruleId: string, startKey: string) => Promise<void>;
}

export function useDrillSession({ runs, keyTonic, flow, delayMs, onSetKey, onFiled }: Options): DrillSessionApi {
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const id = identityOf(runs, keyTonic);
  const state = useRef<{ session: ReturnType<typeof startDrillSession>; id: string } | null>(null);
  // render-time sync: pure (a `runs` event has no effects), so a double render is harmless
  if (!state.current) state.current = { session: startDrillSession(runs, keyTonic, flow, seed), id };
  else if (state.current.id !== id) state.current = { session: drillStep(state.current.session, { type: "runs", runs, key: keyTonic }).session, id };

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [saved, setSaved] = useState<{ epoch: number; result: CoachRunResult } | null>(null);
  const latest = useRef({ delayMs, onSetKey, onFiled });
  latest.current = { delayMs, onSetKey, onFiled };
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const mounted = useRef(true);

  const api = useRef<(Omit<DrillSessionApi, "view" | "saved"> & { dispatch: (e: DrillEvent) => void }) | null>(null);
  if (!api.current) {
    const run = (fx: DrillEffect) => {
      if (fx.type === "file") {
        latest.current.onFiled?.(fx.record);
        const epoch = state.current!.session.epoch;
        void save(fx.record).then((r) => r && mounted.current && setSaved({ epoch, result: r }));
      } else if (fx.type === "wait") {
        const t = setTimeout(() => {
          timers.current.delete(t);
          dispatch({ type: "elapsed", token: fx.token });
        }, latest.current.delayMs);
        timers.current.add(t);
      } else latest.current.onSetKey(fx.key);
    };
    const dispatch = (e: DrillEvent) => {
      const s = state.current!;
      const { session, effects } = drillStep(s.session, e);
      s.session = session;
      rerender();
      effects.forEach(run);
    };
    api.current = {
      dispatch,
      strike: (notes) => dispatch({ type: "strike", notes }),
      selfCheck: (pass) => dispatch({ type: "self", pass }),
      restart: () => dispatch({ type: "restart" }),
      goToRun: (index) => dispatch({ type: "goToRun", index }),
      stop: () => dispatch({ type: "stop" }),
      changeKey: (key, byHand) => dispatch({ type: "changeKey", key, byHand }),
      startTwelveKey: async (ruleId, startKey) => {
        const p = await fetchProgress();
        // the demo's sample notebook is someone else's practice: it never orders your drill
        const reviews = p && !p.sample ? p.concepts.filter((r) => r.ruleId === ruleId) : [];
        if (mounted.current) dispatch({ type: "plan", plan: { kind: "lap", keys: drillKeyOrder(reviews, startKey, new Date()) } });
      },
    };
  }

  // a new key flow (the Coach's "new key after every clean run" or circle setting); the guard keeps
  // StrictMode's second effect run from sending it twice
  const lastFlow = useRef(flow.flow);
  useEffect(() => {
    if (lastFlow.current === flow.flow) return;
    lastFlow.current = flow.flow;
    api.current!.dispatch({ type: "plan", plan: flow });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.flow]);

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const view = drillView(state.current.session);
  const { dispatch: _, ...actions } = api.current;
  return { ...actions, view, saved: saved && saved.epoch === view.epoch ? saved.result : null };
}
