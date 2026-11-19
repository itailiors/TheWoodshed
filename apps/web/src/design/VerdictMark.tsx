import { ink, paper } from "./tokens";
import { markPath, VERDICT_MARK, type Verdict } from "./verdictMarks";

/**
 * A verdict's shape (verdictMarks.ts) in SVG: ink on a paper halo, so it reads on any wash it
 * sits on (blue, mustard, pen red) and in every theme. Decorative: the label lives in text nearby.
 */
export function VerdictMark({ verdict, cx, cy, r }: { verdict: Verdict; cx: number; cy: number; r: number }) {
  const { shape, filled } = VERDICT_MARK[verdict];
  const d = markPath(shape, cx, cy, r);
  const w = shape === "cross" ? r * 0.45 : r * 0.3;
  const fill = shape === "cross" ? "none" : filled ? ink.deep : paper.light;
  return (
    <g aria-hidden data-verdict-mark={shape} strokeLinejoin="round" strokeLinecap="round">
      <path d={d} fill={fill === "none" ? "none" : paper.light} stroke={paper.light} strokeWidth={w + r * 0.5} />
      <path d={d} fill={fill} stroke={ink.deep} strokeWidth={w} />
    </g>
  );
}

/** A legend chip: the verdict's colour with its shape on top. */
export function VerdictSwatch({ verdict, color, className = "" }: { verdict: Verdict; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 12" className={`inline-block h-3 w-6 shrink-0 -rotate-2 ${className}`} aria-hidden>
      <rect x={0} y={0} width={24} height={12} rx={2} fill={color} />
      <VerdictMark verdict={verdict} cx={12} cy={6} r={4} />
    </svg>
  );
}
