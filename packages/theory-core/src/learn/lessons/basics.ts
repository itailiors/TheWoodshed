import { chordTones, guideTones, symbol } from "../../chords";
import { simplifyNote, transpose } from "../../pitch";
import { chainMotions } from "../../ruleKit";
import type { Quality } from "../../types";
import type { BasicsId } from "../graph";
import { degreeWord, hl, moves, pn, ps, readable, twin, type Lesson } from "../lesson";

/*
 * The foundation lessons, for any tonic: every note comes from `transpose()`, `chordTones()`,
 * `guideTones()` and the engine's voice motion, so each one works in all 12 keys. A basic has no
 * "original" to compare with, so its ▶ plays `sound`: chords, in order, built the same way.
 * Double accidentals never reach the reader (`readable`): E♭♭ is shown, lit and played as D.
 */

const chord = (root: string, quality: Quality, extensions: string[] = []) => ({ root, quality, extensions, alterations: [] as string[] });
const sym = (c: ReturnType<typeof chord>) => ps(symbol(c));
const tones = (c: ReturnType<typeof chord>) => chordTones(c).map((t) => readable(t.note));

function sevenths(T: string): Lesson {
  const G = transpose(T, "5");
  const V7 = chord(G, "7");
  const [root, third, fifth, flat7] = tones(V7);
  const maj7 = transpose(G, "7");
  const minor3 = transpose(G, "b3");
  const Vmaj7 = chord(G, "maj7");
  const Vm7 = chord(G, "m7");
  return {
    conceptId: "basics:sevenths",
    headline: "A 7th chord stacks four notes in 3rds; its 3rd and 7th give it its name.",
    steps: [
      {
        text: `Stack 3rds on ${pn(G)}: ${pn(root)}, ${pn(third)}, ${pn(fifth)}, ${pn(flat7)}. That's ${sym(V7)}, a dominant 7th.`,
        highlight: [hl(root, "root"), hl(third, "3rd"), hl(fifth, "5th"), hl(flat7, "♭7")],
        play: "interval",
        sound: [tones(V7)],
        term: "dominant 7th",
      },
      {
        text: `Raise ${pn(flat7)} to ${twin(maj7, simplifyNote(maj7))} and it's ${sym(Vmaj7)}: a major 7th, a half step below the root.`,
        highlight: [hl(root, "root"), hl(third, "3rd"), hl(fifth, "5th"), hl(maj7, "7th")],
        sound: [tones(V7), tones(Vmaj7)],
      },
      {
        text: `Lower the 3rd, ${pn(third)} to ${twin(minor3, simplifyNote(minor3))}, and ${sym(V7)} becomes ${sym(Vm7)}: minor 3rd, ♭7.`,
        highlight: [hl(root, "root"), hl(minor3, "♭3"), hl(fifth, "5th"), hl(flat7, "♭7")],
        sound: [tones(Vm7)],
        ask: { kind: "tapNotes", prompt: `Make it ${sym(Vm7)}: lower one key. Tap the new 3rd.`, answer: [minor3] },
      },
      {
        text: `Built from ${pn(T)} major's notes, the chord on ${pn(G)} gets ${pn(flat7)}, not ${pn(maj7)}: a dominant 7th.`,
        highlight: [hl(flat7, "♭7")],
        sound: [tones(V7), tones(chord(T, "maj"))],
      },
    ],
    rule: "Name a 7th chord by its 3rd and 7th: maj7 has both major, 7 a major 3rd and ♭7, m7 both minor.",
    deeper: "The 5th rarely changes the name; drop it first when your hand is full.",
  };
}

