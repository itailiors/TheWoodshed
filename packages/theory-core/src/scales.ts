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
  ionian: { name: "Ionian", degrees: ["1", "2", "3", "4", "5", "6", "7"], why: "Home key, plain and simple. Treat the 4th as a passing note." },
  lydian: {
    name: "Lydian",
    degrees: ["1", "2", "3", "#4", "5", "6", "7"],
    parent: { scale: "major", from: "5" },
    why: "♯11 instead of the avoid-note 4th. It's the diatonic sound of a IV chord.",
  },
  dorian: {
    name: "Dorian",
    degrees: ["1", "2", "b3", "4", "5", "6", "b7"],
    parent: { scale: "major", from: "b7" },
    why: "The ii chord's own scale. The natural 6th gives it the jazz-minor colour.",
  },
  aeolian: {
    name: "Aeolian",
    degrees: ["1", "2", "b3", "4", "5", "b6", "b7"],
    parent: { scale: "major", from: "b3" },
    why: "Darker minor (♭6). Fits vi chords and minor tonics.",
  },
  "locrian-nat2": {
    name: "Locrian ♮2",
    degrees: ["1", "2", "b3", "4", "b5", "b6", "b7"],
    parent: { scale: "melodic minor", from: "b3" },
    why: "Half-diminished with a usable natural 9.",
  },
  locrian: {
    name: "Locrian",
    degrees: ["1", "b2", "b3", "4", "b5", "b6", "b7"],
    parent: { scale: "major", from: "b2" },
    why: "Half-diminished, diatonic version (♭9 is rub-heavy).",
  },
  "melodic-minor": { name: "melodic minor", degrees: ["1", "2", "b3", "4", "5", "6", "7"], why: "Minor-major colour with no avoid notes." },
  "lydian-augmented": {
    name: "Lydian augmented",
    degrees: ["1", "2", "3", "#4", "#5", "6", "7"],
    parent: { scale: "melodic minor", from: "6" },
    why: "maj7♯5 colour: Lydian with a raised 5th.",
  },
  mixolydian: {
    name: "Mixolydian",
    degrees: ["1", "2", "3", "4", "5", "6", "b7"],
    parent: { scale: "major", from: "4" },
    why: "The inside dominant sound. Lean on 3 and ♭7, pass through the 4th.",
  },
  "lydian-dominant": {
    name: "Lydian dominant",
    degrees: ["1", "2", "3", "#4", "5", "6", "b7"],
    parent: { scale: "melodic minor", from: "5" },
    why: "For dominants that don't resolve down a 5th (tritone subs, ♭VII7, IV7). The ♯11 replaces the avoid-note 4th.",
  },
  altered: {
    name: "altered",
    degrees: ["1", "b2", "#2", "3", "#4", "b6", "b7"],
    parent: { scale: "melodic minor", from: "b2" },
    why: "Every tension altered (♭9 ♯9 ♯11 ♭13). Maximum pull into the next chord, especially a minor one.",
  },
  "phrygian-dominant": {
    name: "Phrygian dominant",
    degrees: ["1", "b2", "3", "4", "5", "b6", "b7"],
    parent: { scale: "harmonic minor", from: "4" },
    why: "V of a minor key: ♭9 and ♭13 point straight at the minor target.",
  },
  "hw-diminished": {
    name: "half-whole diminished",
    degrees: ["1", "b2", "#2", "3", "#4", "5", "6", "b7"],
    why: "♭9 with a natural 13. Symmetric, so it repeats every minor 3rd.",
  },
  "wh-diminished": { name: "whole-half diminished", degrees: ["1", "2", "b3", "4", "b5", "#5", "6", "7"], why: "The dim7 chord's own scale." },
  "whole-tone": {
    name: "whole tone",
    degrees: ["1", "2", "3", "#4", "#5", "b7"],
    why: "The augmented (♯5) dominant sound: dreamy and symmetric.",
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
    case "maj7":
    case "6":
      return chord.analysis?.roman.startsWith("IV") || alts.includes("#11") ? ["lydian", "ionian"] : ["ionian", "lydian"];
    case "maj7#5":
      return ["lydian-augmented"];
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
