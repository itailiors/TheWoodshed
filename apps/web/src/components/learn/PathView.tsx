import { learnName, type ConceptNode, type ConceptStatus, type Tier } from "@reharm/theory-core";
import { useId, useState } from "react";
import { DEMO } from "../../demo";
import { useNarrow } from "../../device/media";
import { pen } from "../../design/tokens";
import { conceptLevel, OPTIONAL_CONCEPTS, prereqLine, tierBands } from "../../learn/pathModel";
import { usePathStates } from "../../learn/usePathStates";
import { DueDot, PathChip } from "./PathChip";

interface Props {
  /** Open the Coach on this concept (closes the passport). */
  onOpen: (conceptId: string) => void;
}

/** The card's frame per state (spec §C): plain, dashed ghost, solid ink, mustard wash, sage wash. */
function frame(s: ConceptStatus | undefined): string {
  switch (s?.state) {
    case "recommendedFirst":
      return "border-dashed border-ink-soft";
    case "learning":
      return "border-ink";
    case "familiar":
      return "border-ink bg-wash-mustard/20";
    case "proficient":
    case "mastered":
      return "border-ink bg-wash-sage/25";
    default:
      return "border-ink-faint";
  }
}

/**
 * The passport's Path tab (spec §C): every concept in five tier bands, each a card with its state
 * chip; Next up marked "→ next" in red pen; a card's prerequisites underlined on hover or focus.
 * States come only from this browser's own runs and lesson flags (`usePathStates`): the demo's
 * sample notebook never counts (rule 11). A click opens the Coach on the concept; nothing locks.
 */
export function PathView({ onOpen }: Props) {
  const { states, nextUp, progress, loading } = usePathStates(4);
  const narrow = useNarrow();
  const bands = tierBands();
  const firstTier = bands.find((b) => b.nodes.some((n) => n.id === nextUp[0]))?.tier ?? 0;
  /** On a phone the bands fold; the one holding the first Next up item starts open. */
  const [openTiers, setOpenTiers] = useState<ReadonlySet<Tier> | null>(null);
  const isOpen = (t: Tier) => !narrow || (openTiers ? openTiers.has(t) : t === firstTier);
  const toggle = (t: Tier) =>
    setOpenTiers((cur) => {
      const s = new Set(cur ?? [firstTier]);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });
  /** The card under the mouse or focus: its prerequisites get underlined. */
  const [active, setActive] = useState<ConceptNode | null>(null);
  const baseId = useId();

  return (
    <div className="space-y-5" data-path>
      <p className="text-sm text-ink-soft">
        Your path, from this browser's lessons and runs.
        {DEMO && progress?.sample && <span data-path-sample> The sample notebook isn't counted.</span>}
      </p>
      {loading ? (
        <p className="font-marker text-ink-soft">Opening your path…</p>
      ) : (
        bands.map((band) => {
          const open = isOpen(band.tier);
          const listId = `${baseId}-tier-${band.tier}`;
          return (
            <section key={band.tier} aria-labelledby={`${listId}-h`} data-tier={band.tier} className="space-y-2">
              <h3 id={`${listId}-h`} className="font-marker text-xl uppercase">
                {narrow ? (
                  <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => toggle(band.tier)} className="tap-lg flex w-full cursor-pointer items-center justify-between text-left uppercase">
                    {band.heading}
                    <span aria-hidden className="text-base">
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                ) : (
                  band.heading
                )}
              </h3>
              <ul id={listId} hidden={!open} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {band.nodes.map((node) => {
                  const s = states.get(node.id);
                  const next = nextUp.includes(node.id);
                  const level = conceptLevel(node.id);
                  const hardOf = active?.hard.includes(node.id) ?? false;
                  const softOf = active?.soft.includes(node.id) ?? false;
                  const line = prereqLine(node);
                  const lineId = `${baseId}-${node.id}`;
                  return (
                    <li key={node.id}>
                      <a
                        href={`#coach/${node.id}`}
                        data-concept={node.id}
                        data-state={s?.state ?? "new"}
                        data-next={next || undefined}
                        aria-describedby={line ? lineId : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          onOpen(node.id);
                        }}
                        onPointerEnter={() => setActive(node)}
                        onPointerLeave={() => setActive((a) => (a === node ? null : a))}
                        onFocus={() => setActive(node)}
                        onBlur={() => setActive((a) => (a === node ? null : a))}
                        className={`tap-lg relative block h-full rounded-lg border-2 px-3 py-2 text-ink transition-transform hover:-rotate-1 focus-visible:-rotate-1 motion-reduce:hover:rotate-0 ${frame(s)}`}
                        style={next ? { boxShadow: `0 0 0 1.5px ${pen.red}` } : undefined}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`font-marker text-[15px] leading-snug ${hardOf ? "underline decoration-2 underline-offset-4" : softOf ? "underline decoration-dotted decoration-2 underline-offset-4" : ""}`}
                            style={hardOf ? { textDecorationColor: pen.red } : softOf ? { textDecorationColor: "var(--color-ink-soft)" } : undefined}
                          >
                            {learnName(node.id)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {next && (
                              <span className="font-marker text-sm whitespace-nowrap" style={{ color: pen.red }}>
                                → next
                              </span>
                            )}
                            {s?.due && <DueDot />}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                          {level !== null && <span>L{level}</span>}
                          {OPTIONAL_CONCEPTS.has(node.id) && <span>optional</span>}
                          <PathChip status={s} />
                        </span>
                        {line && (
                          <span id={lineId} className={active === node ? "mt-1 block text-xs text-ink-soft" : "sr-only"}>
                            {line}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
