import { useRef } from "react";
import { useRough } from "../../design/rough";
import { ink, keys as keyTone, pen, sageInk, seedOf, wash } from "../../design/tokens";

const WW = 22;
const WH_FULL = 112;
const BW = 13;
const BH_FULL = 70;
const LABEL_ROOM = 52; // room for red-pen labels above the keys
const SLIM_ROOM = 10; // with `slim`, while there's nothing to write above the keys
const SPLIT_MIDI = 55; // G3: notes below G3 are left-hand bass/shell; G3 and up are right-hand upper voices
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

export interface PenMark {
  midi: number;
  label: string;
  /** Write it heavier (a guide tone among colour tones); the others go lighter. */
  strong?: boolean;
}

export type HandMark = { midi: number; hand: "L" | "R" };

export interface PenKeyboardProps {
  low?: number;
  high?: number;
  /** Ghost of the reference voicing (dashed outline). */
  target?: number[];
  /** What you played on the current step (ink dots). */
  played?: number[];
  /** On-screen selection waiting to be struck. */
  pending?: number[];
  /** Red circles: notes that should be there. */
  missing?: PenMark[];
  /** Red crosses: notes that shouldn't. */
  wrong?: PenMark[];
  /** Draw the big red checkmark. */
  check?: boolean;
  /** Show the LH / RH split marker at G3 (MIDI 55). Default true. */
  showSplit?: boolean;
  onKey?: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
  className?: string;
  /** Keep the band above the keys only while there are red-pen marks to write there (saves height on a phone). */
  slim?: boolean;
  /** Ink note names written above keys (study mode: which notes to press). */
  labels?: PenMark[];
  /** A small sage-ink tick on these keys (a right answer). */
  ticks?: number[];
  /** Shorter keys (a keyboard docked at the bottom of a phone screen). */
  short?: boolean;
  /** A mustard ring around these keys (a valid alternative). */
  rings?: number[];
  /** An ink double ring around these keys (the guide tones of a voicing). */
  guides?: number[];
  /** Wash these keys by hand: LH brick with a square tag, RH blue with a dot. */
  hands?: HandMark[];
  /** Labels written ON the keys (a lesson step's lit keys: "3rd", "♭9"), at the foot of each key. */
  keyLabels?: PenMark[];
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
export function PenKeyboard({
  low = 36,
  high = 84,
  target = [],
  played = [],
  pending = [],
  missing = [],
  wrong = [],
  check,
  showSplit = true,
  onKey,
  onKeyUp,
  className = "",
  slim = false,
  labels = [],
  ticks = [],
  rings = [],
  guides = [],
  hands = [],
  short = false,
  keyLabels = [],
}: PenKeyboardProps) {
  const WH = short ? 60 : WH_FULL;
  const BH = short ? 38 : BH_FULL;
  const here = (mk: PenMark) => mk.midi >= low && mk.midi <= high; // a split keyboard gets the whole chord's marks
  const TOP = slim && !missing.some(here) && !wrong.some(here) && !labels.some(here) && !check ? SLIM_ROOM : LABEL_ROOM;
  const { keys, width } = layout(low, high);
  // Toggle keyboards (no onKeyUp: tap notes in, then strike) act on a tap when touched, so a page
  // scroll that starts on the keyboard doesn't add notes. Mouse clicks still act on press.
  const toggleOnTap = !!onKey && !onKeyUp;
  const lastPointer = useRef<string>("mouse");
  const pos = new Map(keys.map((k) => [k.midi, k]));
  const splitX = showSplit ? pos.get(SPLIT_MIDI)?.x ?? null : null;
  const center = (m: number) => {
    const k = pos.get(m);
    if (!k) return null;
    return { x: k.x + (k.black ? BW : WW) / 2, y: TOP + (k.black ? BH - 14 : WH - 16), black: k.black };
  };
  const g = useRef<SVGGElement>(null);
  const marks = useRef<SVGGElement>(null);
  // Never render target and played for two different chords at the same time:
  // if a strike was played on this step, only show unplayed target notes as dashed ghosts.
  const playedSet = new Set(played);
  const visibleTarget = target.filter((m) => !playedSet.has(m));
  const keyState = JSON.stringify([low, high, visibleTarget, played, pending, splitX, TOP, WH, hands]);
  const markState = JSON.stringify([missing, wrong, check, TOP, ticks, rings, guides, WH]);
  const handOf = new Map(hands.map((h) => [h.midi, h.hand]));
  const handWash = (m: number) => (handOf.get(m) === "L" ? wash.brick : handOf.get(m) === "R" ? wash.blue : null);

  useRough(
    g,
    (rc, add) => {
      const base = { stroke: keyTone.line, strokeWidth: 1.1, roughness: 0.7 };
      const pend = new Set(pending);
      for (const k of keys.filter((k) => !k.black)) {
        // a lit key's hachure sits on the key's own colour, not on the page (dark in Northgate, where the gaps read as brown)
        if (pend.has(k.midi)) add(rc.rectangle(k.x, TOP, WW, WH, { stroke: "none", seed: seedOf("pwb" + k.midi), fill: keyTone.white, fillStyle: "solid", roughness: 0 }));
        add(rc.rectangle(k.x, TOP, WW, WH, { ...base, seed: seedOf("pw" + k.midi), fill: pend.has(k.midi) ? wash.mustard : keyTone.white, fillStyle: pend.has(k.midi) ? "hachure" : "solid", hachureGap: 3 }));
        // a watercolour wash on the visible part of the key (below the black keys)
        const fill = pend.has(k.midi) ? null : handWash(k.midi);
        if (fill) add(rc.rectangle(k.x + 2, TOP + BH + 2, WW - 4, WH - BH - 4, { stroke: "none", seed: seedOf("pwf" + k.midi), fill, fillStyle: "hachure", hachureGap: 3, fillWeight: 1.6, roughness: 0.9 }));
      }
      for (const k of keys.filter((k) => k.black)) {
        const fill = pend.has(k.midi) ? wash.mustard : handWash(k.midi) ?? keyTone.black;
        add(rc.rectangle(k.x, TOP, BW, BH, { ...base, seed: seedOf("pb" + k.midi), fill, fillStyle: "solid" }));
      }
      // the hand's shape tag at the foot of the key, so the hands don't rely on colour alone
      for (const [m, hand] of handOf) {
        const k = pos.get(m);
        if (!k) continue;
        const cx = k.x + (k.black ? BW : WW) / 2;
        const y = TOP + (k.black ? BH : WH) - 5;
        const tone = k.black ? keyTone.white : keyTone.black;
        const tag = { seed: seedOf("hand" + m), fill: tone, fillStyle: "solid", stroke: tone, strokeWidth: 1, roughness: 0.4 };
        add(hand === "L" ? rc.rectangle(cx - 2.5, y - 2.5, 5, 5, tag) : rc.circle(cx, y, 5.5, tag));
      }
      if (splitX !== null) {
        add(
          rc.line(splitX, TOP - 6, splitX, TOP + WH + 4, {
            stroke: ink.soft,
            strokeWidth: 1.5,
            roughness: 0.9,
            strokeLineDash: [4, 4],
            seed: seedOf("split55"),
          }),
        );
      }
      for (const m of visibleTarget) {
        const c = center(m);
        if (!c) continue;
        // Coach tints the LH ghost blue; with hand washes on, blue means RH, so the ghost stays neutral
        const isLh = m < SPLIT_MIDI && hands.length === 0;
        add(
          rc.circle(c.x, c.y, 15, {
            seed: seedOf("t" + m),
            stroke: c.black ? keyTone.white : isLh ? wash.blue : keyTone.soft,
            strokeWidth: 1.6,
            roughness: 1,
            strokeLineDash: [3, 3],
          }),
        );
      }
      for (const m of played) {
        const c = center(m);
        if (c) add(rc.circle(c.x, c.y, 10, { seed: seedOf("p" + m), fill: c.black ? keyTone.white : keyTone.black, fillStyle: "solid", stroke: c.black ? keyTone.white : keyTone.line, roughness: 0.6 }));
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
      ticks.forEach((m) => {
        const c = center(m);
        if (!c) return;
        const y = c.y - 20;
        add(rc.linearPath([[c.x - 6, y], [c.x - 1.5, y + 5], [c.x + 7, y - 6]], { stroke: sageInk, strokeWidth: 2.6, roughness: 0.9, seed: seedOf("tick" + m) }));
      });
      rings.forEach((m) => {
        const c = center(m);
        if (c) add(rc.ellipse(c.x, c.y, 24, 22, { stroke: wash.mustard, strokeWidth: 3, roughness: 1.2, seed: seedOf("ring" + m) }));
      });
      guides.forEach((m) => {
        const c = center(m);
        if (!c) return;
        const stroke = c.black ? keyTone.white : keyTone.line;
        add(rc.ellipse(c.x, c.y, 22, 20, { stroke, strokeWidth: 1.6, roughness: 0.8, seed: seedOf("g1" + m) }));
        add(rc.ellipse(c.x, c.y, 29, 27, { stroke, strokeWidth: 1.6, roughness: 0.8, seed: seedOf("g2" + m) }));
      });
      if (check) {
        const x = width - 70;
        add(rc.path(`M ${x} 26 L ${x + 16} 44 L ${x + 52} 4`, { ...red, strokeWidth: 4, roughness: 1.2, seed: 77 }));
      }
    },
    [markState, width],
  );

  return (
    <svg viewBox={`-2 0 ${width + 4} ${TOP + WH + 16}`} className={`block h-auto w-full touch-manipulation select-none ${className}`} role="group" aria-label="Practice keyboard">
      <g ref={g} />
      {keys
        .filter((k) => !k.black && k.midi % 12 === 0)
        .map((k) => (
          <text key={k.midi} x={k.x + WW / 2} y={TOP + WH + 13} textAnchor="middle" fontSize={10} className="fill-ink-faint font-hand">
            C{k.midi / 12 - 1}
          </text>
        ))}
      {splitX !== null && (
        <g aria-label="Left and right hand split at G3">
          <text x={splitX - 5} y={TOP + WH + 13} textAnchor="end" fontSize={10} className="fill-ink-soft font-marker">
            ← LH
          </text>
          <text x={splitX + 5} y={TOP + WH + 13} textAnchor="start" fontSize={10} className="fill-ink-soft font-marker">
            G3 · RH →
          </text>
        </g>
      )}
      <g ref={marks} />
      {keyLabels.filter(here).map((mk) => {
        const k = pos.get(mk.midi)!;
        return (
          <text
            key={`kl${mk.midi}`}
            data-key-label={mk.midi}
            x={k.x + (k.black ? BW : WW) / 2}
            y={TOP + (k.black ? BH : WH) - 6}
            textAnchor="middle"
            // short labels (a note name, "3rd", "home") at a size that reads; long ones spill, so lessons keep them short
            fontSize={k.black ? 11 : 12}
            fontWeight={700}
            // key colours, not page ink (a dark theme keeps cream keys): a lit key is washed mustard, so its
            // label is the black-key colour, like a white key's; an unlit black key gets the white-key colour
            fill={k.black && !pending.includes(mk.midi) ? keyTone.white : keyTone.black}
            // a halo in the key's own colour keeps the word readable over the hachure wash
            stroke={k.black && !pending.includes(mk.midi) ? keyTone.black : k.black ? wash.mustard : keyTone.white}
            strokeWidth={3}
            paintOrder="stroke"
            strokeLinejoin="round"
            className="pointer-events-none font-marker"
          >
            {mk.label}
          </text>
        );
      })}
      {missing.map((mk, i) => {
        const c = center(mk.midi);
        return c ? (
          <text key={`ml${i}`} x={c.x} y={14 + (i % 2) * 18} textAnchor="middle" fontSize={15} fontWeight={700} className="font-marker" fill={pen.red}>
            {mk.label}
          </text>
        ) : null;
      })}
      {[...labels]
        .filter(here)
        .sort((a, b) => a.midi - b.midi)
        .map((mk, i) => {
          // neighbours a half step apart would collide: alternate two heights
          const c = center(mk.midi);
          // with any strong mark, the rest are colour tones: lighter and smaller, so the shell reads first
          const light = mk.strong === false || (!mk.strong && labels.some((l) => l.strong));
          return c ? (
            <text
              key={`nl${mk.midi}`}
              x={c.x}
              y={TOP - 8 - (i % 2) * 17}
              textAnchor="middle"
              fontSize={light ? 12 : mk.strong ? 16 : 14}
              fontWeight={light ? 400 : 700}
              data-strong={mk.strong || undefined}
              className={`font-marker ${light ? "fill-ink-soft" : "fill-ink"}`}
            >
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
            // test hook (like data-midi): the hint is drawn by Rough.js, so mark it in the DOM too
            data-target={target.includes(k.midi) || undefined}
            x={k.x}
            y={TOP}
            width={k.black ? BW : WW}
            height={k.black ? BH : WH}
            fill="transparent"
            className="cursor-pointer"
            onPointerDown={(e) => {
              lastPointer.current = e.pointerType;
              if (toggleOnTap && e.pointerType !== "mouse") return; // wait for the tap (click)
              e.preventDefault();
              onKey(k.midi);
            }}
            onClick={toggleOnTap ? () => lastPointer.current !== "mouse" && onKey(k.midi) : undefined}
            onPointerUp={() => onKeyUp?.(k.midi)}
            onPointerLeave={(e) => e.buttons && onKeyUp?.(k.midi)}
          />
        ))}
    </svg>
  );
}
