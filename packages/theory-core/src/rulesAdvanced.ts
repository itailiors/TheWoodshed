/**
 * Level 2–4 rule pack: chromatic passing chords, borrowed (modal-interchange) cadences,
 * Coltrane substitution and constant-structure planing.
 * Every rule reasons in intervals relative to its local target, so it works in all keys
 * and on tonicized chords, not just the home key.
 */
import { chordTones, guideTones, isMajorQ, resolvesDownFifth } from "./chords";
import { chroma, mod, transpose, type Interval } from "./pitch";
import { chain, distribute, mk, pn, ps, splitBeats, tidy, type NewChord, type Rule } from "./ruleKit";
import type { ChordEvent } from "./types";
import { nearestMotion } from "./voiceLeading";

const UP_SEMITONE: Interval = { steps: 0, semis: 1 };
const DOWN_SEMITONE: Interval = { steps: 0, semis: -1 };

/** Semitones from a up to b (0–11). */
const up = (a: { root: string }, b: { root: string }) => mod(chroma(b.root) - chroma(a.root), 12);

/** A chord event as a NewChord (keeps its spelling and colour), with a new length. */
const keep = (c: ChordEvent, beats: number): NewChord => ({
  root: c.root,
  quality: c.quality,
  extensions: c.extensions,
  alterations: c.alterations,
  beats,
  ...(c.bass ? { bass: c.bass } : {}),
  ...(c.display ? { display: c.display } : {}),
  // keep the analysis: scale choice depends on it (IVmaj7 → Lydian)
  ...(c.analysis ? { analysis: c.analysis } : {}),
});

const isMajorTarget = (c?: ChordEvent): c is ChordEvent => !!c && isMajorQ(c.quality) && !c.display;

// ── Backdoor ii–V: iv m7 → ♭VII7 → I ────────────────────────────────────────
export const backdoorTwoFive: Rule = {
  id: "modal.backdoorTwoFive",
  name: "Backdoor ii–V",
  propose({ chord, next }) {
    if (!isMajorTarget(next) || chord.quality !== "7" || !resolvesDownFifth(chord, next)) return null;
    const T = next.root;
    const ivRoot = tidy(transpose(T, "4"));
    const bVIIRoot = tidy(transpose(T, "b7"));
    const split = splitBeats(chord.beats);
    const bVII = mk(bVIIRoot, "7", split ? split[1] : chord.beats, ["9"]);
    const chords = split ? [mk(ivRoot, "m7", split[0]), bVII] : [bVII];
    const [b7third, b7seventh] = guideTones(bVII).map((g) => g.note);
    return {
      title: "Backdoor ii–V",
      level: 3,
      category: "modal",
      styleTags: ["modal-interchange", "standard"],
      chords,
      facts: { target: ps(next), iv: split ? ps(chords[0]) : null, bVII7: ps(bVII), guideToneChain: chain(guideTones(chords[0]).map((g) => g.note), [...chords.slice(1), next]) },
      text: {
        summary: `Come in through the back door: ${chords.map(ps).join(" → ")} → ${ps(next)}, instead of ${ps(chord)} → ${ps(next)}.`,
        theory:
          `${split ? `${ps(chords[0])} and ` : ""}${ps(bVII)} are borrowed from ${pn(T)} minor (iv and ♭VII7). ` +
          `${ps(bVII)} has no leading tone. Its ♭7 (${pn(b7seventh)}) falls a half step to ${pn(transpose(T, "5"))}, the 5th of ${pn(T)}, ` +
          `its 3rd (${pn(b7third)}) moves a step into the tonic chord, and the root rises a whole step home. ` +
          `It's a darker, bluesier cadence than ${ps(chord)} → ${ps(next)}, with no tritone resolving.`,
        recreateRule: "For a major I, approach from iv m7 → ♭VII7: the minor chord a 4th above the tonic, then the dominant a whole step below it.",
      },
    };
  },
};

