import { chroma, prettyNote, type LensKey, type LineNoteEval } from "@reharm/theory-core";
import { useEffect, useRef } from "react";
import { useRough } from "../../design/rough";
import { ink, keys as keyTone, paper, pen, seedOf, VERDICT_COLOR, wash } from "../../design/tokens";
import { VerdictMark } from "../../design/VerdictMark";
import { VERDICT_MARK } from "../../design/verdictMarks";

const WW = 40;
const BW = 24;
/** Key lengths: piano-like, or `tall` for an upright phone, where height is what's spare. */
const LENGTHS = { std: { WH: 200, BH: 124 }, tall: { WH: 340, BH: 210 } };
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

/** Suggestion colours. What you play is drawn in `PLAYED`, a colour no suggestion uses. */
const FILL: Record<NonNullable<LensKey["fill"]>, string> = {
  chord: VERDICT_COLOR["chord-tone"],
  tension: VERDICT_COLOR.tension,
  avoid: pen.red,
  blue: wash.brick,
};
export const PLAYED = wash.sage;

interface Props {
  low: number;
  high: number;
  /** What the current lens marks, one entry per pitch class. */
  marks: LensKey[];
  /** Pitch classes to aim at (the next chord's landing notes), drawn dashed. */
  aim: string[];
  /** Keys held right now, with the verdict over the chord they were struck on. */
  held: Map<number, LineNoteEval["verdict"]>;
  onKey: (midi: number) => void;
  onKeyUp: (midi: number) => void;
  tall?: boolean;
}

function layout(low: number, high: number) {
  const out: { midi: number; x: number; black: boolean }[] = [];
  let white = 0;
  for (let m = low; m <= high; m++) {
    if (IS_BLACK[m % 12]) out.push({ midi: m, x: white * WW - BW / 2, black: true });
    else out.push({ midi: m, x: white++ * WW, black: false });
  }
  return { keys: out, width: white * WW };
}

/**
 * Improv mode's keyboard: a real range with the lens's marks repeated in every octave
 * (spelled as the lens spells them), the next chord's landing notes dashed, and your held
 * notes lit. Playable: the keys feed `noteBus` through `onKey` / `onKeyUp`.
 */
