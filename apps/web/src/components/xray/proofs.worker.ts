/// <reference lib="webworker" />
import { generateMoves, type Tune } from "@reharm/theory-core";
import { PROOFS } from "@reharm/theory-core/testing";
import fc from "fast-check";

/*
 * Runs the engine's property-based proofs off the main thread. These are the exact Proof
 * objects CI asserts (packages/theory-core/test/proofs.test.ts). Each claim is checked in
 * small batches of generated cases, so the page can show them passing live.
 */

export type ToWorker = { type: "run"; seed: number; runsPerProof: number } | { type: "hash"; tune: Tune };

export type FromWorker =
  | { type: "list"; proofs: { id: string; title: string; claim: string }[] }
  | { type: "progress"; id: string; done: number; total: number; ms: number }
  | { type: "passed"; id: string; runs: number; ms: number }
  | { type: "failed"; id: string; runs: number; reason: string; counterexample: string; seed: number; path?: string }
  | { type: "finished"; ms: number; cases: number }
  | { type: "hash"; hash: string; moves: number };

const BATCH = 25;
const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

post({ type: "list", proofs: PROOFS.map(({ id, title, claim }) => ({ id, title, claim })) });

/** SHA-256 of the engine's full output, to compare with the same computation on the main thread. */
export async function engineHash(tune: Tune) {
  const out = JSON.stringify(generateMoves(tune));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(out));
  return {
    hash: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
    moves: JSON.parse(out).accepted.length as number,
  };
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "hash") {
    post({ type: "hash", ...(await engineHash(msg.tune)) });
    return;
  }
  const t0 = performance.now();
  let cases = 0;
  for (const p of PROOFS) {
    const start = performance.now();
    const prop = p.property();
    let done = 0;
    let failed = false;
    for (let batch = 0; done < msg.runsPerProof; batch++) {
      const n = Math.min(BATCH, msg.runsPerProof - done);
      // Each batch has its own seed, derived from the run's seed: re-running a seed replays
      // exactly the same cases, which is itself a determinism check.
      const seed = (msg.seed + batch * 7919) | 0;
      const res = fc.check(prop, { numRuns: n, seed });
      done += n;
      cases += n;
      if (res.failed) {
        post({
          type: "failed",
          id: p.id,
          runs: done,
          reason: res.errorInstance instanceof Error ? res.errorInstance.message : String(res.errorInstance),
          counterexample: fc.stringify(res.counterexample),
          seed,
          path: res.counterexamplePath ?? undefined,
        });
        failed = true;
        break;
      }
      post({ type: "progress", id: p.id, done, total: msg.runsPerProof, ms: performance.now() - start });
      // yield between batches so progress messages flush
      await new Promise((r) => setTimeout(r, 0));
    }
    if (!failed) post({ type: "passed", id: p.id, runs: done, ms: performance.now() - start });
  }
  post({ type: "finished", ms: performance.now() - t0, cases });
};
