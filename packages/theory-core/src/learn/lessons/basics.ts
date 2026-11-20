import { guideTones, symbol } from "../../chords";
import { simplifyNote, transpose } from "../../pitch";
import { chainMotions } from "../../ruleKit";
import type { Quality } from "../../types";
import type { BasicsId } from "../graph";
import { degreeWord, hl, moves, pn, ps, type Lesson } from "../lesson";

/*
 * The foundation lessons, for any tonic: every note comes from `transpose()`, `guideTones()`
 * and the engine's voice motion, so each one works in all 12 keys. Phase 2 ships the five the
 * first slice of rule lessons leans on; the other basics nodes have no lesson yet.
 */

const chord = (root: string, quality: Quality) => ({ root, quality, extensions: [] as string[], alterations: [] as string[] });
const sym = (c: ReturnType<typeof chord>) => ps(symbol(c));

function tritone(T: string): Lesson {
  // spelled as the tritone sub spells its root: E♭ → A, never B♭♭
  const b5 = simplifyNote(transpose(T, "b5"));
  const V7 = chord(transpose(T, "5"), "7");
  const [g3, g7] = guideTones(V7).map((t) => t.note);
  return {
    conceptId: "basics:tritone",
    headline: "A tritone splits the octave exactly in half: six half steps, the most restless interval.",
    steps: [
      { text: `From ${pn(T)} up to ${pn(b5)} is six half steps: a tritone.`, highlight: [hl(T, pn(T)), hl(b5, "♭5")], play: "interval", term: "tritone" },
      {
        text: `Go up six more from ${pn(b5)} and you're back on ${pn(T)}: it halves the octave.`,
        highlight: [hl(b5, pn(b5)), hl(T, pn(T))],
        play: "interval",
        ask: { kind: "tapNotes", prompt: `Tap the key a tritone above ${pn(b5)}.`, answer: [T] },
      },
      { text: `Every dominant 7th holds one: in ${sym(V7)}, it's ${pn(g3)} and ${pn(g7)}.`, highlight: [hl(g3, "3rd"), hl(g7, "7th")], play: "after" },
    ],
    rule: "A tritone is six half steps: the ♭5 above any note.",
  };
}

function guideTonesLesson(T: string): Lesson {
  const V7 = chord(transpose(T, "5"), "7");
  const [g3, g7] = guideTones(V7).map((t) => t.note);
  return {
    conceptId: "basics:guideTones",
    headline: "A chord's 3rd and 7th tell you what it is. Play only those two and the chord stays.",
    steps: [
      { text: `${sym(V7)}'s 3rd is ${pn(g3)} and its 7th is ${pn(g7)}: its guide tones.`, highlight: [hl(g3, "3rd"), hl(g7, "7th")], play: "after", term: "guide tones" },
      { text: `${pn(g3)} makes ${sym(V7)} major; ${pn(g7)}, a ♭7, makes it a dominant.`, highlight: [hl(g3, "major 3rd"), hl(g7, "♭7")] },
      {
        text: `Over a ${pn(V7.root)} bass, ${pn(g3)} and ${pn(g7)} alone still sound like ${sym(V7)}.`,
        highlight: [hl(V7.root, "bass"), hl(g3, "3rd"), hl(g7, "7th")],
        play: "after",
        ask: { kind: "tapNotes", prompt: `Tap the two keys that make ${sym(V7)} a dominant 7th.`, answer: [g3, g7] },
      },
    ],
    rule: "Find the 3rd and 7th first; the root, 5th and tensions add colour on top.",
  };
}

function dominantResolution(T: string): Lesson {
  const V7 = chord(transpose(T, "5"), "7");
  const I = chord(T, "maj7");
  const [g3, g7] = guideTones(V7).map((t) => t.note);
  const [i3] = guideTones(I).map((t) => t.note);
  return {
    conceptId: "basics:dominantResolution",
    headline: `In ${sym(V7)} → ${sym(I)}, two notes pull by half step: ${pn(g3)} up to ${pn(T)}, ${pn(g7)} down to ${pn(i3)}.`,
    steps: [
      { text: `${sym(V7)}'s root, ${pn(V7.root)}, falls a fifth to ${pn(T)}.`, highlight: [hl(V7.root, "V"), hl(T, "I")], play: "before" },
      {
        text: `Its 3rd, ${pn(g3)}, rises a half step to ${pn(T)}: the leading tone.`,
        highlight: [hl(g3, "3rd"), hl(T, "root")],
        term: "leading tone",
        prereqLink: "basics:guideTones",
      },
      {
        text: `Its 7th, ${pn(g7)}, falls a half step to ${pn(i3)}, the 3rd of ${sym(I)}.`,
        highlight: [hl(g7, "7th"), hl(i3, "3rd")],
        ask: { kind: "tapNotes", prompt: `Where does ${pn(g7)} go in ${sym(I)}? Tap it.`, answer: [i3] },
      },
      { text: `Two half-step pulls at once, ${pn(g3)} and ${pn(g7)}: that's why ${sym(V7)} → ${sym(I)} sounds like home.`, highlight: [hl(g3, "↑"), hl(T, pn(T)), hl(g7, "↓"), hl(i3, pn(i3))], play: "after" },
    ],
    rule: "The 3rd of V7 rises to the root of I; the 7th falls to the 3rd of I.",
  };
}

