import { buildPathway, overlaps } from "./pathway";
import type { ReharmMove } from "./types";

/*
 * The pathway editor: everything you've changed about the reharm on the stand. Pure, so the
 * rules about what a dial click, a pedal, a pick or a kept chord does live in one place:
 *   - a click on the dial starts over (picks, kept chords and the open move go);
 *   - a linked pedal or mod wheel only moves the dial, so rocking it through a chorus keeps
 *     your choices;
 *   - a pick evicts the picks it collides with and un-keeps the chords it replaces;
 *   - keeping a chord as written drops the picks over it.
 * Ids are positional (`ruleId@bar.beat`), so the state carries across keys. A pick id that names
 * no candidate (a stale link, another tune) is carried but never forced and never collides.
 */

export interface PathwayEditor {
  level: number;
  /** Move ids you picked, in the order you picked them (later picks win). */
  picks: string[];
  /** Chord ids you asked to keep as written. Chord ids belong to a chart. */
  kept: string[];
  /** The open move; null means "the first in the pathway". */
  selectedId: string | null;
}

export type PathwayEdit =
  | { type: "dial"; level: number }
  | { type: "pedal"; level: number }
  | { type: "pick"; id: string }
  | { type: "keep"; chordId: string }
  /** Hand a kept chord back to the dial. */
  | { type: "release"; chordId: string }
  | { type: "select"; id: string | null }
  | { type: "newTune" }
  | { type: "link"; level?: number; picks: string[]; keep: string[]; move?: string };

export const PATHWAY_EDITOR_START: PathwayEditor = { level: 2, picks: [], kept: [], selectedId: null };

const find = (candidates: readonly ReharmMove[], id: string) => candidates.find((m) => m.id === id);

/** The picks minus any that replace this chord. */
const dropPicksOn = (picks: string[], chordId: string, candidates: readonly ReharmMove[]) =>
  picks.filter((id) => !find(candidates, id)?.replaces.includes(chordId));

export function editPathway(s: PathwayEditor, e: PathwayEdit, candidates: readonly ReharmMove[]): PathwayEditor {
  switch (e.type) {
    case "dial":
      return { level: e.level, picks: [], kept: [], selectedId: null };
    case "pedal":
      return e.level === s.level ? s : { ...s, level: e.level };
    case "pick": {
      const move = find(candidates, e.id);
      if (!move) return s;
      return {
        ...s,
        picks: [
          ...s.picks.filter((id) => {
            const other = find(candidates, id);
            return id !== move.id && !(other && overlaps(other, move));
          }),
          move.id,
        ],
        kept: s.kept.filter((id) => !move.replaces.includes(id)),
        selectedId: move.id,
      };
    }
    case "keep":
      return {
        ...s,
        picks: dropPicksOn(s.picks, e.chordId, candidates),
        kept: s.kept.includes(e.chordId) ? s.kept : [...s.kept, e.chordId],
      };
    case "release":
      return { ...s, picks: dropPicksOn(s.picks, e.chordId, candidates), kept: s.kept.filter((id) => id !== e.chordId) };
    case "select":
      return { ...s, selectedId: e.id };
    case "newTune":
      return { ...PATHWAY_EDITOR_START, level: s.level };
    case "link":
      return { level: e.level ?? s.level, picks: [...e.picks], kept: [...e.keep], selectedId: e.move ?? s.selectedId };
  }
}

/** The picks that name a candidate, as moves, in pick order. */
export const editorPicks = (s: PathwayEditor, candidates: readonly ReharmMove[]): ReharmMove[] =>
  s.picks.map((id) => find(candidates, id)).filter((m): m is ReharmMove => !!m);

/** The pathway this edit state asks for. */
export const editorPathway = (s: PathwayEditor, candidates: readonly ReharmMove[]): ReharmMove[] =>
  buildPathway(candidates as ReharmMove[], s.level, editorPicks(s, candidates), s.kept);
