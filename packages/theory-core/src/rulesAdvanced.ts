/**
 * Level 2–4 rule pack: chromatic passing chords, borrowed (modal-interchange) cadences,
 * Coltrane substitution and constant-structure planing.
 * Every rule reasons in intervals relative to its local target, so it works in all keys
 * and on tonicized chords, not just the home key.
 */
import { chordTones, guideTones, isMajorQ, isMinorQ, resolvesDownFifth, symbol } from "./chords";
import { chroma, fewestAccidentals, mod, playableKey, transpose, type Interval } from "./pitch";
import type {
  BackdoorLearn,
  BorrowedIvLearn,
  ColtraneLearn,
  CommonToneDiminishedLearn,
  ConstantStructureLearn,
  FlatSixFlatSevenLearn,
  MediantDominantLearn,
  MinorLineClicheLearn,
  PassingDiminishedLearn,
} from "./learn/facts";
import { readable } from "./learn/lesson";
import { chain, chainMotions, dimTones, distribute, mk, planeMotion, ps, risingTone, splitBeats, tidy, type NewChord, type Rule } from "./ruleKit";
import type { ChordEvent } from "./types";
import { collapseHolds, nearestMotion } from "./voiceLeading";

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
  pedagogy: {
    formula: "iv7 → ♭VII9 → Imaj7",
    whenToUse: "Replacing a V7 resolving to a major tonic.",
    whyItWorks: "Borrowed from the parallel minor, ♭VII7 rises a whole step to I with no leading tone pulling up.",
    bandstandCue: "Play the minor 7th on the 4th degree of the target key, then drop the 7th to make the dominant a whole step below I.",
  },
  propose({ chord, next }) {
    if (!isMajorTarget(next) || chord.quality !== "7" || !resolvesDownFifth(chord, next)) return null;
    const T = next.root;
    const ivRoot = tidy(transpose(T, "4"));
    const bVIIRoot = tidy(transpose(T, "b7"));
    const split = splitBeats(chord.beats);
    const bVII = mk(bVIIRoot, "7", split ? split[1] : chord.beats, ["9"]);
    const chords = split ? [mk(ivRoot, "m7", split[0]), bVII] : [bVII];
    const b7seventh = guideTones(bVII)[1].note;
    // the original dominant's 3rd, spelled as the chart spells it (D♭7 → F♯ gives F, not E♯)
    const leadingTone = guideTones(chord)[0].note;
    const learn: BackdoorLearn = {
      original: symbol(chord),
      target: symbol(next),
      iv: split ? symbol(chords[0]) : null,
      bVII: symbol(bVII),
      targetRoot: T,
      bVIIRoot,
      bVIIDegree: readable(transpose(T, "b7")),
      minorKey: playableKey(T, "minor"),
      leadingTone,
      bVIISeventh: b7seventh,
      targetFifth: transpose(T, "5"),
      bVIINinth: chordTones(bVII).find((t) => t.degree === "9")!.note,
    };
    return {
      title: "Backdoor ii–V",
      level: 3,
      category: "modal",
      styleTags: ["modal-interchange", "standard"],
      chords,
      facts: {
        target: ps(next),
        iv: split ? ps(chords[0]) : null,
        bVII7: ps(bVII),
        guideToneChain: chain(guideTones(chords[0]).map((g) => g.note), [...chords.slice(1), next]),
        learn,
      },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── Mediant dominant: III7(♭9) → I, the last member of "the Family" ─────────
export const mediantDominant: Rule = {
  id: "dominant.mediantDominant",
  name: "Mediant dominant (the Family)",
  pedagogy: {
    formula: "V7 → III7(♭9) → I",
    whenToUse: "Replacing a V7 that resolves to a major chord.",
    whyItWorks: "The °7 a half step below I sits inside four dominants, the Family. Put III in the bass: its 3rd falls to I's 5th.",
    bandstandCue: "Keep the right hand on the °7 a half step below I; put the bass a major 3rd above I instead of a 5th.",
  },
  propose({ chord, next }) {
    if (!isMajorTarget(next) || chord.quality !== "7" || chord.display || chord.bass || !resolvesDownFifth(chord, next)) return null;
    const T = next.root;
    const sub = mk(tidy(transpose(T, "3")), "7", chord.beats, [], ["b9"]);
    const dim = (["7", "2", "4", "b6"] as const).map((d) => tidy(transpose(T, d)));
    const familyChords = (["5", "b7", "b2", "3"] as const).map((d) => mk(tidy(transpose(T, d)), "7", 1, [], ["b9"]));
    const [third, seventh] = guideTones(sub).map((g) => g.note);
    // III7(♭9)'s upper four, double accidentals respelled (D♯7's F𝄪 reads G), each paired with the °7 key it shares
    const four = (xs: string[]) => [xs[0], xs[1], xs[2], xs[3]] as [string, string, string, string];
    const subTones = four(chordTones(sub).filter((t) => t.degree !== "1").map((t) => readable(t.note)));
    const viRoot = transpose(T, "6");
    const learn: MediantDominantLearn = {
      original: symbol(chord),
      sub: symbol(sub),
      subPlain: symbol(mk(sub.root, "7", 1)),
      target: symbol(next),
      originalRoot: chord.root,
      subRoot: sub.root,
      targetRoot: T,
      dim: four(dim),
      subTones,
      dimTwins: four(subTones.map((n) => dim.find((d) => chroma(d) === chroma(n))!)),
      // the 3rd to the target's 5th, the ♭7 to its root (nearest motion over a 6 chord could send G♯ up to A)
      resolution: [
        nearestMotion(readable(third), chordTones(next).filter((t) => t.degree === "5" || t.degree === "#5")),
        nearestMotion(seventh, chordTones(next).filter((t) => t.degree === "1")),
      ],
      family: four(familyChords.map((c) => symbol({ ...c, alterations: [] }))),
      familyRoots: four(familyChords.map((c) => c.root)),
      relativeMinor: viRoot,
      relativeMinorChord: symbol(mk(viRoot, "m", 1)),
    };
    return {
      title: "Mediant dominant (III7)",
      level: 3,
      category: "dominant-sub",
      styleTags: ["gospel", "modern", "standard"],
      chords: [sub],
      facts: {
        original: symbol(chord),
        sub: symbol(sub),
        target: symbol(next),
        sharedDiminished: dim,
        family: familyChords.map(symbol),
        guideToneChain: chain([third, seventh], [next]),
        learn,
      },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── ♭VI–♭VII–I (borrowed "Aeolian" cadence) ─────────────────────────────────
export const flatSixFlatSeven: Rule = {
  id: "modal.flatSixFlatSeven",
  name: "♭VI–♭VII–I",
  pedagogy: {
    formula: "♭VImaj7 → ♭VII6/9 → Imaj7",
    whenToUse: "Replacing V7 before a major tonic (especially phrase endings).",
    whyItWorks: "Both chords come from the parallel minor. Major chords on ♭VI and ♭VII climb by whole steps into I, with no tritone pulling.",
    bandstandCue: "Build major chords on ♭6 and ♭7 of the target key and walk them up by whole steps into I.",
  },
  propose({ chord, next }) {
    if (!isMajorTarget(next) || chord.quality !== "7" || !resolvesDownFifth(chord, next)) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;
    const T = next.root;
    const bVI = mk(tidy(transpose(T, "b6")), "maj7", split[0]);
    const bVII = mk(tidy(transpose(T, "b7")), "6", split[1], ["9"]);
    const tone = (c: NewChord, d: string) => chordTones(c).find((t) => t.degree === d)!.note;
    const learn: FlatSixFlatSevenLearn = {
      original: symbol(chord),
      target: symbol(next),
      targetRoot: T,
      bVI: symbol(bVI),
      bVII: symbol(bVII),
      bVIRoot: bVI.root,
      bVIIRoot: bVII.root,
      bVIDegree: readable(transpose(T, "b6")),
      bVIIDegree: readable(transpose(T, "b7")),
      minorKey: playableKey(T, "minor"),
      leadingTone: guideTones(chord)[0].note,
      bVIINinth: tone(bVII, "9"),
      bVIISixth: tone(bVII, "6"),
      // the backdoor's ♭VII7 on the same root has a ♭7 where this chord has its 6th
      backdoorSeventh: tone(mk(bVII.root, "7", 1), "b7"),
    };
    return {
      title: "♭VI–♭VII–I",
      level: 3,
      category: "modal",
      styleTags: ["modal-interchange", "gospel", "cinematic"],
      chords: [bVI, bVII],
      facts: { target: ps(next), bVI: ps(bVI), bVII: ps(bVII), bassLine: [bVI.root, bVII.root, T], learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── Borrowed iv (minor plagal): IV → iv → I ─────────────────────────────────
export const borrowedIv: Rule = {
  id: "modal.borrowedIv",
  name: "Borrowed iv",
  pedagogy: {
    formula: "IVmaj7 → iv6 → Imaj7",
    whenToUse: "When a major IV chord resolves directly to a major I.",
    whyItWorks: "IV turns minor: its 3rd falls a half step, then another into I's 5th, the minor plagal line 6, ♭6, 5.",
    bandstandCue: "Keep your IV chord voicing and drop its 3rd down a half step to ♭3 (adding the 6th) before landing on I.",
  },
  propose({ chord, next }) {
    if (!isMajorTarget(next) || !isMajorQ(chord.quality) || chord.display || up(next, chord) !== 5) return null;
    const split = splitBeats(chord.beats);
    const iv = mk(chord.root, "m6", split ? split[1] : chord.beats);
    const chords = split ? [keep(chord, split[0]), iv] : [iv];
    const line = [transpose(chord.root, "3"), transpose(chord.root, "b3"), transpose(next.root, "5")];
    const learn: BorrowedIvLearn = {
      IV: symbol(chord),
      iv: symbol(iv),
      target: symbol(next),
      root: chord.root,
      targetRoot: next.root,
      kept: !!split,
      minorKey: playableKey(next.root, "minor"),
      line: [line[0], line[1], line[2]],
    };
    return {
      title: "Borrowed iv (minor plagal)",
      level: 3,
      category: "modal",
      styleTags: ["modal-interchange", "standard", "gospel"],
      chords,
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
      facts: { target: ps(next), iv: ps(iv), chromaticLine: line, learn },
    };
  },
};

// ── Passing diminished: I → ♯I°7 → ii (or iii → ♭iii°7 → ii) ────────────────
export const passingDiminished: Rule = {
  id: "chromatic.passingDiminished",
  name: "Passing diminished",
  pedagogy: {
    formula: "X → ♯X°7 → Y (or ♭X°7)",
    whenToUse: "Between any two chords whose roots lie a whole step apart.",
    whyItWorks: "Going up, the °7 is the next chord's V7(♭9) without its root. Going down, it bridges the whole step, sharing keys with the target.",
    bandstandCue: "Fill the whole-step bass gap with a diminished 7th chord on the chromatic note in between.",
  },
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
    const tones = dimTones(dim).map((t) => t.note);
    const V7 = mk(V, "7", 1, [], ["b9"]);
    const vTones = chordTones(V7);
    // going up, the °7's keys spelled as the V7(♭9) they are (B♯ D♯ F♯ A over G♯, not C E♭ G♭ A): 3rd, 5th, ♭7, ♭9
    const upper = vTones.filter((t) => t.degree !== "1").map((t) => readable(t.note));
    const targetTones = chordTones(next);
    const motions = tones.map((n) => nearestMotion(n, targetTones));
    const learn: PassingDiminishedLearn = {
      from: symbol(chord),
      dim: symbol(dim),
      target: symbol(next),
      fromRoot: chord.root,
      dimRoot,
      targetRoot: next.root,
      ascending,
      dimTones: tones,
      impliedV: V,
      impliedV7: symbol(V7),
      impliedVPlain: symbol(mk(V, "7", 1)),
      // going up the °7 is V7(♭9) without its root: its tones are that chord's 3rd, 5th, ♭7 and ♭9
      roles: ascending ? tones.map((n) => vTones.find((t) => chroma(t.note) === chroma(n))!.degree) : [],
      vTones: ascending ? [upper[0], upper[1], upper[2], upper[3]] : null,
      motions,
      pull: ascending
        ? [
            nearestMotion(upper[0], targetTones.filter((t) => t.degree === "1")),
            // to the target's 5th (the V's root); a target with an altered 5th takes the nearest tone
            nearestMotion(upper[3], targetTones.some((t) => chroma(t.note) === chroma(V)) ? targetTones.filter((t) => chroma(t.note) === chroma(V)) : targetTones),
          ]
        : null,
      shared: targetTones.filter((t) => tones.some((n) => chroma(n) === chroma(t.note))).map((t) => ({ note: t.note, degree: t.degree })),
      moving: motions.filter((m) => !targetTones.some((t) => chroma(t.note) === chroma(m.from))),
    };
    return {
      title: ascending ? "Passing diminished (up)" : "Passing diminished (down)",
      level: 2,
      category: "chromatic",
      styleTags: ["bebop", "standard"],
      chords: [keep(chord, split[0]), dim],
      facts: { target: ps(next), dim: ps(dim), bassLine: [chord.root, dimRoot, next.root], ascending, learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── Common-tone diminished: I°7 → Imaj7 ─────────────────────────────────────
export const commonToneDiminished: Rule = {
  id: "chromatic.commonToneDiminished",
  name: "Common-tone diminished",
  pedagogy: {
    formula: "I°7 → Imaj7",
    whenToUse: "Extending or leaning into a sustained major chord.",
    whyItWorks: "The °7 keeps the root. Its ♯2 and ♯4 lean up a half step into the major chord's 3rd and 5th.",
    bandstandCue: "Strike a diminished 7th on the major chord's own root, then slide the middle voices up a half step into the major chord.",
  },
  propose({ chord, prev, next }) {
    if (!next || !prev || !isMajorQ(chord.quality) || chord.display || chroma(prev.root) === chroma(chord.root)) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;
    const dim = mk(chord.root, "dim7", split[1]);
    // spelled by direction of resolution: they rise, so ♯2 and ♯4 (C: D♯, F♯), not the °7's own E♭ and G♭
    const lean = [risingTone(chord.root, "#2"), risingTone(chord.root, "#4")];
    const resolve = [transpose(chord.root, "3"), transpose(chord.root, "5")];
    // ♯2 into the 3rd, ♯4 into the 5th (over a chord with a 9th, D♯ is as near to D as to E)
    const leans = lean.map((n, k) => nearestMotion(n, chordTones(chord).filter((t) => (k ? t.degree === "5" || t.degree === "#5" : t.degree === "3"))));
    // the °7's 6th (its own ♭♭7), spelled as the 6th it is: A over C, G♯ over B
    const sixth = readable(transpose(chord.root, "6"));
    const all: [string, string, string, string] = [chord.root, lean[0], lean[1], sixth];
    const learn: CommonToneDiminishedLearn = {
      chord: symbol(chord),
      dim: symbol(dim),
      root: chord.root,
      dimTones: all,
      leans: [leans[0], leans[1]],
      shared: all.filter((n) => chordTones(chord).some((t) => chroma(t.note) === chroma(n))),
      bassStays: !chord.bass || chroma(chord.bass) === chroma(chord.root),
    };
    return {
      title: "Common-tone diminished",
      level: 3,
      category: "chromatic",
      styleTags: ["standard", "stride", "gospel"],
      chords: [dim, keep(chord, split[0])],
      voiceLeading: leans,
      facts: { chord: ps(chord), dim: ps(dim), leaningTones: lean, resolvesTo: resolve, learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── Coltrane substitution over ii–V–I ───────────────────────────────────────
export const coltraneSubstitution: Rule = {
  id: "symmetric.coltraneSubstitution",
  name: "Coltrane substitution",
  pedagogy: {
    formula: "ii – V/♭VI – ♭VImaj7 – V/III – IIImaj7 – V – I",
    whenToUse: "Over a 2-bar (or 6+ beat) major ii–V–I progression.",
    whyItWorks: "Three key centres a major 3rd apart split the octave evenly. Each gets its own V7, so the tour lands back on I.",
    bandstandCue: "Cycle tonic centers down by major 3rds (I → ♭VI → III → I), preceding each new tonic with the dominant a 5th above it.",
  },
  propose({ chord, next, afterNext }) {
    if (!next || !isMajorTarget(afterNext)) return null;
    if (chord.quality !== "m7" || next.quality !== "7" || up(next, chord) !== 7 || !resolvesDownFifth(next, afterNext)) return null;
    const beats = distribute(chord.beats + next.beats, 6);
    if (!beats) return null;
    const T = afterNext.root;
    // the two new centres as players chart them, the key signature with fewer accidentals (E♭, not
    // D♯, over B: Giant Steps writes B♭7 → E♭maj7); each one's V7 a fifth above it
    const [flatSix, three] = [fewestAccidentals(tidy(transpose(T, "b6"))), fewestAccidentals(tidy(transpose(T, "3")))];
    const roots = [chord.root, tidy(transpose(flatSix, "5")), flatSix, tidy(transpose(three, "5")), three, next.root];
    const qualities = ["m7", "7", "maj7", "7", "maj7", "7"] as const;
    const chords = roots.map((r, i) => mk(r, qualities[i], beats[i]));
    const centres: [string, string, string] = [roots[2], roots[4], T];
    // one voice, the ii's 3rd, through the tour into the target; its holds folded (F, E♭ held as D♯, D, C)
    const iiThird = guideTones(chord)[0].note;
    const line = collapseHolds({ from: iiThird, motions: chainMotions([iiThird], [...chords.slice(1), afterNext])[0] }).map((s) => {
      const note = readable(s.note);
      const re = s.respelled && readable(s.respelled);
      return re && re !== note ? { note, holds: s.holds, respelled: re } : { note, holds: s.holds };
    });
    const learn: ColtraneLearn = {
      ii: symbol(chord),
      V: symbol(next),
      target: symbol(afterNext),
      targetRoot: T,
      centres,
      // ♭VI and III as the key spells them (D♯ over B), for the twin where a centre is charted otherwise
      centreDegrees: [readable(transpose(T, "b6")), readable(transpose(T, "3")), T],
      centreChords: [symbol(chords[2]), symbol(chords[4]), symbol(afterNext)],
      dominants: [symbol(chords[1]), symbol(chords[3]), symbol(chords[5])],
      dominantRoots: [roots[1], roots[3], roots[5]],
      line,
    };
    return {
      replaceCount: 2,
      title: "Coltrane substitution",
      level: 4,
      category: "symmetric",
      styleTags: ["coltrane", "modern"],
      chords,
      facts: { target: ps(afterNext), keyCentres: centres, dominants: [roots[1], roots[3], roots[5]], learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── Constant structure: plane the target's shape down by half steps ─────────
export const constantStructure: Rule = {
  id: "chromatic.constantStructure",
  name: "Constant structure",
  pedagogy: {
    formula: "[Target]@+2 → [Target]@+1 → Target",
    whenToUse: "Approaching any target chord on the final 1–2 beats of the preceding bar.",
    whyItWorks: "The same chord shape slides down by half steps into the target. Every voice moves the same way, so the ear follows the shape.",
    bandstandCue: "Take the exact voicing of the upcoming target chord, shift your whole hand up 1 (or 2) half steps, and slide chromatically down into it.",
  },
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
    // planing is parallel: each voice slides to its own counterpart (nearest motion would hold D♭maj7's C into Cmaj7)
    const slideGrid = planeMotion(chordTones(b), chordTones(next));
    const shapeTones = chordTones(next).map((t) => readable(t.note));
    const approach = chordTones(b);
    const approachTones = approach.map((t) => readable(t.note));
    const [g3, g7] = guideTones(b).map((t) => readable(t.note));
    // up to 4 keys to light: the guide tones, the root, then the colours; the 5th goes first when there are more
    const byPriority = approach
      .map((t, k) => ({ k, p: readable(t.note) === g3 || readable(t.note) === g7 ? 0 : t.degree === "1" ? 1 : t.degree === "5" ? 3 : 2 }))
      .sort((x, y) => x.p - y.p || x.k - y.k);
    const lit = byPriority
      .slice(0, 4)
      .map((x) => x.k)
      .sort((x, y) => x - y);
    const learn: ConstantStructureLearn = {
      from: symbol(chord),
      target: symbol(next),
      targetRoot: next.root,
      planed: planed.map(symbol),
      planedRoots: path,
      shapeTones,
      approachTones,
      approachGuide: [g3, g7],
      slide: planeMotion(approachTones, chordTones(next).map((t, k) => ({ ...t, note: shapeTones[k] }))),
      lit,
    };
    return {
      title: "Constant structure",
      level: 4,
      category: "chromatic",
      styleTags: ["modern", "planing"],
      chords,
      voiceLeading: slideGrid,
      facts: { target: ps(next), shape, planedRoots: path, learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

// ── Minor line cliché: im → im(maj7) → im7 → im6 (1–7–♭7–6) ─────────────────
export const minorLineCliche: Rule = {
  id: "chromatic.minorLineCliche",
  name: "Minor line cliché",
  pedagogy: {
    formula: "im → im(maj7) → im7 → im6 (1–7–♭7–6)",
    whenToUse: "Over any sustained minor chord (4+ beats) to create inner-voice movement.",
    whyItWorks: "The minor triad holds while one voice walks down from the root: 1, 7, ♭7, 6. A line moves; the chord stays.",
    bandstandCue: "Hold the minor shell and walk one inner voice down by half steps from the root: 1 → ♮7 → ♭7 → 6.",
  },
  propose({ chord, next }) {
    if (!isMinorQ(chord.quality) || chord.display) return null;
    if (chord.beats < 4) return null;
    if (next?.quality === "7" && resolvesDownFifth(chord, next)) return null;
    if (chord.quality === "m7" && !chord.analysis) return null;
    const beats = distribute(chord.beats, 4);
    if (!beats) return null;

    const r = chord.root;
    const chords: NewChord[] = [
      mk(r, "m", beats[0], ["9"]),
      mk(r, "mMaj7", beats[1], ["9"]),
      mk(r, "m7", beats[2], ["9"]),
      mk(r, "m6", beats[3], ["9"]),
    ];
    // spelled as the degrees they are (C♯m: C♯, B♯, B, A♯, as a real book writes it); only a double accidental is respelled
    const line: [string, string, string, string] = [r, readable(transpose(r, "7")), readable(transpose(r, "b7")), readable(transpose(r, "6"))];
    // `stops`: the four chords without their added 9th. symbol() rightly prints m7 + 9 as "Cm9",
    // which would read as a different chord from "Cm" when a lesson names the line's stops.
    const stops = chords.map((c) => symbol({ ...c, extensions: [] }));
    const learn: MinorLineClicheLearn = {
      chord: symbol(chord),
      root: r,
      third: readable(transpose(r, "b3")),
      fifth: readable(transpose(r, "5")),
      line,
      stops: [stops[0], stops[1], stops[2], stops[3]],
    };
    return {
      title: "Minor line cliché",
      level: 2,
      category: "chromatic",
      styleTags: ["bill-evans", "standard", "ballad"],
      chords,
      facts: { root: r, chromaticLine: line, stops, learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};

export const ADVANCED_RULES: Rule[] = [
  passingDiminished,
  backdoorTwoFive,
  mediantDominant,
  flatSixFlatSeven,
  borrowedIv,
  commonToneDiminished,
  coltraneSubstitution,
  constantStructure,
  minorLineCliche,
];
