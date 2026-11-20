import { chordChromas, chordTones, isMinorQ, resolvesDownFifth } from "./chords";
import { classifyNote } from "./melody";
import { chroma, prettyNote, simplifyNote, transpose } from "./pitch";
import type { ChordEvent } from "./types";

interface ScaleDef {
  name: string;
  degrees: string[];
  parent?: { scale: string; from: string };
  why: string;
}

export const SCALES: Record<string, ScaleDef> = {
  ionian: { name: "Ionian", degrees: ["1", "2", "3", "4", "5", "6", "7"], why: "The major scale on the chord's root. The 4th rubs against the 3rd, so pass through it." },
  lydian: {
    name: "Lydian",
    degrees: ["1", "2", "3", "#4", "5", "6", "7"],
    parent: { scale: "major", from: "5" },
    why: "The ♯11 replaces the 4th, which rubs against the 3rd. In a major key, it's the IV chord's own scale.",
  },
  dorian: {
    name: "Dorian",
    degrees: ["1", "2", "b3", "4", "5", "6", "b7"],
    parent: { scale: "major", from: "b7" },
    why: "The ii chord's own scale. Its natural 6th keeps the minor sound bright.",
  },
  aeolian: {
    name: "Aeolian",
    degrees: ["1", "2", "b3", "4", "5", "b6", "b7"],
    parent: { scale: "major", from: "b3" },
    why: "Minor with a ♭6, darker than Dorian. It fits the vi chord and minor tonics.",
  },
  "locrian-nat2": {
    name: "Locrian ♮2",
    degrees: ["1", "2", "b3", "4", "b5", "b6", "b7"],
    parent: { scale: "melodic minor", from: "b3" },
    why: "Half-diminished with a natural 9 you can hold.",
  },
  locrian: {
    name: "Locrian",
    degrees: ["1", "b2", "b3", "4", "b5", "b6", "b7"],
    parent: { scale: "major", from: "b2" },
    why: "Half-diminished from the key itself. The ♭9 rubs against the root, so pass through it.",
  },
  "melodic-minor": { name: "melodic minor", degrees: ["1", "2", "b3", "4", "5", "6", "7"], why: "Minor with a major 6th and 7th. No avoid notes: every note can land." },
  "lydian-augmented": {
    name: "Lydian augmented",
    degrees: ["1", "2", "3", "#4", "#5", "6", "7"],
    parent: { scale: "melodic minor", from: "6" },
    why: "Lydian with a raised 5th: the maj7♯5 chord's own scale.",
  },
  mixolydian: {
    name: "Mixolydian",
    degrees: ["1", "2", "3", "4", "5", "6", "b7"],
    parent: { scale: "major", from: "4" },
    why: "The plain dominant sound. Lean on the 3rd and ♭7; pass through the 4th.",
  },
  "lydian-dominant": {
    name: "Lydian dominant",
    degrees: ["1", "2", "3", "#4", "5", "6", "b7"],
    parent: { scale: "melodic minor", from: "5" },
    why: "For dominants that don't fall a 5th: tritone subs, ♭VII7, IV7. The ♯11 replaces the 4th, an avoid note.",
  },
  altered: {
    name: "altered",
    degrees: ["1", "b2", "#2", "3", "#4", "b6", "b7"],
    parent: { scale: "melodic minor", from: "b2" },
    why: "Every tension is altered: ♭9, ♯9, ♯11, ♭13. They lean hardest into a minor target.",
  },
  "phrygian-dominant": {
    name: "Phrygian dominant",
    degrees: ["1", "b2", "3", "4", "5", "b6", "b7"],
    parent: { scale: "harmonic minor", from: "4" },
    why: "The V of a minor key: its ♭9 and ♭13 are notes of the minor key it resolves to.",
  },
  "hw-diminished": {
    name: "half-whole diminished",
    degrees: ["1", "b2", "#2", "3", "#4", "5", "6", "b7"],
    why: "A ♭9 with a natural 13. The scale repeats every minor 3rd, so four dominants share it.",
  },
  "wh-diminished": {
    name: "whole-half diminished",
    degrees: ["1", "2", "b3", "4", "b5", "#5", "6", "7"],
    why: "The diminished 7th's own scale: each chord tone, then a note a whole step above it.",
  },
  "whole-tone": {
    name: "whole tone",
    degrees: ["1", "2", "3", "#4", "#5", "b7"],
    why: "The ♯5 dominant's scale: six notes, each a whole step from the next, with ♯11 and ♯5.",
  },
};