// ── ♭VI–♭VII–I (borrowed "Aeolian" cadence) ─────────────────────────────────
export const flatSixFlatSeven: Rule = {
  id: "modal.flatSixFlatSeven",
  name: "♭VI–♭VII–I",
  propose({ chord, next }) {
    if (!isMajorTarget(next) || chord.quality !== "7" || !resolvesDownFifth(chord, next)) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;
    const T = next.root;
    const bVI = mk(tidy(transpose(T, "b6")), "maj7", split[0]);
    const bVII = mk(tidy(transpose(T, "b7")), "6", split[1], ["9"]);
    return {
      title: "♭VI–♭VII–I",
      level: 3,
      category: "modal",
      styleTags: ["modal-interchange", "gospel", "cinematic"],
      chords: [bVI, bVII],
      facts: { target: ps(next), bVI: ps(bVI), bVII: ps(bVII), bassLine: [bVI.root, bVII.root, T] },
      text: {
        summary: `Replace the dominant with two borrowed chords whose roots climb into the tonic: ${ps(bVI)} → ${ps(bVII)} → ${ps(next)}.`,
        theory:
          `${ps(bVI)} and ${ps(bVII)} come from ${pn(T)} Aeolian, the parallel minor. The roots rise by whole steps (${[bVI.root, bVII.root, T].map(pn).join(" → ")}), ` +
          `so the arrival feels inevitable without a dominant chord or a tritone anywhere. ` +
          `It's a bright, open cadence that suits the end of a phrase and tags at the end of a tune.`,
        recreateRule: "Before a major tonic, play the major chords on ♭6 and ♭7 of the key and let the bass climb by whole steps into I.",
      },
    };
  },
};

// ── Borrowed iv (minor plagal): IV → iv → I ─────────────────────────────────
export const borrowedIv: Rule = {
  id: "modal.borrowedIv",
  name: "Borrowed iv",
  propose({ chord, next }) {
    if (!isMajorTarget(next) || !isMajorQ(chord.quality) || chord.display || up(next, chord) !== 5) return null;
    const split = splitBeats(chord.beats);
    const iv = mk(chord.root, "m6", split ? split[1] : chord.beats);
    const chords = split ? [keep(chord, split[0]), iv] : [iv];
    const line = [transpose(chord.root, "3"), transpose(chord.root, "b3"), transpose(next.root, "5")];
    return {
      title: "Borrowed iv (minor plagal)",
      level: 3,
      category: "modal",
      styleTags: ["modal-interchange", "standard", "gospel"],
      chords,
      facts: { target: ps(next), iv: ps(iv), chromaticLine: line },
      text: {
        summary: `Darken the IV on its way home: ${chords.map(ps).join(" → ")} → ${ps(next)}.`,
        theory:
          `${ps(iv)} is the IV chord borrowed from ${pn(next.root)} minor. Its only change is the 3rd: ${pn(line[0])} drops a half step to ${pn(line[1])}, ` +
          `which then falls again to ${pn(line[2])}, the 5th of ${ps(next)}. That inner line (6 → ♭6 → 5 in the home key) is the sound of the minor plagal cadence, ` +
          `bittersweet rather than final.`,
        recreateRule: "When IV goes to I, make it minor (iv6) on the way. The 3rd of IV slides down a half step, then another into the tonic's 5th.",
      },
    };
  },
};