export function ImprovKeyboard({ low, high, marks, aim, held, onKey, onKeyUp, tall = false }: Props) {
  const { WH, BH } = LENGTHS[tall ? "tall" : "std"];
  const { keys, width } = layout(low, high);
  const byChroma = new Map(marks.map((m) => [chroma(m.note), m]));
  const aimSet = new Set(aim.map(chroma));
  const center = (k: { x: number; black: boolean }) => ({ x: k.x + (k.black ? BW : WW) / 2, y: k.black ? BH - 22 : WH - 30 });

  // ── the keys and the lens marks: Rough.js, redrawn only when the chord or lens changes ──
  const g = useRef<SVGGElement>(null);
  const markKey = JSON.stringify([low, high, marks, tall]);
  useRough(
    g,
    (rc, add) => {
      const base = { stroke: keyTone.line, strokeWidth: 1.3, roughness: 0.8 };
      const draw = (black: boolean) => {
        for (const k of keys.filter((k) => k.black === black)) {
          const mk = byChroma.get(k.midi % 12);
          const color = mk?.fill && mk.fill !== "avoid" ? FILL[mk.fill] : null;
          // A marked black key turns light and hatched like a white one: some themes' ebonies are
          // dark blue, and a solid chord-tone blue on them wouldn't read.
          if (black && color) add(rc.rectangle(k.x, 0, BW, BH, { ...base, seed: seedOf("ikb" + k.midi), fill: keyTone.white, fillStyle: "solid" }));
          add(
            rc.rectangle(k.x, 0, black ? BW : WW, black ? BH : WH, {
              ...base,
              seed: seedOf("ik" + k.midi),
              fill: color ?? (black ? keyTone.black : keyTone.white),
              fillStyle: color ? "hachure" : "solid",
              hachureGap: mk?.fill === "chord" ? 3.5 : 5,
              fillWeight: mk?.fill === "chord" ? 2 : 1.4,
              hachureAngle: -50,
            }),
          );
          if (!mk) continue;
          const c = center(k);
          if (mk.ring) add(rc.ellipse(c.x, c.y, black ? 28 : 34, black ? 28 : 32, { stroke: black && !color ? keyTone.white : ink.deep, strokeWidth: 2.4, roughness: 1.1, seed: seedOf("ir" + k.midi) }));
          if (mk.fill === "avoid") {
            const y = c.y - 32;
            add(rc.line(c.x - 8, y - 8, c.x + 8, y + 8, { stroke: pen.red, strokeWidth: 2.6, roughness: 1.4, seed: seedOf("ia1" + k.midi) }));
            add(rc.line(c.x + 8, y - 8, c.x - 8, y + 8, { stroke: pen.red, strokeWidth: 2.6, roughness: 1.4, seed: seedOf("ia2" + k.midi) }));
          }
        }
      };
      draw(false);
      draw(true);
    },
    [markKey],
  );

  // Every note-on from these keys gets its note-off, even if the overlay closes mid-press.
  const pressed = useRef(new Set<number>());
  const up = useRef(onKeyUp);
  up.current = onKeyUp;
  useEffect(
    () => () => {
      pressed.current.forEach((m) => up.current(m));
      pressed.current.clear();
    },
    [],
  );
  const press = (m: number) => {
    if (pressed.current.has(m)) return;
    pressed.current.add(m);
    onKey(m);
  };
  const release = (m: number) => {
    if (!pressed.current.delete(m)) return;
    onKeyUp(m);
  };

  const ordered = [...keys.filter((k) => !k.black), ...keys.filter((k) => k.black)];
  return (
    <svg
      viewBox={`-2 -2 ${width + 4} ${WH + 26}`}
      preserveAspectRatio="xMidYMax meet"
      className="block h-full max-h-[55dvh] w-full touch-none select-none"
      style={{ aspectRatio: `${width + 4} / ${WH + 26}` }}
      role="group"
      aria-label="Improv keyboard"
    >
      <g ref={g} />
      {ordered.map((k) => {
        const mk = byChroma.get(k.midi % 12);
        const c = center(k);
        const v = held.get(k.midi);
        return (
          <g key={k.midi} data-midi={k.midi} data-mark={mk?.fill ?? (mk ? "ring" : undefined)} data-held={v}>
            {/* a white key lights only below the black keys, so it never paints over them */}
            {v && <rect x={k.x + 3} y={k.black ? 3 : BH + 3} width={(k.black ? BW : WW) - 6} height={k.black ? BH - 6 : WH - BH - 6} rx={5} fill={PLAYED} opacity={0.85} />}
            {aimSet.has(k.midi % 12) && (
              <ellipse cx={c.x} cy={c.y} rx={k.black ? 17 : 22} ry={k.black ? 17 : 21} fill="none" stroke={ink.deep} strokeWidth={2} strokeDasharray="5 4" className="animate-pulse" />
            )}
            {/* the full lens's chord tones and tensions also get the heatmap's shape (avoid notes
                already have their red ✕ in the same spot), so the lens reads without colour */}
            {(mk?.fill === "chord" || mk?.fill === "tension") && (
              <VerdictMark verdict={mk.fill === "chord" ? "chord-tone" : "tension"} cx={c.x} cy={c.y - 32} r={k.black ? 4.5 : 5.5} />
            )}
            {mk && (
              <text
                x={c.x}
                y={c.y + 6}
                textAnchor="middle"
                fontSize={k.black ? 14 : 17}
                fontWeight={700}
                className="font-marker"
                fill={k.black && !mk.fill ? keyTone.white : ink.deep}
                stroke={k.black && !mk.fill ? keyTone.black : paper.light}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {prettyNote(mk.note)}
              </text>
            )}
            {v && (
              <g>
                <title>{`Held: ${VERDICT_MARK[v].label}`}</title>
                <circle cx={c.x} cy={k.black ? 18 : BH + 18} r={k.black ? 8 : 10} fill={VERDICT_COLOR[v]} stroke={ink.deep} strokeWidth={1.5} />
                {/* the heatmap's shape for the verdict, so it reads without the colour */}
                <VerdictMark verdict={v} cx={c.x} cy={k.black ? 18 : BH + 18} r={k.black ? 4.5 : 5.5} />
              </g>
            )}
            {!k.black && k.midi % 12 === 0 && (
              <text x={k.x + WW / 2} y={WH + 20} textAnchor="middle" fontSize={13} className="fill-ink-faint font-hand">
                C{k.midi / 12 - 1}
              </text>
            )}
            <rect
              x={k.x}
              y={0}
              width={k.black ? BW : WW}
              height={k.black ? BH : WH}
              fill="transparent"
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.preventDefault();
                press(k.midi);
                // touch captures the pointer to the first key; let go so sliding off releases it
                const el = e.currentTarget as Element;
                if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
              }}
              onPointerUp={() => release(k.midi)}
              onPointerCancel={() => release(k.midi)}
              onPointerLeave={() => release(k.midi)}
            />
          </g>
        );
      })}
    </svg>
  );
}