function numerals(T: string): Lesson {
  const [two, five, seven] = ["2", "5", "7"].map((d) => transpose(T, d));
  // ♭II of G♭ is A♭♭ on paper: the reader sees G, as the tritone sub spells it
  const [flatTwo, flatSeven] = ["b2", "b7"].map((d) => readable(transpose(T, d)));
  const [ii, V7, I] = [chord(two, "m7"), chord(five, "7"), chord(T, "maj7")];
  return {
    conceptId: "basics:numerals",
    headline: `Roman numerals name chords by scale step: in ${pn(T)}, V is the chord built on ${pn(five)}, the 5th note.`,
    steps: [
      {
        text: `Number ${pn(T)} major's notes: ${pn(T)} is 1, ${pn(two)} is 2, and so on up to ${pn(seven)}, 7.`,
        highlight: [hl(T, "1"), hl(two, "2"), hl(five, "5"), hl(seven, "7")],
        play: "interval",
      },
      {
        text: `V is the chord on step 5: ${sym(V7)} in ${pn(T)}. In roman numerals, uppercase is major, lowercase minor.`,
        highlight: [hl(five, "root")],
        sound: [tones(V7), tones(chord(T, "maj"))],
        term: "roman numerals",
        ask: { kind: "tapNotes", prompt: "V is the chord on step 5. Tap its root.", answer: [five] },
      },
      {
        text: `ii is ${sym(ii)}, on step 2, so ii–V–I in ${pn(T)} is ${sym(ii)}, ${sym(V7)}, ${sym(I)}.`,
        highlight: [hl(two, "ii"), hl(five, "V"), hl(T, "I")],
        sound: [tones(ii), tones(V7), tones(I)],
      },
      {
        text: `Add ♭ and the root drops a half step: ♭II in ${pn(T)} is ${pn(flatTwo)}, ♭VII is ${pn(flatSeven)}.`,
        highlight: [hl(flatTwo, "♭II"), hl(flatSeven, "♭VII")],
        play: "interval",
      },
    ],
    rule: "Read a numeral as a scale step of the key; the chord's root sits on that step.",
    deeper: "Numerals let one rule work in all 12 keys: V7 to I is the same move anywhere.",
  };
}

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
      { text: `Every dominant 7th holds one: in ${sym(V7)}, it's ${pn(g3)} and ${pn(g7)}.`, highlight: [hl(g3, "3rd"), hl(g7, "7th")], sound: [tones(V7), [g3, g7]] },
    ],
    rule: "A tritone is six half steps: the ♭5 above any note.",
  };
}