// ── Passing diminished: I → ♯I°7 → ii (or iii → ♭iii°7 → ii) ────────────────
export const passingDiminished: Rule = {
  id: "chromatic.passingDiminished",
  name: "Passing diminished",
  propose({ chord, next }) {
    if (!next || chord.quality === "dim7" || next.quality === "dim7" || chord.display) return null;
    const dist = up(chord, next);
    if (dist !== 2 && dist !== 10) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;
    const ascending = dist === 2;
    const dimRoot = tidy(transpose(chord.root, ascending ? UP_SEMITONE : DOWN_SEMITONE));
    const dim = mk(dimRoot, "dim7", split[1]);
    const V = transpose(next.root, "5");
    const dimNotes = chordTones(dim).map((t) => pn(t.note));
    return {
      title: ascending ? "Passing diminished (up)" : "Passing diminished (down)",
      level: 2,
      category: "chromatic",
      styleTags: ["bebop", "standard"],
      chords: [keep(chord, split[0]), dim],
      facts: { target: ps(next), dim: ps(dim), bassLine: [chord.root, dimRoot, next.root], ascending },
      text: {
        summary: `Fill the gap with a diminished chord so the bass walks by half steps: ${ps(chord)} → ${ps(dim)} → ${ps(next)}.`,
        theory: ascending
          ? `${ps(dim)} sits a half step between ${pn(chord.root)} and ${pn(next.root)}, so the bass climbs chromatically. ` +
            `It's also a disguised dominant: ${dimNotes.join(" ")} are the 3rd, 5th, ♭7 and ♭9 of ${pn(V)}7, the V of ${ps(next)}, played without its root. ` +
            `That's why it pulls so strongly into the next chord.`
          : `${ps(dim)} is a chromatic passing chord: the bass walks down by half steps (${[chord.root, dimRoot, next.root].map(pn).join(" → ")}) ` +
            `while the symmetrical diminished shape lets the upper voices slip into ${ps(next)} by step.`,
        recreateRule: "Between two chords a whole step apart, put a diminished 7th on the half step in between, so the bass walks chromatically.",
      },
    };
  },
};

// ── Common-tone diminished: I°7 → Imaj7 ─────────────────────────────────────
export const commonToneDiminished: Rule = {
  id: "chromatic.commonToneDiminished",
  name: "Common-tone diminished",
  propose({ chord, prev, next }) {
    if (!next || !prev || !isMajorQ(chord.quality) || chord.display || chroma(prev.root) === chroma(chord.root)) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;
    const dim = mk(chord.root, "dim7", split[1]);
    const lean = [transpose(chord.root, "b3"), transpose(chord.root, "b5")];
    const resolve = [transpose(chord.root, "3"), transpose(chord.root, "5")];
    return {
      title: "Common-tone diminished",
      level: 3,
      category: "chromatic",
      styleTags: ["standard", "stride", "gospel"],
      chords: [dim, keep(chord, split[0])],
      voiceLeading: lean.map((n) => nearestMotion(n, chordTones(chord))),
      facts: { chord: ps(chord), dim: ps(dim), leaningTones: lean, resolvesTo: resolve },
      text: {
        summary: `Lean into ${ps(chord)} from the diminished chord on the same root: ${ps(dim)} → ${ps(chord)}.`,
        theory:
          `${ps(dim)} shares only its root with ${ps(chord)}. Its ${pn(lean[0])} and ${pn(lean[1])} (heard as ♯2 and ♯4) each rise a half step, ` +
          `into ${pn(resolve[0])} and ${pn(resolve[1])}, the 3rd and 5th. It's an appoggiatura chord: tension that dissolves into the chord you were already on, ` +
          `so it adds motion without changing the harmony.`,
        recreateRule: "On a major chord that lasts a while, start with the diminished 7th on the same root and let it resolve up by half steps.",
      },
    };
  },
};

