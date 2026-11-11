import { useSyncExternalStore } from "react";
import { player, type LoadPart, type LoadState } from "../audio/player";
import { pen } from "../design/tokens";

const ORDER: LoadPart[] = ["piano", "bass", "drums"];
const W = 210;
const STATION = (i: number) => 14 + i * ((W - 28) / 2);
const MARK: Record<LoadState, string> = { idle: "", loading: "…", ready: "✓", fallback: "~" };

export function useLoadProgress() {
  return useSyncExternalStore(
    (cb) => player.onProgress(cb),
    () => player.progress,
  );
}

/**
 * The band arriving, drawn as a pencil line being inked in: a faint guide with three
 * stations (piano, bass, drums), and an ink stroke that grows as each instrument lands.
 * A station that fell back to a synth gets a red "~" instead of a check.
 */
export function LoadingLine({ className = "" }: { className?: string }) {
  const progress = useLoadProgress();
  const done = ORDER.filter((i) => progress[i] === "ready" || progress[i] === "fallback").length;
  // The ink reaches the station of the last instrument that has arrived (+ a nudge while loading).
  const inkTo = done === 0 ? 0.12 : done / ORDER.length;
  const label = ORDER.map((i) => `${i} ${progress[i] === "ready" ? "loaded" : progress[i] === "fallback" ? "using a synth" : "loading"}`).join(", ");
  return (
    <div role="progressbar" aria-label="Loading the band" aria-valuemin={0} aria-valuemax={3} aria-valuenow={done} aria-valuetext={label} className={`text-ink ${className}`}>
      <svg width={W} height={34} viewBox={`0 0 ${W} 34`} aria-hidden className="overflow-visible">
        <g filter="url(#ink-wobble)" fill="none" strokeLinecap="round">
          {/* pencil guide */}
          <path d={`M6 10 C60 9 120 11.5 ${W - 6} 9.6`} stroke="currentColor" strokeWidth={1} strokeDasharray="3 4" opacity={0.35} />
          {/* ink, drawn in */}
          <path
            d={`M6 10 C60 9 120 11.5 ${W - 6} 9.6`}
            stroke="currentColor"
            strokeWidth={2.4}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - inkTo}
            style={{ transition: "stroke-dashoffset 450ms ease-out" }}
          />
          {ORDER.map((inst, i) => {
            const s = progress[inst];
            const x = STATION(i);
            const arrived = s === "ready" || s === "fallback";
            return (
              <g key={inst}>
                <circle cx={x} cy={10} r={arrived ? 3.6 : 3} fill={arrived ? "currentColor" : "var(--color-paper-light)"} stroke="currentColor" strokeWidth={1.3} />
              </g>
            );
          })}
        </g>
        {ORDER.map((inst, i) => (
          <text
            key={inst}
            x={STATION(i)}
            y={29}
            textAnchor="middle"
            className="font-hand"
            fontSize={11}
            fill={progress[inst] === "fallback" ? pen.red : "currentColor"}
            opacity={progress[inst] === "idle" ? 0.5 : 1}
          >
            {inst} {MARK[progress[inst]]}
          </text>
        ))}
      </svg>
    </div>
  );
}
