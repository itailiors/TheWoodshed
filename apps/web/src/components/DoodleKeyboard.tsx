import { chroma, mod, pitchClass, prettyNote } from "@reharm/theory-core";
import { useRef } from "react";
import { useRough } from "../design/rough";
import { ink, paper, seedOf, wash } from "../design/tokens";

const WW = 20;
const WH = 84;
const BW = 12;
const BH = 52;
const PAD = 3;
const WHITE_OF = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6];
const BLACK_LEFT: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

interface Props {
  notes: string[];
  /** Notes to ring (e.g. guide tones or the shared tritone). */
  accent?: string[];
  color?: string;
  octaves?: number;
  /** "pcs": pitch-class set from the first note; "ascending": a literal voicing, bottom to top. */
  mode?: "pcs" | "ascending";
  className?: string;
}

function place(notes: string[], mode: "pcs" | "ascending", octaves: number): { note: string; semi: number }[] {
  if (!notes.length) return [];
  const base = chroma(pitchClass(notes[0]));
  let prev = -1;
  return notes.map((note) => {
    const c = chroma(pitchClass(note));
    let s: number;
    if (mode === "pcs") s = base + mod(c - base, 12);
    else {
      s = c;
      while (s <= prev) s += 12;
      if (s >= octaves * 12) s = mod(s, octaves * 12);
      prev = s;
    }
    return { note, semi: s };
  });
}

const keyX = (semi: number) => {
  const oct = Math.floor(semi / 12);
  const c = semi % 12;
  if (WHITE_OF[c] >= 0) return { x: PAD + (oct * 7 + WHITE_OF[c]) * WW, black: false };
  return { x: PAD + (oct * 7 + BLACK_LEFT[c] + 1) * WW - BW / 2, black: true };
};

/** A hand-drawn keyboard with shaded keys and ink dots, like a margin doodle. */
export function DoodleKeyboard({ notes, accent = [], color = wash.mustard, octaves = 2, mode = "pcs", className = "" }: Props) {
  const placed = place(notes, mode, octaves);
  const accentSet = new Set(accent.map((a) => chroma(pitchClass(a))));
  const width = octaves * 7 * WW + PAD * 2;
  const g = useRef<SVGGElement>(null);
  const key = JSON.stringify([placed, accent, color, octaves]);

  useRough(
    g,
    (rc, add) => {
      const base = { stroke: ink.deep, strokeWidth: 1.2, roughness: 0.9 };
      const lit = new Map(placed.map((p) => [p.semi, p]));
      for (let i = 0; i < octaves * 7; i++) {
        const semi = Math.floor(i / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][i % 7];
        const on = lit.has(semi);
        add(
          rc.rectangle(PAD + i * WW, PAD, WW, WH, {
            ...base,
            seed: seedOf("w" + i),
            fill: on ? color : paper.light,
            fillStyle: on ? "hachure" : "solid",
            hachureGap: 3.2,
            fillWeight: 1.3,
            hachureAngle: -50,
          }),
        );
      }
      for (let o = 0; o < octaves; o++) {
        for (const c of [1, 3, 6, 8, 10]) {
          const semi = o * 12 + c;
          const { x } = keyX(semi);
          const on = lit.has(semi);
          add(rc.rectangle(x, PAD, BW, BH, { ...base, seed: seedOf("b" + semi), fill: on ? color : ink.deep, fillStyle: "solid" }));
        }
      }
      for (const p of placed) {
        const { x, black } = keyX(p.semi);
        const cx = x + (black ? BW : WW) / 2;
        const cy = black ? BH - 9 : WH - 12;
        add(rc.circle(cx, cy, 8, { seed: seedOf("d" + p.semi), fill: black ? paper.light : ink.deep, fillStyle: "solid", stroke: ink.deep, roughness: 0.6 }));
        if (accentSet.has(chroma(pitchClass(p.note)))) {
          add(rc.circle(cx, cy, 17, { seed: seedOf("a" + p.semi), stroke: ink.deep, strokeWidth: 1.4, roughness: 1.2 }));
        }
      }
    },
    [key],
  );

  return (
    <svg viewBox={`0 0 ${width} ${WH + 34}`} className={`block h-auto w-full max-w-[340px] ${className}`} aria-label={`Keyboard: ${notes.map(prettyNote).join(" ")}`}>
      <g ref={g} />
      {placed.map((p, i) => {
        const { x, black } = keyX(p.semi);
        return (
          <text
            key={i}
            x={x + (black ? BW : WW) / 2}
            y={WH + (black ? 30 : 18)}
            textAnchor="middle"
            className="fill-ink font-hand"
            fontSize={12}
          >
            {prettyNote(pitchClass(p.note))}
          </text>
        );
      })}
    </svg>
  );
}
