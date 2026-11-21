import {
  LETTERS,
  chroma,
  parseNote,
  prettySymbol,
  symbol,
  transpose,
  type ChordEvent,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { useRef } from "react";
import { useRough } from "../design/rough";
import { packLabels, textWidth, useFontsReady } from "../design/labels";
import { CATEGORY_WASH, ink, seedOf } from "../design/tokens";
import { ChordText } from "./ChordName";
import { engrave, formLength, type Glyph } from "./notation";

/** Drawing width (viewBox units) for 4 bars a line; 2 bars a line (phones) gets a narrower page, so bars keep their size. */
const PAGE_W = { 4: 1000, 2: 600 } as const;
const SYS_H = 172;
const LEFT = 12;
const RIGHT_PAD = 14;
const LINE_GAP = 10;
/** Headroom above the first line, so a move name lifted to the second label row isn't clipped. */
const TOP = 20;

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
  /**
   * Click a chord symbol (Study: puts the chord cursor there). Mouse / touch only: the keyboard
   * already has ⇧ ← → for this, and 40-odd extra Tab stops would bury the moves'.
   */
  onChord?: (chordId: string) => void;
  /** Fill the parent box (scale to fit both width and height) instead of flowing at full width. */
  fit?: boolean;
  /** Bars per line: 4 (the page as printed) or 2 (a phone held upright, so the notes stay readable). */
  perSystem?: 2 | 4;
}

// Treble-clef staff positions (0 = bottom line E4) for key-signature accidentals.
const FLAT_POS = [4, 7, 3, 6, 2, 5, 1];
const SHARP_POS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];

/** Stem length (3½ spaces), and the shortest a beamed stem may get. */
const STEM = 35;
const STEM_MIN = 28;
/** A beam rises or falls at most one staff space. */
const BEAM_MAX_RISE = 10;
const BEAM_W = 5;

const FEEL_LABEL: Record<Tune["feel"], string> = {
  swing: "Swing",
  waltz: "Jazz waltz",
  bossa: "Bossa nova",
  ballad: "Ballad",
  straight8: "Straight 8ths",
};

/**
 * Noto Music rest glyphs by printed length, with the baseline (below the staff's top line, at
 * 40px) that puts each where it belongs. Measured from the glyphs' ink: the whole rest hangs
 * from the 4th line, the half sits on the middle line, the others centre on the staff.
 */
const REST: Record<string, { glyph: string; baseline: number }> = {
  whole: { glyph: "𝄻", baseline: 30 },
  "2": { glyph: "𝄼", baseline: 31 },
  "1": { glyph: "𝄽", baseline: 40 },
  "0.5": { glyph: "𝄾", baseline: 39 },
  "0.25": { glyph: "𝄿", baseline: 40 },
};

