import { generateMoves, type Tune } from "@reharm/theory-core";
import { useEffect, useRef, useState } from "react";
import { pen, wash } from "../../design/tokens";
import type { FromWorker, ToWorker } from "./proofs.worker";

type Status = { state: "waiting" } | { state: "running"; done: number; total: number } | { state: "passed"; runs: number; ms: number } | { state: "failed"; runs: number; reason: string; counterexample: string; seed: number; path?: string };

const RUNS = 200;

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The Proof tab: the engine's claims, checked live in the browser against a few hundred
 * generated tunes each (fast-check, in a Web Worker). Same property definitions as CI.
 * Plus a determinism handshake: the engine's full output for the tune on the stand,
 * hashed on the main thread and in the worker (a separate JS realm) — the hashes match.
 */
export function ProofPanel({ tune }: { tune: Tune }) {
  const worker = useRef<Worker | null>(null);
  const [proofs, setProofs] = useState<{ id: string; title: string; claim: string }[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [run, setRun] = useState<{ seed: number; running: boolean; ms?: number; cases?: number } | null>(null);
  const [hashes, setHashes] = useState<{ main?: string; worker?: string; moves?: number }>({});

  useEffect(() => {
    const w = new Worker(new URL("./proofs.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === "list") setProofs(m.proofs);
      else if (m.type === "progress") setStatus((s) => ({ ...s, [m.id]: { state: "running", done: m.done, total: m.total } }));
      else if (m.type === "passed") setStatus((s) => ({ ...s, [m.id]: { state: "passed", runs: m.runs, ms: m.ms } }));
      else if (m.type === "failed") setStatus((s) => ({ ...s, [m.id]: { state: "failed", runs: m.runs, reason: m.reason, counterexample: m.counterexample, seed: m.seed, path: m.path } }));
      else if (m.type === "finished") setRun((r) => r && { ...r, running: false, ms: m.ms, cases: m.cases });
      else if (m.type === "hash") setHashes((h) => ({ ...h, worker: m.hash, moves: m.moves }));
    };
    return () => w.terminate();
  }, []);

  // the determinism handshake, for the tune on the stand
  useEffect(() => {
    setHashes({});
    void sha256(JSON.stringify(generateMoves(tune))).then((main) => setHashes((h) => ({ ...h, main })));
    worker.current?.postMessage({ type: "hash", tune } satisfies ToWorker);
  }, [tune]);

  const start = (seed: number) => {
    setStatus(Object.fromEntries(proofs.map((p) => [p.id, { state: "waiting" } as Status])));
    setRun({ seed, running: true });
    worker.current?.postMessage({ type: "run", seed, runsPerProof: RUNS } satisfies ToWorker);
  };

  const passed = Object.values(status).filter((s) => s.state === "passed").length;
  const failed = Object.values(status).filter((s) => s.state === "failed").length;
  const match = hashes.main && hashes.worker ? hashes.main === hashes.worker : null;

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-snug">
        Each claim below is a <span className="font-marker">property</span>: fast-check generates random tunes (ii–V–Is in every key, 3/4 and 4/4,
        with and without melodies), runs the real engine on them, and checks the claim holds. These are the same definitions CI runs on every push.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={run?.running || proofs.length === 0}
          onClick={() => start((Math.random() * 2 ** 31) | 0)}
          className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light hover:-rotate-1 disabled:cursor-wait disabled:opacity-60"
        >
          {run?.running ? "Proving…" : `▶ Run ${RUNS} cases × ${proofs.length || "…"} claims`}
        </button>
        {run && !run.running && (
          <button type="button" onClick={() => start(run.seed)} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:bg-paper-shade" title="Replays exactly the same generated cases">
            ↻ Same seed again
          </button>
        )}
        {run && (
          <span className="font-mono text-xs text-ink-soft">
            seed {run.seed}
            {run.cases !== undefined && ` · ${run.cases.toLocaleString()} cases in ${(run.ms! / 1000).toFixed(1)} s`}
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {proofs.map((p) => (
          <ProofRow key={p.id} title={p.title} claim={p.claim} s={status[p.id]} />
        ))}
      </ol>

      {run && !run.running && (
        <p className="font-marker text-lg" style={{ color: failed ? pen.red : undefined }}>
          {failed ? `${failed} claim${failed > 1 ? "s" : ""} failed. The counterexample above is the smallest tune fast-check could find that breaks it.` : `All ${passed} claims held on every case.`}
        </p>
      )}

      {/* determinism handshake */}
      <section className="rounded-lg border-2 border-dashed border-ink-faint p-3">
        <h4 className="font-marker text-sm uppercase tracking-wider">Determinism handshake</h4>
        <p className="text-sm text-ink-soft">
          The engine's complete output for <span className="italic">{tune.title}</span> ({hashes.moves ?? "…"} moves), hashed with SHA-256 here and, independently, inside
          the worker:
        </p>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
          <dt>main thread</dt>
          <dd className="truncate">{hashes.main ?? "…"}</dd>
          <dt>web worker</dt>
          <dd className="truncate">{hashes.worker ?? "…"}</dd>
        </dl>
        {match !== null && (
          <p className="mt-1 font-marker" style={{ color: match ? undefined : pen.red }}>
            {match ? "✓ identical: same input, same output, in two separate JavaScript realms" : "✗ the hashes differ"}
          </p>
        )}
      </section>
    </div>
  );
}

function ProofRow({ title, claim, s }: { title: string; claim: string; s?: Status }) {
  const pct = !s || s.state === "waiting" ? 0 : s.state === "running" ? (s.done / s.total) * 100 : 100;
  const failed = s?.state === "failed";
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <span className="pt-0.5 text-center font-marker text-lg" style={{ color: failed ? pen.red : s?.state === "passed" ? pen.red : "var(--color-ink-faint)" }} aria-hidden>
        {s?.state === "passed" ? "✓" : failed ? "✗" : s?.state === "running" ? "…" : "○"}
      </span>
      <div className="min-w-0">
        <p className="font-marker">
          {title}
          {s?.state === "passed" && <span className="ml-2 font-mono text-xs font-normal text-ink-soft">{s.runs} cases · {Math.round(s.ms)} ms</span>}
        </p>
        <p className="text-sm text-ink-soft">{claim}</p>
        {/* ink progress line */}
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-faint/25">
          <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: failed ? pen.red : wash.blue }} />
        </div>
        {failed && s.state === "failed" && (
          <div className="mt-2 space-y-1 rounded border-2 p-2 text-sm" style={{ borderColor: pen.red }}>
            <p style={{ color: pen.red }}>{s.reason}</p>
            <p className="break-all font-mono text-xs">counterexample: {s.counterexample}</p>
            <p className="font-mono text-xs text-ink-soft">
              replay: seed {s.seed}
              {s.path && `, path ${s.path}`}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