function guideTonesLesson(T: string): Lesson {
  const V7 = chord(transpose(T, "5"), "7");
  const [g3, g7] = guideTones(V7).map((t) => t.note);
  const maj7 = transpose(V7.root, "7");
  return {
    conceptId: "basics:guideTones",
    headline: "A chord's 3rd and 7th tell you what it is. Play only those two and the chord stays.",
    steps: [
      {
        text: `${sym(V7)}'s 3rd is ${pn(g3)} and its 7th is ${pn(g7)}: its guide tones.`,
        highlight: [hl(g3, "3rd"), hl(g7, "7th")],
        sound: [tones(V7), [g3, g7]],
        term: "guide tones",
      },
      {
        text: `${pn(g3)}, the 3rd, makes ${sym(V7)} major. ${pn(g7)}, not ${pn(maj7)}, makes it a dominant 7th: ${pn(maj7)} would make ${sym(chord(V7.root, "maj7"))}.`,
        highlight: [hl(g3, "major 3rd"), hl(g7, "♭7")],
      },
      {
        text: `With ${pn(V7.root)} in the bass, ${pn(g3)} and ${pn(g7)} alone still sound like ${sym(V7)}.`,
        highlight: [hl(V7.root, "bass"), hl(g3, "3rd"), hl(g7, "7th")],
        sound: [[V7.root, g3, g7]],
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
      { text: `${sym(V7)}'s root, ${pn(V7.root)}, falls a fifth to ${pn(T)}.`, highlight: [hl(V7.root, "V"), hl(T, "I")], sound: [tones(V7), tones(I)] },
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
      {
        text: `Two half-step pulls at once, ${pn(g3)} and ${pn(g7)}: that's why ${sym(V7)} → ${sym(I)} sounds like home.`,
        highlight: [hl(g3, "↑"), hl(T, pn(T)), hl(g7, "↓"), hl(i3, pn(i3))],
        sound: [tones(V7), tones(I)],
      },
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
  const progression = [tones(ii), tones(V7), tones(I)];
  return {
    conceptId: "basics:twoFiveOne",
    headline: "ii–V–I: the roots fall in fifths, and the guide tones move by half step or hold.",
    steps: [
      { text: `The roots fall in fifths: ${pn(ii.root)} to ${pn(V7.root)} to ${pn(T)}.`, highlight: [hl(ii.root, "ii"), hl(V7.root, "V"), hl(T, "I")], sound: progression },
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
        sound: progression,
        prereqLink: "basics:dominantResolution",
      },
    ],
    rule: "From the target, go up a fifth for the V and another fifth for the ii.",
  };
}

function extensions(T: string): Lesson {
  const G = transpose(T, "5");
  const V7 = chord(G, "7");
  const [g3, g7] = guideTones(V7).map((t) => t.note);
  const [nine, eleven, thirteen, sharp11, flat9, sharp9, flat13] = ["9", "11", "13", "#11", "b9", "#9", "b13"].map((d) => readable(transpose(G, d)));
  const thirteenth = chord(G, "7", ["9", "13"]);
  return {
    conceptId: "basics:extensions",
    headline: "Above the 7th, a chord keeps stacking 3rds: the 9th, 11th and 13th add colour, not function.",
    steps: [
      {
        text: `Stack 3rds past ${sym(V7)}'s ${pn(g7)}: ${pn(nine)} is the 9th, ${pn(eleven)} the 11th, ${pn(thirteen)} the 13th. These are tensions.`,
        highlight: [hl(g7, "♭7"), hl(nine, degreeWord("9")), hl(eleven, degreeWord("11")), hl(thirteen, degreeWord("13"))],
        sound: [tones(V7), tones(thirteenth)],
        term: "tensions",
      },
      {
        text: `On ${sym(V7)}, ${pn(eleven)} is an avoid note: a half step above ${pn(g3)}, the 3rd, it clashes.`,
        highlight: [hl(eleven, "avoid"), hl(g3, "3rd")],
        sound: [[...tones(V7), eleven]],
        term: "avoid note",
        prereqLink: "basics:guideTones",
      },
      {
        text: `Raise it to ${pn(sharp11)}, or drop ${pn(g3)} and make it sus.`,
        highlight: [hl(sharp11, degreeWord("#11")), hl(eleven, degreeWord("4"))],
        sound: [[...tones(V7), sharp11], tones(chord(G, "7sus4"))],
      },
      {
        text: `A dominant may bend the 9th or flatten the 13th: ${pn(flat9)} or ${pn(sharp9)}, and ${pn(flat13)}.`,
        highlight: [hl(flat9, degreeWord("b9")), hl(sharp9, degreeWord("#9")), hl(flat13, degreeWord("b13"))],
        ask: { kind: "tapNotes", prompt: `Tap the ♭9 and the ♭13 of ${sym(V7)}.`, answer: [flat9, flat13] },
      },
      {
        text: `Play ${pn(g3)}, ${pn(g7)}, ${pn(nine)} and ${pn(thirteen)} over ${pn(G)}: the guide tones hold the chord, the tensions colour it.`,
        highlight: [hl(g3, "3rd"), hl(g7, "♭7"), hl(nine, "9th"), hl(thirteen, "13th")],
        sound: [[G, g3, g7, nine, thirteen]],
      },
    ],
    rule: "Stack 9, 11 and 13 above the 7th; a dominant raises the 11th or goes sus, and may bend the 9th or flatten the 13th.",
    deeper: "The target chooses the tensions: a dominant resolving to minor wants the ♭9 and ♭13.",
  };
}

function dim7(T: string): Lesson {
  const G = transpose(T, "5");
  // the leading-tone °7: G7's 3rd, 5th, 7th and ♭9, so the same notes as transpose(T, 7 | 2 | 4 | ♭6)
  const [b, d, f, ab] = ["7", "2", "4", "b6"].map((iv) => readable(transpose(T, iv)));
  // one more minor 3rd comes back to the root's key (C♭ over B); a double flat is shown as the root itself
  const next = readable(transpose(ab, "b3"));
  const dim = chord(transpose(T, "7"), "dim7");
  const V7 = chord(G, "7");
  // the Family: G7, B♭7, D♭7, E7, the dominants a minor 3rd apart, roots spelled for reading
  const family = ["5", "b7", "b2", "3"].map((iv) => sym(chord(simplifyNote(transpose(T, iv)), "7")));
  return {
    conceptId: "basics:dim7",
    headline: "A diminished 7th stacks four minor 3rds and splits the octave into four equal parts.",
    steps: [
      {
        text: `Stack minor 3rds from ${pn(b)}: ${pn(d)}, ${pn(f)}, ${pn(ab)}. That's ${sym(dim)}, a diminished 7th.`,
        highlight: [hl(b, "root"), hl(d, "♭3"), hl(f, "♭5"), hl(ab, "°7")],
        play: "interval",
        sound: [[b, d, f, ab]],
        term: "diminished 7th",
      },
      {
        text: `Past ${pn(ab)}, the next minor 3rd is ${twin(next, b)}, so only three different diminished 7ths exist.`,
        highlight: [hl(ab, "°7"), hl(next, "root")],
        play: "interval",
      },
      {
        text: `Put ${pn(G)} under it: ${pn(b)}, ${pn(d)}, ${pn(f)}, ${pn(ab)} are ${sym(V7)}'s 3rd, 5th, 7th and ♭9.`,
        highlight: [hl(G, "root"), hl(b, "3rd"), hl(f, "7th"), hl(ab, "♭9")],
        ask: { kind: "tapNotes", prompt: `Put ${pn(G)} under ${sym(dim)}. Which key is ${sym(V7)}'s ♭9? Tap it.`, answer: [ab] },
      },
      {
        text: `So ${sym(dim)} pulls into ${pn(T)} like ${sym(V7)} does: ${pn(b)} rises to ${pn(T)}, ${pn(ab)} falls to ${pn(G)}.`,
        highlight: [hl(b, "↑"), hl(T, pn(T)), hl(ab, "↓"), hl(G, pn(G))],
        sound: [[b, d, f, ab], tones(chord(T, "maj"))],
        prereqLink: "basics:dominantResolution",
      },
    ],
    rule: "Treat any diminished 7th as a rootless 7(♭9): each of its notes is the 3rd of a dominant a major 3rd below.",
    deeper: `So four dominants, ${family[0]}, ${family[1]}, ${family[2]} and ${family[3]}, share ${sym(dim)} once they take the ♭9.`,
  };
}

function symmetricOctave(T: string): Lesson {
  const E = transpose(T, "3");
  // the ear hears E up a major 3rd as G♯; the engine (and Coltrane's rule) writes T's ♭6, A♭
  const heard = readable(transpose(E, "3"));
  const Ab = readable(transpose(T, "b6"));
  const second =
    pn(heard) === pn(Ab)
      ? `${pn(E)} up a major 3rd is ${pn(Ab)}.`
      : `${pn(E)} up a major 3rd is ${pn(heard)}; we spell it ${pn(Ab)}, ${pn(T)}'s ♭6.`;
  const keys = [T, E, Ab].map((r) => chord(r, "maj7"));
  return {
    conceptId: "basics:symmetricOctave",
    headline: `Three major 3rds stack to an octave: ${pn(T)}, ${pn(E)}, ${pn(Ab)}, back to ${pn(T)}. Three keys, equally spaced.`,
    steps: [
      { text: `${pn(T)} up a major 3rd is ${pn(E)}. ${second}`, highlight: [hl(T, pn(T)), hl(E, pn(E)), hl(Ab, "♭6")], play: "interval" },
      {
        text: `One more from ${pn(Ab)} lands on ${pn(T)}: three major 3rds fill the octave exactly.`,
        highlight: [hl(Ab, pn(Ab)), hl(T, pn(T))],
        play: "interval",
        ask: { kind: "tapNotes", prompt: `Tap the key a major 3rd above ${pn(Ab)}.`, answer: [T] },
      },
      {
        text: `${pn(T)}, ${pn(E)} and ${pn(Ab)} together make an augmented triad: no note sounds like home.`,
        highlight: [hl(T, pn(T)), hl(E, pn(E)), hl(Ab, pn(Ab))],
        sound: [[T, E, Ab]],
        term: "augmented triad",
      },
      {
        text: `Make each a key: ${keys.map(sym).join(", ")}. Each arrival lands far from the last.`,
        highlight: [hl(T, pn(T)), hl(E, pn(E)), hl(Ab, pn(Ab))],
        sound: keys.map(tones),
      },
    ],
    rule: "Divide the octave into three major 3rds; each note can be a key centre of its own.",
    deeper: "Coltrane changes tour these three keys, each reached from its own dominant.",
  };
}

function parallelMinor(T: string): Lesson {
  const [M3, M6, M7] = ["3", "6", "7"].map((d) => transpose(T, d));
  const [m3, m6, m7] = ["b3", "b6", "b7"].map((d) => readable(transpose(T, d)));
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
        sound: [tones(chord(T, "maj")), tones(chord(T, "m"))],
        term: "parallel minor",
      },
      {
        text: `${sym(iv)} borrows ${pn(m6)} from ${pn(T)} minor; ${sym(bVII)} borrows ${pn(m7)} and ${pn(m6)}.`,
        highlight: [hl(m6, "♭6"), hl(m7, "♭7")],
        term: "borrowed",
        ask: { kind: "tapNotes", prompt: `Tap the key ${sym(iv)} takes from ${pn(T)} minor.`, answer: [m6] },
      },
      {
        text: `Both still land on ${pn(T)}: ${sym(iv)} → ${sym(I)} and ${sym(bVII)} → ${sym(I)}, a darker way home.`,
        highlight: [hl(T, "home")],
        sound: [tones(iv), tones(I), tones(bVII), tones(I)],
      },
    ],
    rule: "Lower the major scale's 3rd, 6th and 7th to find the chords you can borrow.",
  };
}

/** Every basics node's lesson, in any key. */
export const BASICS_LESSONS: Record<BasicsId, (tonic: string) => Lesson> = {
  "basics:sevenths": sevenths,
  "basics:numerals": numerals,
  "basics:tritone": tritone,
  "basics:guideTones": guideTonesLesson,
  "basics:dominantResolution": dominantResolution,
  "basics:twoFiveOne": twoFiveOne,
  "basics:extensions": extensions,
  "basics:parallelMinor": parallelMinor,
  "basics:dim7": dim7,
  "basics:symmetricOctave": symmetricOctave,
};
