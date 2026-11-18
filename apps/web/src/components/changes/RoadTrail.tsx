import { prettySymbol, type StepKind } from "@reharm/theory-core";
import { useRef } from "react";
import { useRough } from "../../design/rough";
import { ink, paper, pen, sageInk, seedOf, wash } from "../../design/tokens";

/*
 * The road: the round drawn as a hand-inked strip of chord stations. Where you've been, where
 * you are (circled, the way a teacher circles the spot), the next stop as a dashed "?", and
 * home (I) at the far end as a dashed ghost from the start, so you always see where the trip
 * is heading.
 *
 * The connectors teach the motions by shape: a fifths step is an even stair down, the one
 * wider step (IV → vii) is a longer arc that hops off the line, and the turnaround leaves
 * home through a little door.
 */

export type StationState = "past" | "current" | "next" | "ghost" | "home";
export type Outcome = "right" | "alt" | "wrong";

export interface Station {
  /** Engine chord symbol ("Bb7"), or null for the "?" of the next stop. */
  symbol: string | null;
  state: StationState;
  /** How the answer that reached this station went (the newest station, during feedback). */
  outcome?: Outcome;
}

export interface Connector {
  /** "unknown": the step to the next stop, its shape not given away. null: the gap before the ghost of home ("···"), the stops between not yet known. */
  kind: StepKind | "unknown" | null;
}

const W = 66; // station width
const H = 34;
const GAP = { fifth: 34, tritoneHop: 58, door: 40, unknown: 30 } as const;
const PAD = 6;
const MID = 44; // the line the stations sit on (room above for the "wider step" arc label)
const HEIGHT = MID + H / 2 + 8;

function layout(stations: Station[], connectors: Connector[]) {
  const xs: number[] = [];
  let x = PAD;
  stations.forEach((_, i) => {
    xs.push(x);
    const c = connectors[i];
    if (c) x += W + (c.kind ? GAP[c.kind] : GAP.unknown);
  });
  return { xs, width: x + W + PAD };
}

export function RoadTrail({ stations, connectors, seed, label, scale = 1 }: { stations: Station[]; connectors: Connector[]; seed: number; label: string; scale?: number }) {
  const g = useRef<SVGGElement>(null);
  const { xs, width } = layout(stations, connectors);
  const state = JSON.stringify([stations, connectors, seed]);

  useRough(
    g,
    (rc, add) => {
      const s = (k: string) => seedOf(`${seed}:${k}`);
      // connectors first, so stations sit on top of the line
      connectors.forEach((c, i) => {
        const x1 = xs[i] + W;
        const x2 = xs[i + 1];
        const known = stations[i + 1]?.state !== "next" && stations[i + 1]?.state !== "ghost";
        const stroke = known ? ink.deep : ink.faint;
        const dash = known ? undefined : [4, 4];
        if (c.kind === null) {
          // "···": the stops in between aren't drawn until you get there
          for (let d = 0; d < 3; d++) add(rc.circle(x1 + 8 + d * 7, MID, 2.5, { stroke: ink.faint, fill: ink.faint, fillStyle: "solid", seed: s(`dot${i}${d}`) }));
          return;
        }
        if (c.kind === "tritoneHop") {
          // the one wider step: an arc that leaves the line and lands back on it
          const peak = MID - 22;
          add(rc.path(`M ${x1} ${MID} Q ${(x1 + x2) / 2} ${peak} ${x2} ${MID}`, { stroke, strokeWidth: 1.6, roughness: 1, strokeLineDash: dash, seed: s(`hop${i}`) }));
          return;
        }
        add(rc.line(x1, MID, x2, MID, { stroke, strokeWidth: 1.5, roughness: 0.9, strokeLineDash: dash, seed: s(`ln${i}`) }));
        if (c.kind === "fifth") {
          // a little stair down: the fourths staircase
          const m = (x1 + x2) / 2;
          add(rc.linearPath([[m - 6, MID - 6], [m, MID - 6], [m, MID], [m + 6, MID]], { stroke, strokeWidth: 1.2, roughness: 0.6, seed: s(`st${i}`) }));
        } else if (c.kind === "door") {
          // out the door: a small open door at the start of the step
          add(rc.rectangle(x1 + 6, MID - 16, 9, 14, { stroke, strokeWidth: 1.1, roughness: 0.8, seed: s(`dr${i}`) }));
          add(rc.line(x1 + 15, MID - 16, x1 + 20, MID - 13, { stroke, strokeWidth: 1.1, roughness: 0.6, seed: s(`dh${i}`) }));
        }
      });

      stations.forEach((st, i) => {
        const cx = xs[i] + W / 2;
        const base = { seed: s(`stn${i}`), roughness: 1, strokeWidth: 1.6 };
        switch (st.state) {
          case "past":
            add(rc.ellipse(cx, MID, W, H, { ...base, stroke: ink.deep, fill: wash.blue, fillStyle: "hachure", hachureGap: 5, fillWeight: 0.6 }));
            break;
          case "current":
            add(rc.ellipse(cx, MID, W, H, { ...base, stroke: ink.deep, fill: paper.light, fillStyle: "solid" }));
            // the teacher circling the spot
            add(rc.ellipse(cx, MID, W + 10, H + 9, { seed: s(`ring${i}`), stroke: ink.deep, strokeWidth: 1.1, roughness: 1.8 }));
            break;
          case "next":
          case "ghost":
            add(rc.ellipse(cx, MID, W, H, { ...base, stroke: ink.faint, strokeLineDash: [5, 4], fill: paper.light, fillStyle: "solid" }));
            break;
          case "home":
            add(rc.ellipse(cx, MID, W, H, { ...base, stroke: sageInk, fill: wash.sage, fillStyle: "hachure", hachureGap: 4, fillWeight: 0.8 }));
            break;
        }
        // the newest answer's outcome, drawn over the station
        if (st.outcome === "right") add(rc.ellipse(cx, MID, W + 6, H + 6, { seed: s(`ok${i}`), stroke: sageInk, strokeWidth: 2, roughness: 1.3 }));
        if (st.outcome === "alt") add(rc.ellipse(cx, MID, W + 6, H + 6, { seed: s(`alt${i}`), stroke: wash.mustard, strokeWidth: 3, roughness: 1.3 }));
        if (st.outcome === "wrong") add(rc.ellipse(cx, MID, W + 8, H + 8, { seed: s(`no${i}`), stroke: pen.red, strokeWidth: 2.2, roughness: 1.8 }));
      });
    },
    [state],
  );

  return (
    <div className="-mx-1 overflow-x-auto px-1" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width * scale} height={HEIGHT * scale} className="block select-none">
        <g ref={g} />
        {connectors.map((c, i) =>
          c.kind === "tritoneHop" ? (
            <text key={`hl${i}`} x={(xs[i] + W + xs[i + 1]) / 2} y={MID - 26} textAnchor="middle" fontSize={10} className="fill-ink-soft font-hand">
              wider step
            </text>
          ) : null,
        )}
        {stations.map((st, i) => (
          <text
            key={i}
            x={xs[i] + W / 2}
            y={MID + 5}
            textAnchor="middle"
            fontSize={st.symbol && st.symbol.length > 6 ? 12 : 14}
            fontWeight={700}
            className={`font-marker ${st.state === "next" || st.state === "ghost" ? "fill-ink-faint" : "fill-ink"}`}
          >
            {st.symbol ? prettySymbol(st.symbol) : "?"}
          </text>
        ))}
      </svg>
    </div>
  );
}
