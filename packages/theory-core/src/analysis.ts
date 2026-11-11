import { chroma, mod } from "./pitch";
import type { ChordEvent, HarmonicFunction, Quality, Tune } from "./types";

const DEGREES = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"];
const MINORISH = new Set<Quality>(["m", "m7", "m6", "mMaj7", "m7b5", "dim7"]);
const SUFFIX: Record<Quality, string> = {
  maj: "",
  m: "",
  maj7: "maj7",
  "6": "6",
  "7": "7",
  m7: "7",
  m6: "6",
  mMaj7: "(maj7)",
  m7b5: "ø7",
  dim7: "°7",
  "7sus4": "7sus",
  aug: "+",
  "maj7#5": "maj7♯5",
};

/** Roman numeral of a chord relative to the tune's key (e.g. "IVmaj7", "ii7", "bVII7"). */
export function romanFor(chord: Pick<ChordEvent, "root" | "quality">, keyTonic: string): { roman: string; func: HarmonicFunction } {
  const deg = mod(chroma(chord.root) - chroma(keyTonic), 12);
  let numeral = DEGREES[deg];
  if (MINORISH.has(chord.quality)) numeral = numeral.toLowerCase();
  const func: HarmonicFunction =
    deg === 0 || deg === 9 || deg === 4 ? "T" : deg === 2 || deg === 5 ? "PD" : deg === 7 || deg === 11 ? "D" : "chromatic";
  return { roman: numeral + SUFFIX[chord.quality], func };
}

/** Fill in Roman-numeral analysis for chords that don't have it (imported charts). */
export function analyzeTune(tune: Tune): Tune {
  return {
    ...tune,
    harmony: tune.harmony.map((c) => (c.analysis ? c : { ...c, analysis: romanFor(c, tune.key.tonic) })),
  };
}
