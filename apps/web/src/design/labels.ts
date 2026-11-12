import { useEffect, useState } from "react";

/*
 * Label layout for the hand-drawn SVGs (the lead sheet's move names, the heatmap's chord
 * names): measure each label in its real font, then pack labels into lanes so none overlap,
 * the way a calendar stacks overlapping events.
 */

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

/** Width of `text` in `font` (a CSS font shorthand, e.g. "700 14px Kalam"), in px = SVG user units at that size. */
export function textWidth(text: string, font: string): number {
  const key = `${font}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  ctx ??= typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  let w: number;
  if (ctx) {
    ctx.font = font;
    w = ctx.measureText(text).width;
  } else {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 14);
    w = text.length * size * 0.62; // no canvas (tests): a fair estimate for Kalam
  }
  // only trust measurements once the web font has arrived (fallback-font widths differ)
  if (fontsSettled) cache.set(key, w);
  return w;
}

let fontsSettled = typeof document === "undefined";
const fontsReady: Promise<void> =
  typeof document !== "undefined" && document.fonts ? document.fonts.ready.then(() => void (fontsSettled = true)) : Promise.resolve();

/** Re-render once the web fonts have loaded, so measured label widths are the real ones. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(fontsSettled);
  useEffect(() => {
    if (ready) return;
    let live = true;
    void fontsReady.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [ready]);
  return ready;
}

export interface LabelIn<T> {
  item: T;
  text: string;
  /** Where the label wants to start (left edge). */
  x: number;
  width: number;
  /** The label may not end past this (e.g. the drawing's right edge). */
  maxRight: number;
}

export interface LabelOut<T> extends LabelIn<T> {
  lane: number;
  /** The text to draw: shortened with "…" only if no lane had room. */
  shown: string;
  truncated: boolean;
}

/**
 * Greedy lane packing. Labels keep their start position (shifted left only to stay inside
 * `maxRight`) and go in the lowest lane where they clear the previous label by `gap`. When
 * every lane is taken, the label goes in lane 0, shortened to the room left before the next
 * label starts. Input order doesn't matter; output is in x order.
 */
export function packLabels<T>(labels: LabelIn<T>[], opts: { lanes: number; gap?: number; font: string; minX?: number }): LabelOut<T>[] {
  const gap = opts.gap ?? 8;
  const sorted = [...labels].sort((a, b) => a.x - b.x);
  const laneEnd: number[] = Array(Math.max(1, opts.lanes)).fill(-Infinity);
  return sorted.map((l, i) => {
    const x = Math.max(opts.minX ?? -Infinity, Math.min(l.x, l.maxRight - l.width));
    const lane = laneEnd.findIndex((end) => end + gap <= x);
    if (lane >= 0) {
      laneEnd[lane] = x + l.width;
      return { ...l, x, lane, shown: l.text, truncated: false };
    }
    // no room anywhere: lane 0, cut to the space before the next label (or the edge)
    const next = sorted[i + 1];
    const room = Math.max(24, Math.min(next ? next.x - gap : l.maxRight, l.maxRight) - l.x);
    const shown = ellipsize(l.text, room, opts.font);
    const width = textWidth(shown, opts.font);
    laneEnd[0] = Math.max(laneEnd[0], l.x + width);
    return { ...l, x: l.x, width, lane: 0, shown, truncated: shown !== l.text };
  });
}

function ellipsize(text: string, room: number, font: string): string {
  if (textWidth(text, font) <= room) return text;
  for (let n = text.length - 1; n > 1; n--) {
    const s = text.slice(0, n).trimEnd() + "…";
    if (textWidth(s, font) <= room) return s;
  }
  return text.slice(0, 1) + "…";
}
