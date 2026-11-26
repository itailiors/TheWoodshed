import { useRef } from "react";
import { useRough, useSize } from "../design/rough";
import { ink, paper, pen, sageInk, seedOf, tint, wash } from "../design/tokens";
import { DAILY_HUB_URL, dailyLabel, type DailyStatus } from "./dailyStatus";

/*
 * The Lab's doors to Reharm Daily (the hub's bridge-spec §1): a pill in the toolbar after
 * 📒 Progress, its 48×48 twin in the desktop rail, and the "← Reharm Daily" way back when a
 * Daily link brought you here. All drawn from theme tokens, so every theme styles them.
 */

/** A pill outline as a path: a rounded rectangle whose ends are half-circles. */
function pillPath(x: number, y: number, w: number, h: number) {
  const r = h / 2;
  return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

/** The counter: a red-pen numeral while puzzles wait, a sage-ink tick once they're all done. */
function Badge({ status, small = false }: { status: DailyStatus; small?: boolean }) {
  if (status.kind === "blocked") return null;
  const done = status.unplayed === 0;
  const size = small ? "h-4 min-w-4 text-[10px]" : "h-5 min-w-5 text-xs";
  return (
    <span
      aria-hidden
      data-daily-badge={done ? "done" : status.unplayed}
      className={`inline-grid place-items-center rounded-full px-1 font-bold leading-none tabular-nums ${size}`}
      style={{ background: done ? sageInk : pen.red, color: paper.light }}
    >
      {done ? "✓" : Math.min(status.unplayed, 7)}
    </span>
  );
}

/** A tiny calendar sheet with three bars of a chart on it. */
function CalendarGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none">
      <rect x="1" y="2.5" width="14" height="12.5" rx="2.5" fill={tint(wash.mustard, 30)} stroke={ink.deep} strokeWidth="1.5" />
      <path d="M4.5 1v3M11.5 1v3M1.5 6.5h13" stroke={ink.deep} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="4" y="9" width="2.2" height="4" rx="0.6" fill={wash.mustard} />
      <rect x="7.2" y="8" width="2.2" height="5" rx="0.6" fill={wash.blue} />
      <rect x="10.3" y="9.5" width="2" height="3.5" rx="0.6" fill={ink.deep} />
    </svg>
  );
}

/**
 * The toolbar pill. The visible pill keeps the toolbar's own height; its link reaches 44px tall
 * (padding cancelled by a negative margin), so the row doesn't grow but a thumb still lands.
 */
export function DailyPill({ status }: { status: DailyStatus }) {
  const [box, size] = useSize<HTMLSpanElement>();
  const g = useRef<SVGGElement>(null);
  const done = status.kind === "ok" && status.unplayed === 0;
  useRough(
    g,
    (rc, add) => {
      if (size.w < 10 || size.h < 10) return;
      const seed = seedOf("daily-pill");
      // double pass: a filled outline, then a lighter second stroke a hair off it
      add(rc.path(pillPath(1, 1, size.w - 2, size.h - 2), { seed, roughness: 0.9, strokeWidth: 1.8, stroke: ink.deep, fill: done ? tint(wash.sage, 30) : paper.light, fillStyle: "solid" }));
      add(rc.path(pillPath(2, 1.5, size.w - 4, size.h - 3), { seed: seed + 1, roughness: 1.1, strokeWidth: 1.1, stroke: tint(ink.deep, 60) }));
    },
    [size.w, size.h, done],
  );
  return (
    <a
      href={DAILY_HUB_URL}
      aria-label={dailyLabel(status)}
      title="Reharm Daily: today's puzzles"
      data-daily-pill
      className="group -my-1.5 inline-flex min-h-11 items-center rounded-full py-1.5 text-ink no-underline pointer-coarse:my-0 pointer-coarse:py-0"
    >
      {/* on touch, the toolbar's pills are 44px tall themselves (pointer-coarse:min-h-11): match them */}
      <span ref={box} className="relative inline-flex items-center gap-1.5 px-3 py-0.5 transition-transform group-hover:-rotate-1 pointer-coarse:min-h-11">
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <g ref={g} />
        </svg>
        <span className="relative inline-flex items-center gap-1.5">
          <CalendarGlyph />
          <span className="font-marker font-bold">Daily</span>
          <Badge status={status} />
          <span aria-hidden className="font-marker text-sm text-ink-soft">
            ↗
          </span>
        </span>
      </span>
    </a>
  );
}

/** The rail's 48×48 twin: a folio calendar sheet with the same counter in its corner. */
export function DailyRailLink({ status }: { status: DailyStatus }) {
  const g = useRef<SVGGElement>(null);
  useRough(
    g,
    (rc, add) => {
      const s = seedOf("daily-rail");
      const o = (seed: number, extra: Record<string, unknown> = {}) => ({ seed, stroke: ink.deep, strokeWidth: 2, roughness: 1, ...extra });
      add(rc.rectangle(6, 7, 28, 28, o(s, { fill: paper.light, fillStyle: "solid" })));
      add(rc.rectangle(7, 7.5, 26.5, 27, o(s + 1, { strokeWidth: 1, stroke: tint(ink.deep, 55) })));
      [12, 20, 28].forEach((x, i) => add(rc.line(x, 4, x, 9, o(s + 2 + i, { strokeWidth: 1.6 }))));
      add(rc.line(8, 14, 32, 14, o(s + 6, { strokeWidth: 1.5 })));
      [
        [11, 23, 9, wash.blue],
        [16, 20, 12, wash.mustard],
        [21, 18, 14, wash.sage],
        [26, 21, 11, ink.deep],
      ].forEach(([x, y, h, c], i) => add(rc.rectangle(x as number, y as number, 3, (h as number) - 1, o(s + 10 + i, { fill: c as string, fillStyle: "solid", stroke: c as string, strokeWidth: 1, roughness: 0.6 }))));
    },
    [],
  );
  return (
    <a
      href={DAILY_HUB_URL}
      aria-label={dailyLabel(status)}
      title="Reharm Daily: today's puzzles"
      data-daily-rail
      className="relative grid h-12 w-12 place-items-center rounded-lg transition-transform hover:-rotate-3 hover:scale-105"
    >
      <svg aria-hidden viewBox="0 0 40 40" className="h-10 w-10 overflow-visible">
        <g ref={g} />
      </svg>
      <span className="absolute top-0.5 right-0.5">
        <Badge status={status} small />
      </span>
    </a>
  );
}

/** "← Reharm Daily": shown when a Daily link opened the Lab, until dismissed. */
export function DailyReturnPill({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div data-daily-return className="mb-2 flex items-center gap-1">
      <a
        href={DAILY_HUB_URL}
        className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-dashed border-ink-faint px-3 font-marker text-ink-soft hover:border-ink hover:text-ink"
      >
        <span aria-hidden>←</span> Reharm Daily
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide the link back to Reharm Daily"
        title="Hide"
        className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full font-marker text-lg text-ink-faint hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