export interface ScaleSuggestion {
  id: string;
  root: string;
  name: string;
  notes: string[];
  parent?: string;
  /** Scale notes that are avoid notes over this chord (fine as passing tones). */
  avoid: string[];
  why: string;
}

type ChordLike = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations" | "analysis">;

function candidates(chord: ChordLike, next?: ChordLike): string[] {
  const alts = chord.alterations;
  switch (chord.quality) {
    case "maj":
    case "maj7":
    case "6":
      return chord.analysis?.roman.startsWith("IV") || alts.includes("#11") ? ["lydian", "ionian"] : ["ionian", "lydian"];
    case "maj7#5":
      return ["lydian-augmented"];
    case "m":
    case "m7":
    case "m6":
      return ["dorian", "aeolian"];
    case "mMaj7":
      return ["melodic-minor"];
    case "m7b5":
      return ["locrian-nat2", "locrian"];
    case "dim7":
      return ["wh-diminished"];
    case "aug":
      return ["whole-tone"];
    case "7sus4":
      return ["mixolydian"];
    case "7": {
      const anyAlt = alts.some((a) => ["b9", "#9", "#5", "b13"].includes(a));
      const down5 = !!next && resolvesDownFifth(chord, next);
      const toMinor = !!next && (isMinorQ(next.quality) || next.quality === "m7b5");
      if (alts.includes("#11") || (next && !down5 && !anyAlt)) return ["lydian-dominant", "mixolydian"];
      if (toMinor) return ["altered", "phrygian-dominant", "hw-diminished", "whole-tone"];
      if (anyAlt) {
        return alts.includes("#5") ? ["whole-tone", "altered", "phrygian-dominant"] : ["hw-diminished", "altered", "phrygian-dominant"];
      }
      return ["mixolydian", "hw-diminished", "altered", "lydian-dominant"];
    }
  }
}

export function buildScale(id: string, root: string): ScaleSuggestion {
  const def = SCALES[id];
  const parentRoot = def.parent ? simplifyNote(transpose(root, def.parent.from)) : undefined;
  return {
    id,
    root,
    name: `${prettyNote(root)} ${def.name}`,
    notes: def.degrees.map((d) => transpose(root, d)),
    parent: parentRoot ? `${prettyNote(parentRoot)} ${def.parent!.scale}` : undefined,
    avoid: [],
    why: def.why,
  };
}

/**
 * Ranked right-hand scales for a chord. Hard rule: every suggested scale
 * contains every chord tone (alterations included) and every melody note.
 */
export function suggestScales(chord: ChordLike, next?: ChordLike, melody: string[] = []): ScaleSuggestion[] {
  const required = new Set([...chordChromas(chord), ...melody.map((m) => chroma(m))]);
  return candidates(chord, next)
    .map((id) => buildScale(id, chord.root))
    .filter((s) => {
      const have = new Set(s.notes.map(chroma));
      return [...required].every((c) => have.has(c));
    })
    .map((s) => ({
      ...s,
      avoid: s.notes.filter((n) => classifyNote({ ...chord, display: undefined }, n).verdict === "avoid"),
    }));
}

export const scaleContainsChord = (s: ScaleSuggestion, chord: ChordLike) => {
  const have = new Set(s.notes.map(chroma));
  return chordTones(chord).every((t) => have.has(chroma(t.note)));
};
