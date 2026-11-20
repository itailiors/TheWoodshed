import { canonicalMove, CONCEPTS, isBasicsId, learnName, prettyNote, RULES, type ConceptNode, type ConceptStatus, type Tier } from "@reharm/theory-core";
import type { OwnProgress } from "./pathStates";

/*
 * What the Path tab and the Coach's "Your path" rail show (spec §B–C), as plain data: the tier
 * bands, each concept's state chip and Next up's one-line reason. Pure. States come only from
 * `usePathStates` (this browser's own runs and lesson flags, never the demo's sample: rule 11).
 */

export const TIER_HEADING: Record<Tier, string> = {
  0: "Foundations",
  1: "First moves",
  2: "Core colours",
  3: "Borrowed and bold",
  4: "Out",
};

/** The optional floor for a newcomer (Gate 0 item 7): tagged "optional" on the path. */
export const OPTIONAL_CONCEPTS: ReadonlySet<string> = new Set(["basics:sevenths", "basics:numerals"]);

export interface TierBand {
  tier: Tier;
  heading: string;
  nodes: ConceptNode[];
}

/** Every concept once, in tier bands (Foundations first), `CONCEPTS` order within a band. */
export function tierBands(): TierBand[] {
  return ([0, 1, 2, 3, 4] as const)
    .map((tier) => ({ tier, heading: TIER_HEADING[tier], nodes: CONCEPTS.filter((c) => c.tier === tier) }))
    .filter((b) => b.nodes.length > 0);
}

/** The path's reading order, flattened (the rail's ‹ Prev / Next › walks it). */
export const pathOrder = (): string[] => tierBands().flatMap((b) => b.nodes.map((n) => n.id));

/** "Recommended first: Guide tones →", or "Recommended first: The tritone +1 →" with two unmet. */
export function recommendedFirstLabel(unmet: readonly string[]): string {
  if (!unmet.length) return "";
  return `Recommended first: ${learnName(unmet[0])}${unmet.length > 1 ? ` +${unmet.length - 1}` : ""} →`;
}

export type ChipKind = "new" | "recommended" | "learning" | "familiar" | "proficient" | "mastered";

/** A concept's state chip (spec §C table). New has no chip text. */
export function chipFor(s: ConceptStatus | undefined): { kind: ChipKind; text: string } {
  switch (s?.state) {
    case "recommendedFirst":
      return { kind: "recommended", text: recommendedFirstLabel(s.recommendedFirst) };
    case "learning":
      return { kind: "learning", text: "Learning" };
    case "familiar":
      return { kind: "familiar", text: "Familiar" };
    case "proficient":
      return { kind: "proficient", text: `${s.cleanKeys}/12` };
    case "mastered":
      return { kind: "mastered", text: "CLEAN" };
    default:
      return { kind: "new", text: "" };
  }
}

const ms = (t: string | number | Date) => new Date(t).getTime();

/** The keys of a concept due for review now, from the player's OWN runs (engine spelling). */
export function dueKeys(own: OwnProgress, conceptId: string, now: number): string[] {
  return own.concepts.filter((r) => r.ruleId === conceptId && ms(r.dueAt) <= now).map((r) => r.keyTonic);
}

/**
 * Next up's reason line: "Due in G♭" / "Due in 3 keys", "Learning", "New · builds on Dominant
 * resolution ✓", or "New · a foundation".
 */
export function nextUpReason(conceptId: string, states: ReadonlyMap<string, ConceptStatus>, own: OwnProgress, now: number): string {
  const s = states.get(conceptId);
  if (s?.due) {
    const keys = dueKeys(own, conceptId, now);
    return keys.length === 1 ? `Due in ${prettyNote(keys[0])}` : `Due in ${keys.length} keys`;
  }
  if (s?.state === "learning") return "Learning";
  const node = CONCEPTS.find((c) => c.id === conceptId);
  const met = (node?.hard ?? []).filter((h) => {
    const st = states.get(h)?.state;
    return st === "familiar" || st === "proficient" || st === "mastered";
  });
  if (met.length) return `New · builds on ${met.map(learnName).join(" and ")} ✓`;
  return isBasicsId(conceptId) ? "New · a foundation" : "New";
}

const LEVEL = new Map<string, number | null>();
/** A rule's dial level on its canonical progression (as the Coach drills it); null for a basic. */
export function conceptLevel(conceptId: string): number | null {
  if (isBasicsId(conceptId) || !RULES.some((r) => r.id === conceptId)) return null;
  if (!LEVEL.has(conceptId)) LEVEL.set(conceptId, canonicalMove(conceptId, "C")?.level ?? null);
  return LEVEL.get(conceptId)!;
}

/** "Builds on: The tritone, Dominant resolution · Pairs well with: Secondary dominant" (empty when neither). */
export function prereqLine(node: ConceptNode): string {
  const parts = [
    node.hard.length ? `Builds on: ${node.hard.map(learnName).join(", ")}` : "",
    node.soft.length ? `Pairs well with: ${node.soft.map(learnName).join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
