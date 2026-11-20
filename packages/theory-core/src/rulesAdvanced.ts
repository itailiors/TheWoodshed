/**
 * Level 2–4 rule pack: chromatic passing chords, borrowed (modal-interchange) cadences,
 * Coltrane substitution and constant-structure planing.
 * Every rule reasons in intervals relative to its local target, so it works in all keys
 * and on tonicized chords, not just the home key.
 */
import { chordTones, guideTones, isMajorQ, isMinorQ, resolvesDownFifth, symbol } from "./chords";
import { chroma, mod, transpose, type Interval } from "./pitch";
import type { BackdoorLearn, BorrowedIvLearn } from "./learn/facts";
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
  pedagogy: {
    formula: "iv7 → ♭VII9 → Imaj7",
    whenToUse: "Replacing a V7 resolving to a major tonic.",
    whyItWorks: "Borrowed from the parallel minor, ♭VII7 replaces the leading-tone tritone pull with a darker whole-step bass rise and common-tone warmth.",
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
    whyItWorks:
      "The °7 a half step below the target sits on top of four dominants: V7, ♭VII7, ♭II7 and III7 (all ♭9). Swap the bass and keep the °7: III7's 3rd falls a half step to the tonic's 5th, its ♭7 a whole step to the root, and its root and 5th are already in the tonic chord.",
    bandstandCue: "Keep the right hand on the °7 a half step below I; put the bass a major 3rd above I instead of a 5th.",
  },
  propose({ chord, next }) {
    if (!isMajorTarget(next) || chord.quality !== "7" || chord.display || chord.bass || !resolvesDownFifth(chord, next)) return null;
    const T = next.root;
    const sub = mk(tidy(transpose(T, "3")), "7", chord.beats, [], ["b9"]);
    const dim = (["7", "2", "4", "b6"] as const).map((d) => tidy(transpose(T, d)));
    const familyChords = (["5", "b7", "b2", "3"] as const).map((d) => mk(tidy(transpose(T, d)), "7", 1, [], ["b9"]));
    const [third, seventh] = guideTones(sub).map((g) => g.note);
    const fifthOfT = transpose(T, "5");
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
      },
      text: {
        summary: `Swap ${ps(chord)} for ${ps(sub)}, the dominant a major 3rd above ${ps(next)}.`,
        theory:
          `${ps(familyChords[0])} is ${pn(chord.root)} under ${/^[AEF]/.test(dim[0]) ? "an" : "a"} ${dim.map(pn).join("–")} diminished 7th. ${ps(sub)} is the same four notes over ${pn(sub.root)}, ` +
          `so your right hand doesn't move: only the bass does. ` +
          `Into ${ps(next)}, ${pn(third)} (the 3rd) falls a half step to ${pn(fifthOfT)}, ${pn(seventh)} (the ♭7) falls a whole step to ${pn(T)}, ` +
          `and ${pn(sub.root)} is already the 3rd of ${pn(T)}. ` +
          `III7 normally resolves to vi, so the ear expects ${pn(transpose(T, "6"))} minor and gets the major tonic instead: a bright, gospel-tinged arrival.`,
        recreateRule:
          "Any V7 → I can become III7(♭9) → I: keep the °7 a half step below I in your hands and put the bass a major 3rd above I.",
        insight:
          `The whole Family over the same ${pn(dim[0])}°7: ${familyChords.map(ps).join(", ")}. The tritone sub and the backdoor ♭VII7 are two of its members; this is the fourth.`,
      },
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
    whyItWorks: "Borrowed from parallel Aeolian, parallel major chords climb by whole steps into I, creating cadential lift through bass planing rather than tritone tension.",
    bandstandCue: "Build major chords on ♭6 and ♭7 of the target key and walk them up by whole steps into I.",
  },
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
  pedagogy: {
    formula: "IVmaj7 → iv6 → Imaj7",
    whenToUse: "When a major IV chord resolves directly to a major I.",
    whyItWorks: "Lowering the 3rd of IV creates the classic 6 → ♭6 → 5 inner-voice line into the 5th of I (the minor plagal cadence).",
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
    whyItWorks: "Ascending, ♯I°7 acts as a rootless V7(♭9) of the target chord; descending, the symmetrical °7 bridges the whole step so every voice moves by semitone.",
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
  pedagogy: {
    formula: "I°7 → Imaj7",
    whenToUse: "Extending or leaning into a sustained major chord.",
    whyItWorks: "Sharing the root as a pedal, the °7's ♭3 and ♭5 act as chromatic appoggiaturas (♯2 and ♯4) that resolve upward by half step into the major 3rd and 5th.",
    bandstandCue: "Strike a diminished 7th on the major chord's own root, then slide the middle voices up a half step into the major chord.",
  },
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
  pedagogy: {
    formula: "ii – V/♭VI – ♭VImaj7 – V/III – IIImaj7 – V – I",
    whenToUse: "Over a 2-bar (or 6+ beat) major ii–V–I progression.",
    whyItWorks: "Divides the octave symmetrically into major 3rds (an augmented triad of tonic centers), tonicizing each center with its own V7 before landing on I.",
    bandstandCue: "Cycle tonic centers down by major 3rds (I → ♭VI → III → I), preceding each new tonic with the dominant a 5th above it.",
  },
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
          `and each is reached from its own dominant (${ps(chords[1])}, ${ps(chords[3])}, ${ps(chords[5])}). ` +
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
  pedagogy: {
    formula: "[Target]@+2 → [Target]@+1 → Target",
    whenToUse: "Approaching any target chord on the final 1–2 beats of the preceding bar.",
    whyItWorks: "Keeping an identical chord quality and voicing while planing in parallel half steps creates coherent horizontal ear-leading where every voice moves by 1 semitone.",
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

// ── Minor line cliché: im → im(maj7) → im7 → im6 (1–7–♭7–6) ─────────────────
export const minorLineCliche: Rule = {
  id: "chromatic.minorLineCliche",
  name: "Minor line cliché",
  pedagogy: {
    formula: "im → im(maj7) → im7 → im6 (1–7–♭7–6)",
    whenToUse: "Over any sustained minor chord (4+ beats) to create inner-voice movement.",
    whyItWorks: "Keeping the minor triad (1–♭3–5) anchored while stepping the octave voice down chromatically (1 → 7 → ♭7 → 6) creates a counterline without leaving the harmony.",
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
    const line = [r, tidy(transpose(r, "7")), tidy(transpose(r, "b7")), tidy(transpose(r, "6"))];
    return {
      title: "Minor line cliché",
      level: 2,
      category: "chromatic",
      styleTags: ["bill-evans", "standard", "ballad"],
      chords,
      facts: { root: r, chromaticLine: line },
      text: {
        summary: `Walk an inner voice chromatically down through ${ps(chord)}: ${chords.map(ps).join(" → ")}.`,
        theory:
          `Sitting on ${ps(chord)} for a full bar can feel static. Keeping ${pn(transpose(r, "b3"))} and ${pn(transpose(r, "5"))} anchored while walking the root voice ` +
          `down by half steps (${line.map(pn).join(" → ")}) creates the classic 1–7–♭7–6 minor line cliché.`,
        recreateRule:
          "Over a sustained minor chord, keep the minor triad still and walk the root voice down by half steps: 1 → ♮7 → ♭7 → 6 (m → m(maj7) → m7 → m6).",
      },
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
