import {
  LETTERS,
  chroma,
  parseNote,
  symbol,
  transpose,
  type ChordEvent,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { useRef } from "react";
import { useRough } from "../design/rough";
import { CATEGORY_WASH, ink, seedOf } from "../design/tokens";
import { ChordText } from "./ChordName";

const W = 1000;
const SYS_H = 172;
const PER_SYS = 4;
const LEFT = 12;
const RIGHT_PAD = 14;
const LINE_GAP = 10;

interface Props {
  tune: Tune;
  chords: ChordEvent[];
  moves: ReharmMove[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  firstBar?: number;
  lastBar?: number;
  showWashes?: boolean;
  /** Current playback position, drawn as a pencil playhead. */
  playhead?: { bar: number; beat: number } | null;
  /** Bars being looped, shaded faintly. */
  loopBars?: { startBar: number; endBar: number } | null;
  /** Ink this chord in red (the chord sounding now). */
  activeChordId?: string | null;
  /** Fill the parent box (scale to fit both width and height) instead of flowing at full width. */
  fit?: boolean;
}

// Treble-clef staff positions (0 = bottom line E4) for key-signature accidentals.
const FLAT_POS = [4, 7, 3, 6, 2, 5, 1];
const SHARP_POS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];

function keySignature(tune: Tune): { count: number; flats: boolean } {
  const major = tune.key.mode === "major" ? tune.key.tonic : transpose(tune.key.tonic, "b3");
  const s = parseNote(major);
  // position on the circle of fifths: C=0, G=1 … F=-1, Bb=-2 …
  const fifths = (((chroma(major) * 7) % 12) + 12) % 12;
  let n = fifths > 6 ? fifths - 12 : fifths;
  if (n === 6 && s.alter < 0) n = -6;
  if (n === -6 && s.alter > 0) n = 6;
  return { count: Math.abs(n), flats: n < 0 };
}

function staffPos(pitch: string): { pos: number; letter: string; alter: number } {
  const m = /^([A-G])([b#]*)(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`Bad pitch ${pitch}`);
  const alter = m[2].startsWith("#") ? m[2].length : -m[2].length;
  return { pos: Number(m[3]) * 7 + LETTERS.indexOf(m[1] as (typeof LETTERS)[number]) - (4 * 7 + 2), letter: m[1], alter };
}

export function LeadSheet({
  tune,
  chords,
  moves,
  selectedId,
  onSelect,
  firstBar = 1,
  lastBar = 8,
  showWashes = true,
  playhead,
  loopBars,
  activeChordId,
  fit = false,
}: Props) {
  const bpb = tune.meter[0];
  const bars = Array.from({ length: lastBar - firstBar + 1 }, (_, i) => firstBar + i);
  const systems = Math.ceil(bars.length / PER_SYS);
  const H = systems * SYS_H + 10;
  const ks = keySignature(tune);
  const keyAlter: Record<string, number> = {};
  (ks.flats ? FLAT_ORDER : SHARP_ORDER).slice(0, ks.count).forEach((l) => (keyAlter[l] = ks.flats ? -1 : 1));

  const prefixW = (sys: number) => 46 + ks.count * 11 + (sys === 0 ? 34 : 6);
  const geo = (bar: number) => {
    const idx = bar - firstBar;
    const sys = Math.floor(idx / PER_SYS);
    const col = idx % PER_SYS;
    const pre = prefixW(sys);
    const w = (W - LEFT - RIGHT_PAD - pre) / PER_SYS;
    const y0 = 8 + sys * SYS_H;
    return { sys, col, x: LEFT + pre + col * w, w, y0, staffTop: y0 + 84 };
  };
  const beatX = (bar: number, beat: number) => {
    const g = geo(bar);
    return g.x + 12 + ((beat - 1) / bpb) * (g.w - 22);
  };
  const lineY = (staffTop: number, pos: number) => staffTop + 4 * LINE_GAP - pos * (LINE_GAP / 2);

  // ── wash segments for each move, split per system ──────────────────────
  type Seg = { move: ReharmMove; sys: number; x1: number; x2: number; y0: number; first: boolean };
  const segs: Seg[] = [];
  if (showWashes) {
    for (const m of moves) {
      let first = true;
      let cur: Seg | null = null;
      for (const b of bars) {
        const bs = (b - 1) * bpb;
        const be = b * bpb;
        const s = Math.max(m.spanBeats.start, bs);
        const e = Math.min(m.spanBeats.end, be);
        if (s >= e) continue;
        const g = geo(b);
        const x1 = beatX(b, s - bs + 1) - 12;
        const x2 = e === be ? g.x + g.w - 4 : beatX(b, e - bs + 1) - 12;
        if (cur && cur.sys === g.sys && Math.abs(cur.x2 - x1) < 20) cur.x2 = x2;
        else {
          cur = { move: m, sys: g.sys, x1, x2, y0: g.y0, first };
          segs.push(cur);
          first = false;
        }
      }
    }
  }

  const washRef = useRef<SVGGElement>(null);
  const inkRef = useRef<SVGGElement>(null);
  const melodyKey = JSON.stringify(tune.melody);

  useRough(
    washRef,
    (rc, add) => {
      for (const s of segs) {
        add(
          rc.rectangle(s.x1, s.y0 + 24, s.x2 - s.x1, 112, {
            seed: seedOf(s.move.id + s.sys),
            fill: CATEGORY_WASH[s.move.category],
            fillStyle: "solid",
            stroke: "none",
            roughness: 2.8,
            bowing: 6,
          }),
        );
      }
    },
    [JSON.stringify(segs.map((s) => [s.move.id, s.x1, s.x2, s.y0]))],
  );

  useRough(
    inkRef,
    (rc, add) => {
      const line = (x1: number, y1: number, x2: number, y2: number, o: Record<string, unknown> = {}) =>
        add(rc.line(x1, y1, x2, y2, { roughness: 0.7, strokeWidth: 1.1, stroke: ink.deep, seed: seedOf(`${x1}:${y1}:${x2}`), ...o }));

      for (let sys = 0; sys < systems; sys++) {
        const g = geo(firstBar + sys * PER_SYS);
        const lastInSys = Math.min(firstBar + sys * PER_SYS + PER_SYS - 1, lastBar);
        const gl = geo(lastInSys);
        const xEnd = gl.x + gl.w;
        for (let i = 0; i < 5; i++) line(LEFT, g.staffTop + i * LINE_GAP, xEnd, g.staffTop + i * LINE_GAP, { bowing: 0.6 });
        line(LEFT, g.staffTop, LEFT, g.staffTop + 40, { strokeWidth: 1.4 });
      }

      for (const b of bars) {
        const g = geo(b);
        line(g.x + g.w, g.staffTop, g.x + g.w, g.staffTop + 40, { strokeWidth: 1.4 });
        const notes = tune.melody.filter((n) => n.at.bar === b);
        if (!notes.length) {
          // lead-sheet comping slashes where no melody is entered
          for (let beat = 1; beat <= bpb; beat++) {
            const x = beatX(b, beat) + 8;
            line(x - 5, g.staffTop + 25, x + 5, g.staffTop + 15, { strokeWidth: 3.2, stroke: ink.faint, roughness: 0.4 });
          }
        }
        for (const n of notes) {
          const { pos } = staffPos(n.pitch);
          const x = beatX(b, n.at.beat) + 12;
          const y = lineY(g.staffTop, pos);
          const hollow = n.beats >= 2;
          add(
            rc.ellipse(x, y, 15, 11, {
              seed: seedOf(n.pitch + b),
              roughness: 0.8,
              strokeWidth: 1.8,
              stroke: ink.deep,
              ...(hollow ? {} : { fill: ink.deep, fillStyle: "solid" }),
            }),
          );
          if (pos < 4) line(x + 7, y - 1, x + 7, y - 35, { strokeWidth: 1.5 });
          else line(x - 7, y + 1, x - 7, y + 35, { strokeWidth: 1.5 });
          if ([3, 1.5, 0.75].includes(n.beats)) {
            add(rc.circle(x + 15, pos % 2 === 0 ? y - 4 : y, 3.5, { fill: ink.deep, fillStyle: "solid", stroke: ink.deep, seed: 4 }));
          }
          for (let p = -2; p >= pos; p -= 2) line(x - 12, lineY(g.staffTop, p), x + 12, lineY(g.staffTop, p));
          for (let p = 10; p <= pos; p += 2) line(x - 12, lineY(g.staffTop, p), x + 12, lineY(g.staffTop, p));
        }
      }

      // pen circle around the selected move
      for (const s of segs) {
        if (s.move.id !== selectedId) continue;
        add(
          rc.ellipse((s.x1 + s.x2) / 2, s.y0 + 82, s.x2 - s.x1 + 34, 140, {
            seed: seedOf(s.move.id + "circle"),
            stroke: ink.deep,
            strokeWidth: 1.8,
            roughness: 1.6,
          }),
        );
      }
    },
    [systems, firstBar, lastBar, melodyKey, selectedId, JSON.stringify(segs.map((s) => [s.move.id, s.x1, s.x2]))],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={`block select-none ${fit ? "h-full w-full" : "h-auto w-full"}`}
      role="img"
      aria-label={`Lead sheet for ${tune.title}`}
    >
      <g ref={washRef} className="wash" opacity={0.55} filter="url(#watercolor)" />

      {/* clefs, key and time signatures, bar numbers */}
      {Array.from({ length: systems }, (_, sys) => {
        const g = geo(firstBar + sys * PER_SYS);
        const bottom = g.staffTop + 40;
        return (
          <g key={sys} className="fill-ink">
            <text x={LEFT + 2} y={g.staffTop + 30} fontFamily="Noto Music" fontSize={40}>
              𝄞
            </text>
            {(ks.flats ? FLAT_POS : SHARP_POS).slice(0, ks.count).map((p, i) => (
              <text key={i} x={LEFT + 38 + i * 11} y={bottom - p * 5} fontFamily="Noto Music" fontSize={36}>
                {ks.flats ? "♭" : "♯"}
              </text>
            ))}
            {sys === 0 && (
              <g className="font-marker" fontWeight={700} fontSize={25} textAnchor="middle">
                <text x={LEFT + 52 + ks.count * 11} y={g.staffTop + 19}>
                  {tune.meter[0]}
                </text>
                <text x={LEFT + 52 + ks.count * 11} y={g.staffTop + 39}>
                  {tune.meter[1]}
                </text>
              </g>
            )}
            <text x={LEFT} y={g.staffTop - 8} className="fill-ink-faint font-hand" fontSize={12}>
              {firstBar + sys * PER_SYS}
            </text>
          </g>
        );
      })}

      <g ref={inkRef} />

      {/* accidentals that differ from the key signature */}
      {tune.melody
        .filter((n) => n.at.bar >= firstBar && n.at.bar <= lastBar)
        .map((n, i) => {
          const { pos, letter, alter } = staffPos(n.pitch);
          if ((keyAlter[letter] ?? 0) === alter) return null;
          const g = geo(n.at.bar);
          const glyph = alter === 0 ? "♮" : alter > 0 ? "♯" : "♭";
          return (
            <text key={i} x={beatX(n.at.bar, n.at.beat) - 6} y={lineY(g.staffTop, pos) + 5} fontFamily="Noto Music" fontSize={34} className="fill-ink">
              {glyph}
            </text>
          );
        })}

      {/* wash labels */}
      {segs
        .filter((s) => s.first)
        .map((s) => (
          <text
            key={s.move.id}
            x={s.x1 + 6}
            y={s.y0 + 18}
            transform={`rotate(-2 ${s.x1} ${s.y0 + 18})`}
            className="fill-ink-soft font-marker uppercase"
            fontSize={14}
            fontWeight={700}
          >
            {s.move.title}
          </text>
        ))}

      {/* chord symbols */}
      {chords
        .filter((c) => c.at.bar >= firstBar && c.at.bar <= lastBar)
        .map((c) => {
          const g = geo(c.at.bar);
          const crowd = chords.filter((o) => o.at.bar === c.at.bar).length;
          return (
            <ChordText
              key={c.id}
              x={beatX(c.at.bar, c.at.beat) - 4}
              y={g.y0 + 62}
              symbol={symbol(c)}
              size={crowd >= 4 ? 16 : crowd === 3 ? 19 : 25}
              active={c.id === activeChordId}
            />
          );
        })}

      {/* loop region brackets */}
      {loopBars &&
        bars
          .filter((b) => b >= loopBars.startBar && b <= loopBars.endBar)
          .map((b) => {
            const g = geo(b);
            return <rect key={`loop${b}`} x={g.x} y={g.staffTop + 50} width={g.w} height={4} rx={2} className="fill-ink-faint" opacity={0.6} />;
          })}

      {/* pencil playhead */}
      {playhead && playhead.bar >= firstBar && playhead.bar <= lastBar && (
        <g className="pointer-events-none" aria-hidden>
          {(() => {
            const g = geo(playhead.bar);
            const x = beatX(playhead.bar, playhead.beat) + 6;
            return (
              <>
                <line x1={x} y1={g.y0 + 26} x2={x} y2={g.staffTop + 50} className="stroke-wash-brick" strokeWidth={2.5} strokeLinecap="round" />
                <path d={`M ${x - 6} ${g.y0 + 20} L ${x + 6} ${g.y0 + 20} L ${x} ${g.y0 + 29} Z`} className="fill-wash-brick" />
              </>
            );
          })()}
        </g>
      )}

      {/* click targets */}
      {segs.map((s, i) => (
        <rect
          key={i}
          x={s.x1}
          y={s.y0 + 20}
          width={s.x2 - s.x1}
          height={118}
          fill="transparent"
          className="cursor-pointer"
          role="button"
          aria-label={`${s.move.title}, bar ${s.move.span.from.bar}`}
          onClick={() => onSelect(s.move.id)}
        />
      ))}
    </svg>
  );
}
