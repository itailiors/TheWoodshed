import { useRef } from "react";
import { useRough } from "../../design/rough";
import { ink, paper, pen, seedOf, wash } from "../../design/tokens";

const WW = 22;
const WH = 112;
const BW = 13;
const BH = 70;
const TOP = 52; // room for red-pen labels above the keys
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

export interface PenMark {
  midi: number;
  label: string;
}

interface Props {
  low?: number;
  high?: number;
  /** Ghost of the reference voicing (dashed outline). */
  target?: number[];
  /** What you played (ink dots). */
  played?: number[];
  /** On-screen selection waiting to be struck. */
  pending?: number[];
  /** Red circles: notes that should be there. */
  missing?: PenMark[];
  /** Red crosses: notes that shouldn't. */
  wrong?: PenMark[];
  /** Draw the big red checkmark. */
  check?: boolean;
  onKey?: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
  className?: string;
}

function layout(low: number, high: number) {
  const keys: { midi: number; x: number; black: boolean }[] = [];
  let white = 0;
  for (let m = low; m <= high; m++) {
    if (IS_BLACK[m % 12]) keys.push({ midi: m, x: white * WW - BW / 2, black: true });
    else keys.push({ midi: m, x: white++ * WW, black: false });
  }
  return { keys, width: white * WW };
}

/** A keyboard the teacher marks up: dashed ghost of the target, your notes in ink, corrections in red pen. */
export function PenKeyboard({ low = 36, high = 84, target = [], played = [], pending = [], missing = [], wrong = [], check, onKey, onKeyUp, className = "" }: Props) {
  const { keys, width } = layout(low, high);
  const pos = new Map(keys.map((k) => [k.midi, k]));
  const center = (m: number) => {
    const k = pos.get(m);
    if (!k) return null;
    return { x: k.x + (k.black ? BW : WW) / 2, y: TOP + (k.black ? BH - 14 : WH - 16), black: k.black };
  };
  const g = useRef<SVGGElement>(null);
  const marks = useRef<SVGGElement>(null);
  const keyState = JSON.stringify([low, high, target, played, pending]);
  const markState = JSON.stringify([missing, wrong, check]);

  useRough(
    g,
    (rc, add) => {
      const base = { stroke: ink.deep, strokeWidth: 1.1, roughness: 0.7 };
      const pend = new Set(pending);
      for (const k of keys.filter((k) => !k.black)) {
        add(rc.rectangle(k.x, TOP, WW, WH, { ...base, seed: seedOf("pw" + k.midi), fill: pend.has(k.midi) ? wash.mustard : paper.light, fillStyle: pend.has(k.midi) ? "hachure" : "solid", hachureGap: 3 }));
      }
      for (const k of keys.filter((k) => k.black)) {
        add(rc.rectangle(k.x, TOP, BW, BH, { ...base, seed: seedOf("pb" + k.midi), fill: pend.has(k.midi) ? wash.mustard : ink.deep, fillStyle: "solid" }));
      }
      for (const m of target) {
        const c = center(m);
        if (c) add(rc.circle(c.x, c.y, 15, { seed: seedOf("t" + m), stroke: c.black ? paper.light : ink.soft, strokeWidth: 1.4, roughness: 1, strokeLineDash: [3, 3] }));
      }
      for (const m of played) {
        const c = center(m);
        if (c) add(rc.circle(c.x, c.y, 10, { seed: seedOf("p" + m), fill: c.black ? paper.light : ink.deep, fillStyle: "solid", stroke: c.black ? paper.light : ink.deep, roughness: 0.6 }));
      }
    },
    [keyState],
  );

  useRough(
    marks,
    (rc, add) => {
      const red = { stroke: pen.red, strokeWidth: 2.3, roughness: 1.7 };
      missing.forEach((mk, i) => {
        const c = center(mk.midi);
        if (!c) return;
        add(rc.ellipse(c.x, c.y, 32, 30, { ...red, seed: seedOf("m" + mk.midi + i) }));
        // a pen stroke from the label down to the circle
        const ly = 14 + (i % 2) * 18;
        add(rc.line(c.x, ly + 6, c.x, c.y - 17, { ...red, strokeWidth: 1.4, roughness: 1.2, seed: seedOf("ml" + i) }));
      });
      wrong.forEach((mk, i) => {
        const c = center(mk.midi);
        if (!c) return;
        add(rc.line(c.x - 9, c.y - 9, c.x + 9, c.y + 9, { ...red, seed: seedOf("w1" + i) }));
        add(rc.line(c.x + 9, c.y - 9, c.x - 9, c.y + 9, { ...red, seed: seedOf("w2" + i) }));
      });
      if (check) {
        const x = width - 70;
        add(rc.path(`M ${x} 26 L ${x + 16} 44 L ${x + 52} 4`, { ...red, strokeWidth: 4, roughness: 1.2, seed: 77 }));
      }
    },
    [markState, width],
  );

  return (
    <svg viewBox={`-2 0 ${width + 4} ${TOP + WH + 16}`} className={`block h-auto w-full select-none ${className}`} role="group" aria-label="Practice keyboard">
      <g ref={g} />
      {keys
        .filter((k) => !k.black && k.midi % 12 === 0)
        .map((k) => (
          <text key={k.midi} x={k.x + WW / 2} y={TOP + WH + 13} textAnchor="middle" fontSize={10} className="fill-ink-faint font-hand">
            C{k.midi / 12 - 1}
          </text>
        ))}
      <g ref={marks} />
      {missing.map((mk, i) => {
        const c = center(mk.midi);
        return c ? (
          <text key={`ml${i}`} x={c.x} y={14 + (i % 2) * 18} textAnchor="middle" fontSize={15} fontWeight={700} className="font-marker" fill={pen.red}>
            {mk.label}
          </text>
        ) : null;
      })}
      {wrong.map((mk, i) => {
        const c = center(mk.midi);
        return c ? (
          <text key={`wl${i}`} x={c.x} y={TOP - 6 - (i % 2) * 16} textAnchor="middle" fontSize={13} fontWeight={700} className="font-marker" fill={pen.red}>
            {mk.label}
          </text>
        ) : null;
      })}
      {onKey &&
        [...keys.filter((k) => !k.black), ...keys.filter((k) => k.black)].map((k) => (
          <rect
            key={`hit${k.midi}`}
            data-midi={k.midi}
            x={k.x}
            y={TOP}
            width={k.black ? BW : WW}
            height={k.black ? BH : WH}
            fill="transparent"
            className="cursor-pointer"
            onPointerDown={(e) => {
              e.preventDefault();
              onKey(k.midi);
            }}
            onPointerUp={() => onKeyUp?.(k.midi)}
            onPointerLeave={(e) => e.buttons && onKeyUp?.(k.midi)}
          />
        ))}
    </svg>
  );
}
