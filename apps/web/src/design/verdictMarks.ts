import type { LineNoteEval } from "@reharm/theory-core";

export type Verdict = LineNoteEval["verdict"];
export type MarkShape = "dot" | "diamond" | "cross" | "triangle";

/**
 * The heatmap's verdicts as shapes as well as colours (`VERDICT_COLOR`), so a colour-blind
 * player can still tell a chord tone from an avoid note. Each shape carries its own meaning:
 * a solid dot is "in the chord" (the dot the keyboards use for a played note), the hollow
 * diamond a tension, the cross the teacher's ✗, the triangle a note outside the harmony.
 */
export const VERDICT_MARK: Record<Verdict, { shape: MarkShape; label: string; filled: boolean }> = {
  "chord-tone": { shape: "dot", label: "Chord tone", filled: true },
  tension: { shape: "diamond", label: "Tension", filled: false },
  avoid: { shape: "cross", label: "Avoid", filled: false },
  outside: { shape: "triangle", label: "Chromatic / outside", filled: false },
};

/** The verdicts in legend order. */
export const VERDICTS = Object.keys(VERDICT_MARK) as Verdict[];

const f = (n: number) => String(Math.round(n * 100) / 100);

/** An SVG path for `shape`, centred on (cx, cy), fitting inside a circle of radius `r`. */
export function markPath(shape: MarkShape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case "dot": {
      const d = r * 0.8;
      return `M ${f(cx - d)} ${f(cy)} A ${f(d)} ${f(d)} 0 1 0 ${f(cx + d)} ${f(cy)} A ${f(d)} ${f(d)} 0 1 0 ${f(cx - d)} ${f(cy)} Z`;
    }
    case "diamond":
      return `M ${f(cx)} ${f(cy - r)} L ${f(cx + r)} ${f(cy)} L ${f(cx)} ${f(cy + r)} L ${f(cx - r)} ${f(cy)} Z`;
    case "cross": {
      const d = r * 0.7;
      return `M ${f(cx - d)} ${f(cy - d)} L ${f(cx + d)} ${f(cy + d)} M ${f(cx + d)} ${f(cy - d)} L ${f(cx - d)} ${f(cy + d)}`;
    }
    case "triangle":
      // equilateral, inscribed in the circle
      return `M ${f(cx)} ${f(cy - r)} L ${f(cx + r * 0.86)} ${f(cy + r * 0.5)} L ${f(cx - r * 0.86)} ${f(cy + r * 0.5)} Z`;
  }
}

/** A one-line, screen-reader summary of a pass: "12 notes: 50% chord tones, 25% tensions, …". */
export function describeVerdicts(n: number, pct: (v: Verdict) => number): string {
  if (n === 0) return "no notes yet";
  const plural: Record<Verdict, string> = { "chord-tone": "chord tones", tension: "tensions", avoid: "avoid notes", outside: "outside notes" };
  return `${n} note${n === 1 ? "" : "s"}: ${VERDICTS.map((v) => `${pct(v)}% ${plural[v]}`).join(", ")}`;
}
