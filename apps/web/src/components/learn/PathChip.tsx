import type { ConceptStatus } from "@reharm/theory-core";
import { pen } from "../../design/tokens";
import { chipFor } from "../../learn/pathModel";

/**
 * A concept's state chip in the house idioms (spec §C): Recommended first dashed ink-soft,
 * Learning solid ink, Familiar a mustard wash, Proficient "n/12" on sage, Mastered the teacher's
 * red-pen CLEAN stamp. New shows nothing.
 */
export function PathChip({ status, className = "" }: { status: ConceptStatus | undefined; className?: string }) {
  const { kind, text } = chipFor(status);
  if (kind === "new") return null;
  const base = `inline-block whitespace-nowrap rounded-full px-2 text-xs leading-5 font-marker ${className}`;
  switch (kind) {
    case "recommended":
      return <span className={`${base} border-2 border-dashed border-ink-soft text-ink-soft`}>{text}</span>;
    case "learning":
      return <span className={`${base} border-2 border-ink text-ink`}>{text}</span>;
    case "familiar":
      return <span className={`${base} border border-ink-soft bg-wash-mustard/40 text-ink`}>{text}</span>;
    case "proficient":
      return (
        <span className={`${base} border border-ink-soft bg-wash-sage/50 text-ink`}>
          {text}
          <span className="sr-only"> keys clean (Proficient)</span>
        </span>
      );
    case "mastered":
      return (
        <span className={`${base} -rotate-6 rounded border-2 tracking-widest`} style={{ borderColor: pen.red, color: pen.red }}>
          {text}
          <span className="sr-only"> (Mastered)</span>
        </span>
      );
  }
}

/** The red-pen dot for "due for review", top right of a card. */
export function DueDot({ className = "" }: { className?: string }) {
  return (
    <span className={`text-xs ${className}`} style={{ color: pen.red }}>
      <span aria-hidden>●</span>
      <span className="sr-only">Due</span>
    </span>
  );
}