interface Head {
  glyph: Glyph;
  bar: number;
  x: number;
  y: number;
  pos: number;
  up: boolean;
  stemX: number;
  stemEnd: number;
  beamed: boolean;
}

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
  onChord,
  fit = false,
  perSystem = 4,
}: Props) {
  const PER_SYS = perSystem;
  const W = PAGE_W[perSystem];
  const bpb = tune.meter[0];
  const bars = Array.from({ length: lastBar - firstBar + 1 }, (_, i) => firstBar + i);
  const systems = Math.ceil(bars.length / PER_SYS);
  const H = systems * SYS_H + TOP + 2;
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
    const y0 = TOP + sys * SYS_H;
    return { sys, col, x: LEFT + pre + col * w, w, y0, staffTop: y0 + 84 };
  };
  const beatX = (bar: number, beat: number) => {
    const g = geo(bar);
    return g.x + 12 + ((beat - 1) / bpb) * (g.w - 22);
  };
  const lineY = (staffTop: number, pos: number) => staffTop + 4 * LINE_GAP - pos * (LINE_GAP / 2);

  // ── engraved melody: notes, rests, ties, beams (rules in notation.ts) ──
  const sheet = engrave(tune, keyAlter);
  const formEnd = formLength(tune);
  const heads = new Map<Glyph, Head>();
  const beamLines: Array<{ x1: number; y1: number; x2: number; y2: number; up: boolean }> = [];
  for (const b of bars) {
    const eb = sheet.get(b);
    if (!eb) continue;
    const g = geo(b);
    for (const gl of eb.glyphs) {
      if (!gl.pitch) continue;
      const { pos } = staffPos(gl.pitch);
      const x = beatX(b, gl.beat) + 12;
      const y = lineY(g.staffTop, pos);
      const up = pos < 4; // on or above the middle line: stem down
      heads.set(gl, { glyph: gl, bar: b, x, y, pos, up, stemX: up ? x + 7 : x - 7, stemEnd: up ? y - STEM : y + STEM, beamed: false });
    }
    for (const run of eb.beams) {
      const hs = run.map((i) => heads.get(eb.glyphs[i])!);
      // the note farthest from the middle line sets the direction; a tie goes stem down
      const far = Math.max(...hs.map((h) => Math.abs(h.pos - 4)));
      const up = far > 0 && hs.some((h) => 4 - h.pos === far) && !hs.some((h) => h.pos - 4 === far);
      const dir = up ? -1 : 1;
      for (const h of hs) {
        h.up = up;
        h.stemX = up ? h.x + 7 : h.x - 7;
        h.beamed = true;
      }
      const first = hs[0];
      const last = hs[hs.length - 1];
      const e1 = first.y + dir * STEM;
      const rise = Math.max(-BEAM_MAX_RISE, Math.min(BEAM_MAX_RISE, last.y + dir * STEM - e1));
      const at = (x: number) => e1 + (rise * (x - first.stemX)) / (last.stemX - first.stemX || 1);
      // push the beam outward until every stem is long enough
      let shift = 0;
      for (const h of hs) shift = Math.max(shift, dir * (h.y + dir * STEM_MIN - at(h.stemX)));
      for (const h of hs) h.stemEnd = at(h.stemX) + dir * shift;
      beamLines.push({ x1: first.stemX, y1: e1 + dir * shift, x2: last.stemX, y2: e1 + rise + dir * shift, up });
    }
  }

  // ties: between heads on one line, or a half tie to / from the line's edge when it wraps
  const noteSeq = [...sheet.values()].flatMap((eb) => eb.glyphs.filter((gl) => gl.pitch));
  const ties: Array<{ x1: number; x2: number; y: number; below: boolean }> = [];
  noteSeq.forEach((gl, i) => {
    const h = heads.get(gl);
    if (!h) return;
    const gh = geo(h.bar);
    if (gl.tieToNext) {
      const hn = heads.get(noteSeq[i + 1]);
      ties.push({ x1: h.x + 8, x2: hn && geo(hn.bar).sys === gh.sys ? hn.x - 8 : gh.x + gh.w - 3, y: h.y, below: h.up });
    }
    if (gl.tiedFromPrev) {
      const hp = heads.get(noteSeq[i - 1]);
      if (!hp || geo(hp.bar).sys !== gh.sys) ties.push({ x1: gh.x + 3, x2: h.x - 8, y: h.y, below: h.up });
    }
  });

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

  // ── move names: full text, packed into lanes so two moves in one bar never overlap ──
  // Lane 0 sits just above the wash; lane 1 lifts a colliding name one row up (with an ink
  // tick back down to its wash). Names are measured in the real font, so the packing is exact.
  useFontsReady();
  const LABEL_FONT = "700 14px Kalam";
  const LANE_Y = [19, 2];
  const labels = [...new Set(segs.map((s) => s.sys))].flatMap((sys) =>
    packLabels(
      segs
        .filter((s) => s.first && s.sys === sys)
        .map((s) => {
          const text = s.move.title.toUpperCase();
          return { item: s, text, x: s.x1 + 6, width: textWidth(text, LABEL_FONT), maxRight: W - RIGHT_PAD };
        }),
      { lanes: LANE_Y.length, gap: 10, font: LABEL_FONT, minX: LEFT },
    ),
  );

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
        const xr = g.x + g.w;
        if (b === formEnd) {
          // final barline: thin + thick
          line(xr - 7, g.staffTop, xr - 7, g.staffTop + 40, { strokeWidth: 1.4 });
          line(xr - 2, g.staffTop, xr - 2, g.staffTop + 40, { strokeWidth: 4.5, roughness: 0.3 });
        } else line(xr, g.staffTop, xr, g.staffTop + 40, { strokeWidth: 1.4 });
        if (!sheet.get(b)?.glyphs.length) {
          // lead-sheet comping slashes where no melody is entered
          for (let beat = 1; beat <= bpb; beat++) {
            const x = beatX(b, beat) + 8;
            line(x - 5, g.staffTop + 25, x + 5, g.staffTop + 15, { strokeWidth: 3.2, stroke: ink.faint, roughness: 0.4 });
          }
        }
      }

      for (const h of heads.values()) {
        const { glyph: gl, x, y, pos, bar: b } = h;
        const g = geo(b);
        const seed = seedOf(`${gl.pitch}${b}:${gl.beat}`);
        add(
          rc.ellipse(x, y, 15, 11, {
            seed,
            roughness: 0.8,
            strokeWidth: 1.8,
            stroke: ink.deep,
            ...(gl.value >= 2 ? {} : { fill: ink.deep, fillStyle: "solid" }),
          }),
        );
        if (gl.value < 4) line(h.stemX, y + (h.up ? -1 : 1), h.stemX, h.stemEnd, { strokeWidth: 1.5 });
        if (!h.beamed && gl.value < 1) {
          // flags: one for an eighth (or dotted eighth), two for a sixteenth
          const flags = gl.value < 0.3 ? 2 : 1;
          const d = h.up ? 1 : -1;
          for (let f = 0; f < flags; f++) {
            const e = h.stemEnd + d * f * 8;
            const sx = h.stemX;
            add(
              rc.path(`M ${sx} ${e} C ${sx + 1} ${e + d * 8} ${sx + 12} ${e + d * 11} ${sx + 9} ${e + d * 24}`, {
                seed: seed + f,
                roughness: 0.5,
                strokeWidth: 2.2,
                stroke: ink.deep,
              }),
            );
          }
        }
        if ([3, 1.5, 0.75].includes(gl.value)) {
          add(rc.circle(x + 15, pos % 2 === 0 ? y - 4 : y, 3.5, { fill: ink.deep, fillStyle: "solid", stroke: ink.deep, seed: 4 }));
        }
        for (let p = -2; p >= pos; p -= 2) line(x - 12, lineY(g.staffTop, p), x + 12, lineY(g.staffTop, p));
        for (let p = 10; p <= pos; p += 2) line(x - 12, lineY(g.staffTop, p), x + 12, lineY(g.staffTop, p));
      }

      for (const bl of beamLines) {
        // the beam's outer edge sits on the stem ends
        const t = bl.up ? BEAM_W : -BEAM_W;
        add(
          rc.polygon(
            [
              [bl.x1 - 0.7, bl.y1],
              [bl.x2 + 0.7, bl.y2],
              [bl.x2 + 0.7, bl.y2 + t],
              [bl.x1 - 0.7, bl.y1 + t],
            ],
            { seed: seedOf(`beam${bl.x1}:${bl.y1}`), roughness: 0.4, fill: ink.deep, fillStyle: "solid", stroke: ink.deep, strokeWidth: 0.8 },
          ),
        );
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
    [systems, perSystem, ks.count, firstBar, lastBar, melodyKey, tune.melodyCoverage, formEnd, selectedId,JSON.stringify(segs.map((s) => [s.move.id, s.x1, s.x2]))],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={`block select-none ${fit ? "h-full w-full" : "h-auto w-full"}`}
      role="img"
      aria-label={`Lead sheet for ${tune.title}`}
    >
      <g ref={washRef} className="wash wash-shapes" opacity={0.55} />

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

      {/* tempo and feel, over the first line */}
      {firstBar === 1 && (
        <text x={LEFT + 2} y={TOP + 50} className="fill-ink font-hand" fontSize={15} fontWeight={700}>
          {FEEL_LABEL[tune.feel]}{" "}
          <tspan fontFamily="Noto Music" fontSize={17}>
            ♩
          </tspan>
          {` = ${tune.tempo}`}
        </text>
      )}

      {/* accidentals: held to the barline, cancelled with a natural (see notation.ts) */}
      {[...heads.values()]
        .filter((h) => h.glyph.accidental !== null)
        .map((h) => {
          const a = h.glyph.accidental!;
          return (
            <text key={`acc${h.bar}:${h.glyph.beat}`} x={h.x - 18} y={h.y + 5} fontFamily="Noto Music" fontSize={34} className="fill-ink">
              {a === 0 ? "♮" : a > 0 ? "♯" : "♭"}
            </text>
          );
        })}

      {/* rests */}
      {bars.flatMap((b) => {
        const g = geo(b);
        return (sheet.get(b)?.glyphs ?? [])
          .filter((gl) => gl.pitch === null)
          .map((gl) => {
            const whole = gl.value === bpb;
            const r = REST[whole ? "whole" : String(gl.value)] ?? REST["0.5"];
            return (
              <text
                key={`rest${b}:${gl.beat}`}
                x={whole ? g.x + g.w / 2 : beatX(b, gl.beat) + 12}
                y={g.staffTop + r.baseline}
                textAnchor="middle"
                fontFamily="Noto Music"
                fontSize={40}
                className="fill-ink"
              >
                {r.glyph}
              </text>
            );
          });
      })}

      {/* ties: curve away from the stems */}
      {ties.map((t, i) => {
        const d = t.below ? 1 : -1;
        const y0 = t.y + d * 7;
        const mx = (t.x1 + t.x2) / 2;
        const bulge = d * Math.min(9, 3 + (t.x2 - t.x1) / 12);
        return (
          <path
            key={`tie${i}`}
            d={`M ${t.x1} ${y0} Q ${mx} ${y0 + bulge * 2} ${t.x2} ${y0} Q ${mx} ${y0 + bulge * 2 - d * 3} ${t.x1} ${y0} Z`}
            fill={ink.deep}
            stroke={ink.deep}
            strokeWidth={0.6}
          />
        );
      })}

      {/* wash labels (lane-packed; see `labels` above) */}
      {labels.map((l) => {
        const s = l.item;
        const y = s.y0 + LANE_Y[l.lane];
        return (
          <g key={s.move.id}>
            {l.lane > 0 && (
              <path
                d={`M ${l.x + 3} ${y + 4} Q ${l.x + 1} ${y + 12} ${Math.max(s.x1 + 6, Math.min(l.x + 3, s.x2 - 6))} ${s.y0 + 24}`}
                fill="none"
                stroke={ink.soft}
                strokeWidth={1.2}
                strokeLinecap="round"
                opacity={0.7}
              />
            )}
            <text x={l.x} y={y} transform={`rotate(-2 ${l.x} ${y})`} className="fill-ink-soft font-marker" fontSize={14} fontWeight={700}>
              {l.truncated && <title>{s.move.title}</title>}
              {l.shown}
            </text>
          </g>
        );
      })}

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

      {/* chord click targets, from each symbol to the next chord (or the barline). Drawn under the
          moves' targets, so a click inside a wash still opens its move. */}
      {onChord &&
        chords
          .filter((c) => c.at.bar >= firstBar && c.at.bar <= lastBar)
          .map((c) => {
            const g = geo(c.at.bar);
            const x1 = beatX(c.at.bar, c.at.beat) - 6;
            const next = chords.find((o) => o.at.bar === c.at.bar && o.at.beat > c.at.beat);
            const x2 = next ? beatX(next.at.bar, next.at.beat) - 8 : g.x + g.w - 2;
            return (
              <rect
                key={`ct${c.id}`}
                data-chord-target={c.id}
                x={x1}
                y={g.y0 + 34}
                width={Math.max(12, x2 - x1)}
                height={36}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onChord(c.id)}
              >
                <title>{`${prettySymbol(symbol(c))}: show this chord`}</title>
              </rect>
            );
          })}

      {/* click targets: one Tab stop per move (its first segment; a move wrapping onto the next
          line has a second, click-only segment), Enter / Space opens it like a click */}
      {segs.map((s, i) => {
        const first = segs.findIndex((o) => o.move.id === s.move.id) === i;
        return (
          <rect
            key={i}
            x={s.x1}
            y={s.y0 + 20}
            width={s.x2 - s.x1}
            height={118}
            fill="transparent"
            className="cursor-pointer"
            role="button"
            tabIndex={first ? 0 : -1}
            aria-hidden={first ? undefined : true}
            aria-pressed={s.move.id === selectedId}
            aria-label={`${s.move.title}, bar ${s.move.span.from.bar}`}
            onClick={() => onSelect(s.move.id)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onSelect(s.move.id);
            }}
          />
        );
      })}
    </svg>
  );
}