function twoFiveOne(T: string): Lesson {
  const ii = chord(transpose(T, "2"), "m7");
  const V7 = chord(transpose(T, "5"), "7");
  const I = chord(T, "maj7");
  const [ii3, ii7] = guideTones(ii).map((t) => t.note);
  // land on I's triad: B rises to C instead of holding as Cmaj7's 7th
  const [third, seventh] = chainMotions([ii3, ii7], [V7, chord(T, "maj")]);
  return {
    conceptId: "basics:twoFiveOne",
    headline: "ii–V–I: the roots fall in fifths, and the guide tones move by half step or hold.",
    steps: [
      { text: `The roots fall in fifths: ${pn(ii.root)} to ${pn(V7.root)} to ${pn(T)}.`, highlight: [hl(ii.root, "ii"), hl(V7.root, "V"), hl(T, "I")], play: "before" },
      {
        text: `${sym(ii)}'s 7th: ${moves(seventh[0])}, ${sym(V7)}'s ${degreeWord(seventh[0].toDegree)}.`,
        highlight: [hl(ii7, "7th"), hl(seventh[0].to, degreeWord(seventh[0].toDegree))],
        prereqLink: "basics:guideTones",
      },
      {
        text: `${sym(ii)}'s 3rd: ${moves(third[0])}, now ${sym(V7)}'s ${degreeWord(third[0].toDegree)}.`,
        highlight: [hl(ii3, "3rd")],
        ask: { kind: "tapNotes", prompt: `Which key of ${sym(ii)} stays for ${sym(V7)}? Tap it.`, answer: [third[0].to] },
      },
      {
        text: `Into ${sym(I)}, ${moves(seventh[1])} and ${moves(third[1])}: home.`,
        highlight: [hl(seventh[1].from, "↑"), hl(seventh[1].to, pn(seventh[1].to)), hl(third[1].from, "↓"), hl(third[1].to, pn(third[1].to))],
        play: "after",
        prereqLink: "basics:dominantResolution",
      },
    ],
    rule: "From the target, go up a fifth for the V and another fifth for the ii.",
  };
}

function parallelMinor(T: string): Lesson {
  const [M3, M6, M7] = ["3", "6", "7"].map((d) => transpose(T, d));
  const [m3, m6, m7] = ["b3", "b6", "b7"].map((d) => transpose(T, d));
  const iv = chord(transpose(T, "4"), "m6");
  const bVII = chord(m7, "7");
  const I = chord(T, "maj7");
  return {
    conceptId: "basics:parallelMinor",
    headline: `${pn(T)} minor is ${pn(T)} major with the 3rd, 6th and 7th lowered: a source of darker chords.`,
    steps: [
      {
        text: `${pn(T)} minor, the parallel minor, lowers ${pn(M3)}, ${pn(M6)} and ${pn(M7)} to ${pn(m3)}, ${pn(m6)} and ${pn(m7)}.`,
        highlight: [hl(T, pn(T)), hl(m3, "♭3"), hl(m6, "♭6"), hl(m7, "♭7")],
        term: "parallel minor",
      },
      {
        text: `${sym(iv)} borrows ${pn(m6)} from ${pn(T)} minor; ${sym(bVII)} borrows ${pn(m7)} and ${pn(m6)}.`,
        highlight: [hl(m6, "♭6"), hl(m7, "♭7")],
        term: "borrowed",
        ask: { kind: "tapNotes", prompt: `Tap the key ${sym(iv)} takes from ${pn(T)} minor.`, answer: [m6] },
      },
      { text: `Both still land on ${pn(T)}: ${sym(iv)} → ${sym(I)} and ${sym(bVII)} → ${sym(I)}, a darker way home.`, highlight: [hl(T, "home")], play: "after" },
    ],
    rule: "Lower the major scale's 3rd, 6th and 7th to find the chords you can borrow.",
  };
}

export const BASICS_LESSONS: Partial<Record<BasicsId, (tonic: string) => Lesson>> = {
  "basics:tritone": tritone,
  "basics:guideTones": guideTonesLesson,
  "basics:dominantResolution": dominantResolution,
  "basics:twoFiveOne": twoFiveOne,
  "basics:parallelMinor": parallelMinor,
};
