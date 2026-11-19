import { QUALITIES, symbol } from "./chords";
import { EAR_MOTION_NAME, motionOfRuleId } from "./ears/motions";
import { prettySymbol } from "./pitch";
import { RULES } from "./ruleset";
import type { Quality } from "./types";
import { VOICING_STYLES, type VoicingStyle } from "./voicing";

/*
 * The practice history files every concept under one `ruleId` per key, whatever taught it.
 * The prefix says which part of the app owns it:
 *   - no prefix: a reharm rule, drilled in the Coach;
 *   - `ear:<motion>`: a Make the Changes motion, played in the Changes tab;
 *   - `shape:<style>:<quality>[+alt…]`: a voicing shape, played in the Voicings tab.
 * Every place that splits the history by kind (the passport, the Coach's due list, routing a
 * "Practise →") asks this registry instead of testing a prefix itself.
 */

export type ConceptKind = "reharm" | "ear" | "shape";

export interface ConceptFamily {
  kind: ConceptKind;
  /** The ruleId prefix, or null for reharm rules (plain rule ids). */
  prefix: string | null;
  /** The chart id runs are filed under when there's no tune (null: the tune being drilled). */
  chart: string | null;
  /** The passport's heading for this family's pages. */
  heading: string;
}

export const CONCEPT_FAMILIES: readonly ConceptFamily[] = [
  { kind: "reharm", prefix: null, chart: null, heading: "Reharm moves" },
  { kind: "ear", prefix: "ear:", chart: "changes", heading: "Changes · the harmony game" },
  { kind: "shape", prefix: "shape:", chart: "voicings", heading: "Voicings · shapes" },
];

export const conceptFamily = (kind: ConceptKind): ConceptFamily => CONCEPT_FAMILIES.find((f) => f.kind === kind)!;

/** Which family a ruleId belongs to. Anything without a known prefix is a reharm rule. */
export const conceptKind = (ruleId: string): ConceptKind => CONCEPT_FAMILIES.find((f) => f.prefix && ruleId.startsWith(f.prefix))?.kind ?? "reharm";

// ── shapes ──

export interface ShapeConcept {
  style: VoicingStyle;
  quality: Quality;
  alterations: string[];
}

/** `shape:<style>:<quality>[+alt…]`; `+` keeps `m7b5` (a quality) apart from `m7` with a ♭5. */
export const shapeRuleId = (style: VoicingStyle, quality: Quality, alterations: readonly string[] = []) =>
  ["shape:" + style + ":" + quality, ...alterations].join("+");

export function parseShapeRuleId(ruleId: string): ShapeConcept | null {
  const m = /^shape:([^:]+):(.+)$/.exec(ruleId);
  if (!m) return null;
  const [quality, ...alterations] = m[2].split("+");
  const style = VOICING_STYLES.find((s) => s.id === m[1])?.id;
  if (!style || !(QUALITIES as string[]).includes(quality)) return null;
  return { style, quality: quality as Quality, alterations };
}

// ── names ──

const RULE_NAME = new Map(RULES.map((r) => [r.id, r.name]));

/** A concept's passport name: the rule's, the motion's, or "Shells · 7(♭9)". Unknown ids name themselves. */
export function conceptName(ruleId: string): string {
  switch (conceptKind(ruleId)) {
    case "ear": {
      const motion = motionOfRuleId(ruleId);
      return motion ? EAR_MOTION_NAME[motion] : ruleId;
    }
    case "shape": {
      const s = parseShapeRuleId(ruleId);
      if (!s) return ruleId;
      const label = VOICING_STYLES.find((v) => v.id === s.style)!.label;
      const chord = prettySymbol(symbol({ root: "C", quality: s.quality, extensions: [], alterations: s.alterations })).slice(1) || s.quality;
      return `${label} · ${chord}`;
    }
    default:
      return RULE_NAME.get(ruleId) ?? ruleId;
  }
}