// ── Coltrane substitution over ii–V–I ───────────────────────────────────────
export const coltraneSubstitution: Rule = {
  id: "symmetric.coltraneSubstitution",
  name: "Coltrane substitution",
  propose({ chord, next, afterNext }) {
    if (!next || !isMajorTarget(afterNext)) return null;
    if (chord.quality !== "m7" || next.quality !== "7" || up(next, chord) !== 7 || !resolvesDownFifth(next, afterNext)) return null;
    const beats = distribute(chord.beats + next.beats, 6);
    if (!beats) return null;
    const T = afterNext.root;
    const roots = [chord.root, tidy(transpose(T, "b3")), tidy(transpose(T, "b6")), tidy(transpose(T, "7")), tidy(transpose(T, "3")), next.root];
    const qualities = ["m7", "7", "maj7", "7", "maj7", "7"] as const;
    const chords = roots.map((r, i) => mk(r, qualities[i], beats[i]));
    const centres = [roots[2], roots[4], T];
    return {
      replaceCount: 2,
      title: "Coltrane substitution",
      level: 4,
      category: "symmetric",
      styleTags: ["coltrane", "modern"],
      chords,
      facts: { target: ps(afterNext), keyCentres: centres, dominants: [roots[1], roots[3], roots[5]] },
      text: {
        summary: `Turn ${ps(chord)} → ${ps(next)} → ${ps(afterNext)} into a tour of three keys a major 3rd apart: ${chords.map(ps).join(" → ")} → ${ps(afterNext)}.`,
        theory:
          `Coltrane's substitution divides the octave into three equal parts. ${centres.map(pn).join(", ")} are a major 3rd apart (an augmented triad), ` +
          `and each is reached from its own dominant (${pn(roots[1])}7, ${pn(roots[3])}7, ${pn(roots[5])}7). ` +
          `You pass through three key centres in the time of one ii–V and still land on ${ps(afterNext)}. Practise the guide tones first: ` +
          `${chain(guideTones(chords[0]).map((g) => g.note), [...chords.slice(1), afterNext])}.`,
        recreateRule: "Over ii–V–I, tonicize the keys a major 3rd apart: V7–I into ♭VI, V7–I into III, then the real V7–I.",
      },
    };
  },
};

// ── Constant structure: plane the target's shape down by half steps ─────────
export const constantStructure: Rule = {
  id: "chromatic.constantStructure",
  name: "Constant structure",
  propose({ chord, next }) {
    if (!next || next.display || next.bass) return null;
    // already planing into the target (same shape a half step above): nothing to add
    if (chord.quality === next.quality && up(next, chord) === 1) return null;
    // Planing is an approach: the original chord keeps the downbeat, the parallel shapes take the last beats.
    if (chord.beats < 2) return null;
    const shape = { quality: next.quality, extensions: next.extensions, alterations: next.alterations };
    const twoStep = chord.beats >= 3;
    const a: NewChord = { root: tidy(transpose(next.root, "2")), beats: 1, ...shape };
    const b: NewChord = { root: tidy(transpose(next.root, "b2")), beats: 1, ...shape };
    const planed = twoStep ? [a, b] : [b];
    const chords = [keep(chord, chord.beats - planed.length), ...planed];
    const path = [...planed.map((c) => c.root), next.root];
    return {
      title: "Constant structure",
      level: 4,
      category: "chromatic",
      styleTags: ["modern", "planing"],
      chords,
      voiceLeading: chordTones(b).map((t) => nearestMotion(t.note, chordTones(next))),
      facts: { target: ps(next), shape, planedRoots: path },
      text: {
        summary: `Plane into ${ps(next)} with its own shape from above: ${chords.map(ps).join(" → ")} → ${ps(next)}.`,
        theory:
          `Constant structure keeps one chord shape and moves it in parallel, so the ear follows the shape rather than a key. ` +
          `${ps(chord)} keeps the downbeat, then ${ps(next)}'s exact shape slides down by half steps (${path.map(pn).join(" → ")}). ` +
          `Every voice moves a semitone at a time, the smoothest voice leading there is, while the passing chords come from outside the key.`,
        recreateRule: "Near the end of a chord, play the next chord's exact shape a half step (or a whole step) above it and slide the whole hand down into it.",
      },
    };
  },
};

export const ADVANCED_RULES: Rule[] = [
  passingDiminished,
  backdoorTwoFive,
  flatSixFlatSeven,
  borrowedIv,
  commonToneDiminished,
  coltraneSubstitution,
  constantStructure,
];
