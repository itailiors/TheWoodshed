export type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export const LETTERS: readonly Letter[] = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_CHROMA = [0, 2, 4, 5, 7, 9, 11] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export interface Spelled {
  letter: Letter;
  alter: number;
}

/** An interval as letter steps + semitones, so transposition keeps correct spelling. */
export interface Interval {
  steps: number;
  semis: number;
}

const BASE: Record<string, Interval> = {
  "1": { steps: 0, semis: 0 },
  b2: { steps: 1, semis: 1 },
  "2": { steps: 1, semis: 2 },
  "#2": { steps: 1, semis: 3 },
  b3: { steps: 2, semis: 3 },
  "3": { steps: 2, semis: 4 },
  "4": { steps: 3, semis: 5 },
  "#4": { steps: 3, semis: 6 },
  b5: { steps: 4, semis: 6 },
  "5": { steps: 4, semis: 7 },
  "#5": { steps: 4, semis: 8 },
  b6: { steps: 5, semis: 8 },
  "6": { steps: 5, semis: 9 },
  bb7: { steps: 6, semis: 9 },
  b7: { steps: 6, semis: 10 },
  "7": { steps: 6, semis: 11 },
};

export const BASE_INTERVAL_NAMES = Object.keys(BASE);

export const INTERVALS: Record<string, Interval> = {
  ...BASE,
  b9: BASE.b2,
  "9": BASE["2"],
  "#9": BASE["#2"],
  "11": BASE["4"],
  "#11": BASE["#4"],
  b13: BASE.b6,
  "13": BASE["6"],
};

export function parseNote(name: string): Spelled {
  const m = /^([A-Ga-g])(b*|#*|x)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note name: "${name}"`);
  const letter = m[1].toUpperCase() as Letter;
  const acc = m[2];
  const alter = acc === "x" ? 2 : acc.startsWith("#") ? acc.length : -acc.length;
  return { letter, alter };
}

export function noteName(s: Spelled): string {
  return s.letter + (s.alter > 0 ? "#".repeat(s.alter) : "b".repeat(-s.alter));
}

/** Strip the octave: "Bb4" -> "Bb". */
export const pitchClass = (pitch: string) => pitch.replace(/-?\d+$/, "");

export function chroma(name: string): number {
  const s = parseNote(pitchClass(name));
  return mod(NATURAL_CHROMA[LETTERS.indexOf(s.letter)] + s.alter, 12);
}

export function letterIndex(name: string): number {
  return LETTERS.indexOf(parseNote(pitchClass(name)).letter);
}

export function transpose(name: string, iv: Interval | string): string {
  const i = typeof iv === "string" ? INTERVALS[iv] : iv;
  if (!i) throw new Error(`Unknown interval: ${String(iv)}`);
  const s = parseNote(name);
  const li = LETTERS.indexOf(s.letter);
  const newLi = mod(li + i.steps, 7);
  const target = mod(NATURAL_CHROMA[li] + s.alter + i.semis, 12);
  let alter = mod(target - NATURAL_CHROMA[newLi], 12);
  if (alter > 6) alter -= 12;
  return noteName({ letter: LETTERS[newLi], alter });
}

/** Simple interval name ("b2", "5", "#4"…) from root up to note. */
export function intervalName(root: string, note: string): string {
  const steps = mod(letterIndex(note) - letterIndex(root), 7);
  const semis = mod(chroma(note) - chroma(root), 12);
  const hit = Object.entries(BASE).find(([, v]) => v.steps === steps && v.semis === semis);
  return hit ? hit[0] : `?${steps}/${semis}`;
}

const ODD = new Set(["Cb", "Fb", "E#", "B#"]);

/** Respell double accidentals and Cb/Fb/E#/B# as their everyday names. */
export function simplifyNote(name: string): string {
  const s = parseNote(name);
  if (Math.abs(s.alter) >= 2 || ODD.has(name)) return FLAT_NAMES[chroma(name)];
  return name;
}

const FIFTHS: Record<Letter, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/** The key signature of `tonic` major or minor: sharps positive, flats negative (E♭ major −3, D♯ major +9, D♭ minor −8). */
export function keySignature(tonic: string, mode: "major" | "minor" = "major"): number {
  const s = parseNote(tonic);
  return FIFTHS[s.letter] + 7 * s.alter - (mode === "minor" ? 3 : 0);
}

/**
 * The key spelled as players chart it: of the tonic's single-accidental spellings, the one whose
 * signature has the fewest accidentals; a tie keeps `tonic` (F♯ and G♭). D♯ → E♭, G♯ → A♭, C♯ → D♭ (major).
 */
export function fewestAccidentals(tonic: string, mode: "major" | "minor" = "major"): string {
  const c = chroma(tonic);
  let best = tonic;
  let bestCount = Math.abs(keySignature(tonic, mode));
  LETTERS.forEach((letter, i) => {
    let alter = mod(c - NATURAL_CHROMA[i], 12);
    if (alter > 6) alter -= 12;
    if (Math.abs(alter) > 1) return;
    const name = noteName({ letter, alter });
    const count = Math.abs(keySignature(name, mode));
    if (count < bestCount) [best, bestCount] = [name, count];
  });
  return best;
}

/**
 * A key a reader can find on paper: a signature of more than 7 accidentals doesn't exist, so
 * D♭ minor (8 flats) is written C♯ minor and G♭ minor F♯ minor; every real key keeps its name (A♭ minor stays).
 */
export const playableKey = (tonic: string, mode: "major" | "minor" = "major") =>
  Math.abs(keySignature(tonic, mode)) > 7 ? fewestAccidentals(tonic, mode) : tonic;

/** Fallback spelling for a bare pitch class (flats, as on most jazz charts). */
export const spellChroma = (c: number) => FLAT_NAMES[mod(c, 12)];

/** "Bb4" -> 70, respecting spelling (Cb5 = 71, B#4 = 72). */
export function midiOf(pitch: string): number {
  const m = /^([A-G][b#]*)(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`Bad pitch: "${pitch}"`);
  const s = parseNote(m[1]);
  return (Number(m[2]) + 1) * 12 + NATURAL_CHROMA[LETTERS.indexOf(s.letter)] + s.alter;
}

/** Spell a MIDI note with a given pitch-class name: spellMidi("Cb", 71) -> "Cb5". */
export function spellMidi(pc: string, midi: number): string {
  const s = parseNote(pc);
  const octave = (midi - NATURAL_CHROMA[LETTERS.indexOf(s.letter)] - s.alter) / 12 - 1;
  if (!Number.isInteger(octave)) throw new Error(`${pc} cannot spell MIDI ${midi}`);
  return `${pc}${octave}`;
}

export const prettyNote = (n: string) => n.replace(/b/g, "♭").replace(/#/g, "♯");

/** "Bb7(b9)" -> "B♭7(♭9)", "Eb/F" -> "E♭/F", "Dm7b5" -> "Dm7♭5". */
export function prettySymbol(sym: string): string {
  const m = /^([A-G][b#]*)(.*)$/.exec(sym);
  if (!m) return sym;
  const rest = m[2]
    .replace(/\/([A-G])([b#]*)/, (_, l: string, a: string) => "/" + l + prettyNote(a))
    .replace(/b(?=\d)/g, "♭")
    .replace(/#/g, "♯");
  return prettyNote(m[1]) + rest;
}
