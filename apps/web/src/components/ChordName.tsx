import { prettyNote, prettySymbol } from "@reharm/theory-core";

/** Split "B♭7(♭9)" into a big root and a raised suffix, the way a jazz chart is written. */
export function splitSymbol(sym: string): { root: string; suffix: string; slash: boolean } {
  const pretty = prettySymbol(sym);
  const m = /^([A-G][♭♯]*)(.*)$/.exec(pretty);
  if (!m) return { root: pretty, suffix: "", slash: false };
  return { root: m[1], suffix: m[2], slash: m[2].startsWith("/") };
}

export function ChordName({ symbol, className = "" }: { symbol: string; className?: string }) {
  const { root, suffix, slash } = splitSymbol(symbol);
  return (
    <span className={`font-marker font-bold whitespace-nowrap ${className}`}>
      {root}
      {slash ? <span>{suffix}</span> : <sup className="ml-px text-[0.62em] font-normal">{suffix}</sup>}
    </span>
  );
}

/** SVG flavour for the lead sheet. */
export function ChordText({ x, y, symbol, size = 25, active = false }: { x: number; y: number; symbol: string; size?: number; active?: boolean }) {
  const { root, suffix, slash } = splitSymbol(symbol);
  return (
    <text x={x} y={y} className={`font-marker transition-[fill] duration-150 ${active ? "fill-pen" : "fill-ink"}`} fontWeight={700} fontSize={size}>
      {root}
      {suffix && (
        <tspan fontSize={slash ? size : size * 0.6} fontWeight={slash ? 700 : 400} dy={slash ? 0 : -size * 0.38}>
          {suffix}
        </tspan>
      )}
    </text>
  );
}

export const pn = prettyNote;
