import type { ReharmMove } from "@reharm/theory-core";
import { useState } from "react";
import { DEMO, demoExplanation, type Explanation } from "../demo";
import { SketchBox } from "../design/rough";
import { seedOf, wash } from "../design/tokens";

const memo = new Map<string, Explanation>();

/** Asks the API (and Claude behind it) to turn the engine's facts into a written lesson. In the demo build, reads the pre-written one. */
export function DeepDive({ tuneId, move }: { tuneId: string; move: ReharmMove }) {
  const moveId = move.id;
  const [state, setState] = useState<{ kind: "idle" | "loading" | "error"; error?: string }>({ kind: "idle" });
  const [data, setData] = useState<Explanation | null>(memo.get(moveId) ?? null);

  const load = async (fresh = false) => {
    setState({ kind: "loading" });
    if (DEMO) {
      const e = await demoExplanation(move);
      memo.set(moveId, e);
      setData(e);
      setState({ kind: "idle" });
      return;
    }
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tuneId, moveId, fresh }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        const fallback = res.status === 404 || res.status >= 500 ? "Is the API running? Start it with: npm run dev:api" : `HTTP ${res.status}`;
        throw new Error(body?.error ?? fallback);
      }
      memo.set(moveId, body);
      setData(body);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", error: err instanceof Error ? err.message : String(err) });
    }
  };

  if (!data) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => load()}
          disabled={state.kind === "loading"}
          className="cursor-pointer rounded-full border-2 border-ink px-4 py-1 font-marker hover:bg-paper-shade disabled:cursor-wait"
        >
          {state.kind === "loading" ? "✍ Claude is writing the deep dive…" : "✍ Deep dive"}
        </button>
        {state.kind === "error" && <p className="text-sm text-wash-brick">{state.error}</p>}
      </div>
    );
  }

  return (
    <SketchBox seed={seedOf(moveId + "deep")} fill={wash.blue} fillStyle="hachure" className="rotate-[0.4deg]">
      <section className="m-1.5 space-y-2 bg-paper-light/85 p-3 text-[15px] leading-relaxed">
        <h4 className="font-marker text-sm font-bold uppercase tracking-wider">Deep dive</h4>
        <p className="font-bold">{data.summary}</p>
        {data.deepDive.split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p>
          <span className="font-marker font-bold">Rule of thumb: </span>
          {data.recreateRule}
        </p>
        <p className="flex items-center justify-between gap-2 text-xs text-ink-faint">
          <span>
            Written by {data.model} from the engine's computed facts{data.cached ? " · cached" : ""}
          </span>
          {!DEMO && (
            <button type="button" onClick={() => load(true)} disabled={state.kind === "loading"} className="cursor-pointer underline">
              {state.kind === "loading" ? "rewriting…" : "rewrite"}
            </button>
          )}
        </p>
        {state.kind === "error" && <p className="text-sm text-wash-brick">{state.error}</p>}
      </section>
    </SketchBox>
  );
}
