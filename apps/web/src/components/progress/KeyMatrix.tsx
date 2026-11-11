import { chroma, KEYS, prettyNote } from "@reharm/theory-core";
import { pen, wash } from "../../design/tokens";
import type { Review } from "../../library/practice";

/** A concept + key to practise (from the clipboard, or a key on a passport page). */
export interface PractiseRequest {
  ruleId: string;
  keyTonic: string;
  lastPlace: { tuneId: string; moveId: string } | null;
}

/** Passport pages run round the circle of fifths, the order you'd take a concept through the keys. */
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map((c) => KEYS.find((k) => chroma(k) === c)!);
const ms = (t: string | number) => new Date(t).getTime();

/**
 * One concept's passport page: the 12 keys round the circle of fifths. A key you've played
 * clean gets an ink wash and a red stamp; one you've tried shows a dashed outline with your
 * last grade; untouched keys are faint. Click any key to practise it there.
 */
export function KeyMatrix({
  ruleId,
  reviews,
  clean,
  now,
  lastPlace,
  onPractise,
  current,
  compact = false,
}: {
  ruleId: string;
  reviews: Review[];
  clean: string[];
  now: number;
  lastPlace: PractiseRequest["lastPlace"];
  onPractise: (r: PractiseRequest) => void;
  /** The key being drilled right now (ringed in red pen). */
  current?: string;
  /** Four across, for a narrow column (the Coach page's side panel). */
  compact?: boolean;
}) {
  const byKey = new Map(reviews.map((r) => [chroma(r.keyTonic), r]));
  const cleanSet = new Set(clean.map(chroma));
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        <span className="font-marker text-ink">{clean.length} of 12 keys</span> played clean. Round the circle of fifths, a key at a time.
      </p>
      <ol className={compact ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"}>
        {FIFTHS.map((k, i) => {
          const r = byKey.get(chroma(k));
          const isClean = cleanSet.has(chroma(k));
          const due = r && ms(r.dueAt) <= now;
          const here = current !== undefined && chroma(current) === chroma(k);
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onPractise({ ruleId, keyTonic: k, lastPlace })}
                aria-current={here || undefined}
                aria-label={`${prettyNote(k)}${here ? " (drilling now)" : ""}: ${isClean ? "clean" : r ? `tried ${r.attempts}×, last grade ${r.lastGrade}/5` : "not tried yet"}. Practise it.`}
                className={`relative grid aspect-square w-full cursor-pointer place-items-center rounded-lg transition-transform hover:-rotate-2 ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.4deg]"}`}
              >
                <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full" aria-hidden filter="url(#ink-wobble)">
                  {isClean && <ellipse cx="40" cy="41" rx="34" ry="31" fill={wash.blue} opacity="0.35" filter="url(#watercolor)" />}
                  <rect
                    x="5"
                    y="5"
                    width="70"
                    height="70"
                    rx="8"
                    fill="none"
                    stroke={isClean ? "var(--color-ink)" : "var(--color-ink-faint)"}
                    strokeWidth={isClean ? 2.2 : 1.4}
                    strokeDasharray={isClean ? undefined : r ? "5 3" : "2 4"}
                  />
                  {here && <rect x="1.5" y="1.5" width="77" height="77" rx="11" fill="none" stroke={pen.red} strokeWidth="2.4" />}
                </svg>
                <span className={`relative font-marker ${compact ? "text-lg" : "text-2xl"} ${isClean || r ? "text-ink" : "text-ink-faint"}`}>{prettyNote(k)}</span>
                {isClean && (
                  // the teacher's stamp
                  <span
                    className="absolute bottom-2.5 right-2.5 -rotate-12 rounded border-2 px-1 font-marker text-[10px] leading-tight tracking-widest"
                    style={{ borderColor: pen.red, color: pen.red }}
                  >
                    CLEAN
                  </span>
                )}
                {!isClean && r && <span className="absolute bottom-1.5 text-[10px] text-ink-soft">{r.lastGrade}/5</span>}
                {due && <span className="absolute right-1.5 top-1 text-xs" title="due for review" style={{ color: pen.red }}>●</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
