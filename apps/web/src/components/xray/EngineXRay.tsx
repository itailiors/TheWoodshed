import { densityLabel, formBars, type ReharmMove, type Tune } from "@reharm/theory-core";
import { useEffect, useState } from "react";
import { SketchBox } from "../../design/rough";
import { LEVELS, paper, seedOf } from "../../design/tokens";
import { ProofPanel } from "./ProofPanel";
import { XRayPipeline } from "./XRayPipeline";

interface Props {
  tune: Tune;
  level: number;
  forced: ReharmMove[];
  /** The bar under the playhead while playing, else null. */
  playheadBar: number | null;
  /** Where to look when nothing is playing (the selected move's bar). */
  startBar: number;
  onClose: () => void;
}

type Tab = "xray" | "proof";

/**
 * The Engine X-ray: how the reharm engine decided, bar by bar (X-ray tab), and the
 * evidence that it always decides the same way (Proof tab).
 */
export function EngineXRay({ tune, level, forced, playheadBar, startBar, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("xray");
  const [bar, setBar] = useState(startBar);
  const [follow, setFollow] = useState(true);
  const bars = formBars(tune);
  const shown = follow && playheadBar ? playheadBar : bar;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (tab !== "xray" || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        setFollow(false);
        setBar((b) => Math.min(bars, Math.max(1, (follow && playheadBar ? playheadBar : b) + (e.key === "ArrowRight" ? 1 : -1))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, tab, bars, follow, playheadBar]);

  const step = (d: number) => {
    setFollow(false);
    setBar(Math.min(bars, Math.max(1, shown + d)));
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" role="dialog" aria-modal="true" aria-labelledby="xray-h" onClick={onClose}>
      <div className="h-full w-full max-w-[1100px] overflow-y-auto bg-paper p-3 shadow-2xl md:p-6" onClick={(e) => e.stopPropagation()}>
        <SketchBox seed={seedOf("xray")} fill={paper.light} strokeWidth={2}>
          <div className="space-y-4 p-4 md:p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="xray-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
                  🔬 Engine X-ray
                </h2>
                <p className="text-sm text-ink-soft">
                  {tune.title} · dial at {LEVELS[level]?.label ?? `L${level}`} ({densityLabel(level)})
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close the X-ray" className="cursor-pointer font-marker text-2xl leading-none hover:-rotate-6">
                ×
              </button>
            </header>

            <div role="tablist" aria-label="X-ray views" className="flex gap-2 font-marker">
              {(
                [
                  ["xray", "How it decided"],
                  ["proof", "Proof"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`cursor-pointer rounded-full border-2 border-ink px-4 py-0.5 ${tab === id ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "xray" ? (
              <>
                <div className="flex flex-wrap items-center gap-3 font-marker">
                  <button type="button" onClick={() => step(-1)} disabled={shown <= 1} aria-label="Previous bar" className="cursor-pointer rounded-full border-2 border-ink px-2 disabled:opacity-30">
                    ◀
                  </button>
                  <span className="text-xl" aria-live="polite">
                    Bar {shown} <span className="text-sm text-ink-soft">of {bars}</span>
                  </span>
                  <button type="button" onClick={() => step(1)} disabled={shown >= bars} aria-label="Next bar" className="cursor-pointer rounded-full border-2 border-ink px-2 disabled:opacity-30">
                    ▶
                  </button>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
                    follow the playhead{playheadBar ? "" : " (when playing)"}
                  </label>
                  <span className="text-xs text-ink-faint">← → step bars</span>
                </div>
                <XRayPipeline tune={tune} level={level} forced={forced} bar={shown} />
              </>
            ) : (
              <ProofPanel tune={tune} />
            )}
          </div>
        </SketchBox>
      </div>
    </div>
  );
}
