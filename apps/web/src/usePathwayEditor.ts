import { editPathway, PATHWAY_EDITOR_START, type PathwayEdit, type PathwayEditor, type ReharmMove } from "@reharm/theory-core";
import { useCallback, useRef, useState } from "react";

/**
 * The pathway editor's state (theory-core `editPathway`) for the tune on the stand. Edits are
 * resolved against the latest candidates, so `edit` is stable and safe to hand to any child or
 * subscription (the pedal, the Study shortcuts).
 */
export function usePathwayEditor(candidates: readonly ReharmMove[]): [PathwayEditor, (e: PathwayEdit) => void] {
  const [state, setState] = useState<PathwayEditor>(PATHWAY_EDITOR_START);
  const latest = useRef(candidates);
  latest.current = candidates;
  const edit = useCallback((e: PathwayEdit) => setState((s) => editPathway(s, e, latest.current)), []);
  return [state, edit];
}
