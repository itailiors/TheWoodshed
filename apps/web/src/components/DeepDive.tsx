import type { ReharmMove } from "@reharm/theory-core";
import { useState } from "react";
import { DEMO, demoExplanation, type Explanation } from "../demo";
import { SketchBox } from "../design/rough";
import { seedOf, wash } from "../design/tokens";
import { reportApiUnreachable, useApiStatus } from "../library/apiStatus";

const memo = new Map<string, Explanation>();

type State =
  | { kind: "idle" | "loading" }
  /** No Claude key on the server: not a failure, just a feature that isn't switched on. */
  | { kind: "no-key" }
  | { kind: "error"; error: string };

/** Asks the API (and Claude behind it) to turn the engine's facts into a written lesson. In the demo build, reads the pre-written one. */
export function DeepDive({ tuneId, move }: { tuneId: string; move: ReharmMove }) {
  const moveId = move.id;
  const api = useApiStatus();
  const [state, setState] = useState<State>({ kind: "idle" });
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
    let res: Response;
    try {
      res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tuneId, moveId, fresh }),
      });
    } catch {
      reportApiUnreachable();
      setState({ kind: "error", error: "Can't reach the API right now, so the deep dive is paused. The engine's explanation above still stands." });
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body) {
      memo.set(moveId, body);
      setData(body);
      setState({ kind: "idle" });
    } else if (body?.code === "no_key") {
      setState({ kind: "no-key" });
    } else {
      if (res.status === 502 || res.status === 504) reportApiUnreachable(); // the dev proxy's "API is down"
      setState({ kind: "error", error: body?.error ?? `The deep dive failed (HTTP ${res.status}). The engine's explanation above still stands.` });
    }
  };

  // The health check already told us there's no key: say so up front instead of offering a button that can't work.
  const noKey = state.kind === "no-key" || (!DEMO && api.state === "online" && api.claudeKey === false);
  const offline = !DEMO && api.state === "offline";

  if (!data && noKey) {
    return (
      <p className="rounded border-2 border-dashed border-ink-faint px-3 py-2 text-sm text-ink-soft" role="note">
        <span className="font-marker text-ink">✍ Deep dive needs a Claude key.</span> The engine's own explanation above is the full analysis. To have
        Claude write it up as a lesson, add <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to <code className="font-mono text-xs">apps/api/.env</code>{" "}
        and restart the API.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => load()}
          disabled={state.kind === "loading" || offline}
          title={offline ? "The API is offline" : undefined}
          className="cursor-pointer rounded-full border-2 border-ink px-4 py-1 font-marker hover:bg-paper-shade disabled:cursor-not-allowed disabled:opacity-50"
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
          {!DEMO && !noKey && !offline && (
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
