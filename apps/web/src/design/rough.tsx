import type { RoughSVG } from "roughjs/bin/svg";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export type RoughCanvas = RoughSVG;
type Add = (node: SVGElement) => void;

/*
 * Rough.js arrives as its own small chunk, requested the moment this module loads (so in
 * parallel with the rest of the app, not after it). The page lays out without it, since
 * every sketch is an absolutely-positioned overlay, and the ink strokes appear as soon
 * as it lands. Nothing shifts.
 */
let roughLib: typeof import("roughjs").default | null = null;
const roughReady = import("roughjs").then((m) => {
  roughLib = m.default;
});

/**
 * Draw Rough.js shapes into an <g>. The drawing is redone only when deps change,
 * and shapes take a seed, so the sketch stays put between renders.
 */
export function useRough(gRef: RefObject<SVGGElement | null>, draw: (rc: RoughCanvas, add: Add) => void, deps: unknown[]) {
  const [ready, setReady] = useState(roughLib !== null);
  useLayoutEffect(() => {
    if (ready) return;
    let live = true;
    void roughReady.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [ready]);
  useLayoutEffect(() => {
    const g = gRef.current;
    const svg = g?.ownerSVGElement;
    if (!g || !svg || !roughLib) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    draw(roughLib.svg(svg), (n) => g.appendChild(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps]);
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

interface SketchBoxProps {
  children?: ReactNode;
  className?: string;
  seed?: number;
  fill?: string;
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag" | "dots";
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  inset?: number;
  /** Classes for the content wrapper (e.g. "h-full flex flex-col" when the box must fill its parent). */
  innerClassName?: string;
}

/** A div with a hand-drawn border (and optional sketchy fill) behind its content. */
export function SketchBox({
  children,
  className = "",
  seed = 7,
  fill,
  fillStyle = "solid",
  roughness = 1.3,
  strokeWidth = 1.6,
  stroke = "currentColor",
  inset = 3,
  innerClassName = "",
}: SketchBoxProps) {
  const [wrap, size] = useSize<HTMLDivElement>();
  const g = useRef<SVGGElement>(null);
  useRough(
    g,
    (rc, add) => {
      if (size.w < 10 || size.h < 10) return;
      const opts: Record<string, unknown> = { seed, roughness, strokeWidth, stroke, bowing: 1.4 };
      if (fill) Object.assign(opts, { fill, fillStyle, fillWeight: 1, hachureGap: 5 });
      add(rc.rectangle(inset, inset, size.w - inset * 2, size.h - inset * 2, opts));
    },
    [size.w, size.h, seed, fill, fillStyle, roughness, strokeWidth, stroke, inset],
  );
  return (
    <div ref={wrap} className={`relative ${className}`}>
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-ink">
        <g ref={g} />
      </svg>
      <div className={`relative ${innerClassName}`}>{children}</div>
    </div>
  );
}

/** A hand-drawn horizontal rule that stretches to its container. */
export function SketchRule({ seed = 3, className = "", strokeWidth = 1.6 }: { seed?: number; className?: string; strokeWidth?: number }) {
  const [wrap, size] = useSize<HTMLDivElement>();
  const g = useRef<SVGGElement>(null);
  useRough(
    g,
    (rc, add) => {
      if (size.w > 4) add(rc.line(2, 4, size.w - 2, 4, { seed, roughness: 1.4, strokeWidth, stroke: "currentColor", bowing: 2 }));
    },
    [size.w, seed, strokeWidth],
  );
  return (
    <div ref={wrap} className={`h-2 w-full text-ink ${className}`}>
      <svg aria-hidden className="h-2 w-full overflow-visible">
        <g ref={g} />
      </svg>
    </div>
  );
}

/** Global SVG filters (ink wobble + watercolour wash). Render once near the root. */
export function SketchFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="ink-wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2.4" />
        </filter>
        <filter id="watercolor" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" result="bleed" />
          <feGaussianBlur in="bleed" stdDeviation="0.8" />
        </filter>
      </defs>
    </svg>
  );
}
