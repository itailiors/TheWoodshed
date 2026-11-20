import type { PathStop } from "../../voiceLeading";
import type {
  BackdoorLearn,
  BorrowedIvLearn,
  ColtraneLearn,
  ConstantStructureLearn,
  OneNoteOnTopLearn,
  SecondaryDominantLearn,
  SecondaryTwoFiveLearn,
  TritoneSubLearn,
} from "../facts";
import { degreeWord, hl, hlTo, moves, pn, ps, twin, type Lesson } from "../lesson";

/*
 * Rule lessons. Each one reads only its rule's `facts.learn`, computed in `propose()`; nothing
 * here works out a note. Headline: the swap and what the ear gets. Steps: one idea each, two
 * real notes or more. Rule: one sentence, in degrees, for any key.
 */

function tritoneSub(f: TritoneSubLearn): Lesson {
  const [o3, o7] = f.guideTones;
  const [s3, s7] = f.subGuideTones;
  const [r3, r7] = f.resolution;
  const [orig, sub, target] = [ps(f.original), ps(f.sub), ps(f.target)];
  return {
    conceptId: "dominant.tritoneSub",
    headline: `Play ${sub} instead of ${orig}. Same two tense notes, but the bass slides down a half step into ${target}.`,
    steps: [
      {
        text: "A tritone is exactly half an octave: six half steps.",
        highlight: [hl(f.originalRoot, pn(f.originalRoot)), hl(f.subRoot, pn(f.subRoot), "up")],
        play: "interval",
        term: "tritone",
        prereqLink: "basics:tritone",
      },
      {
        text: `Go up a tritone from ${pn(f.originalRoot)}, the V of ${pn(f.targetRoot)}, and you land on ${pn(f.subRoot)}: the ♭II.`,
        highlight: [hl(f.originalRoot, "V"), hl(f.subRoot, "♭II", "up")],
      },
      {
        // the ask needs only what step 2 and the guide-tones basics gave: the original's 3rd and 7th
        text: `${orig}'s guide tones: ${pn(o3)} and ${pn(o7)}. ${sub} swaps them: ${twin(s3, o7)} is its 3rd, ${twin(s7, o3)} its 7th.`,
        highlight: [hl(o3, pn(s7)), hl(o7, pn(s3))],
        ask: { kind: "tapNotes", prompt: `${sub} keeps ${orig}'s guide tones. Tap them.`, answer: [o3, o7] },
        term: "guide tones",
        prereqLink: "basics:guideTones",
      },
      {
        text: `Both pull the same way: ${moves(r3)}, ${moves(r7)}. That's the resolution into ${target}.`,
        highlight: [hl(r3.from, "↑"), hlTo(r3, pn(r3.to)), hl(r7.from, "↓"), hlTo(r7, pn(r7.to))],
        play: "ab",
        prereqLink: "basics:dominantResolution",
      },
      {
        text: `What changes is the bass: ${pn(f.subRoot)} slides down a half step to ${pn(f.targetRoot)}, not ${pn(f.originalRoot)} falling a fifth.`,
        // the old bass sits a fifth above home, so both arrivals read as falls
        highlight: [hl(f.subRoot, "new"), hl(f.targetRoot, "home", "down"), hl(f.originalRoot, "old", "up")],
        play: "ab",
      },
    ],
    rule: "Over any dominant 7th resolving down a fifth, try the dominant 7th a half step above the target.",
    deeper:
      `Every note of ${sub} is a tone or tension of ${orig}: ${pn(f.subRoot)} is the ♭5, ${pn(f.subFifth)} the ♭9, ${pn(f.subNinth)} the ♭13. ` +
      `So ${pn(f.subRoot)} Lydian dominant and ${pn(f.originalRoot)} altered share all seven notes: both are modes of ${pn(f.parentMelodicMinor)} melodic minor.`,
  };
}

function secondaryDominant(f: SecondaryDominantLearn): Lesson {
  const [orig, dom, target] = [ps(f.original), ps(f.dominant), ps(f.target)];
  const [r3, r7] = f.resolution;
  const third = f.raised
    ? { text: `Raise its 3rd: ${pn(f.raised[0])} becomes ${pn(f.raised[1])}, the leading tone of ${pn(f.targetRoot)}.`, highlight: [hl(f.raised[0], "♭3"), hl(f.raised[1], "3rd", "up"), hl(f.targetRoot, "target", "up")] }
    : { text: `Its 3rd, ${pn(f.third)}, is already the leading tone of ${pn(f.targetRoot)}.`, highlight: [hl(f.third, "3rd"), hl(f.targetRoot, "target", "up")] };
  // the ask is "the 3rd and 7th", so both answer keys are lit on the reveal
  const seventh =
    f.seventhChange === "lowered" && f.lowered
      ? { text: `Flatten its 7th: ${pn(f.lowered[0])} drops to ${pn(f.lowered[1])}. Now it's ${dom}.`, highlight: [hl(f.lowered[0], "7"), hl(f.lowered[1], "♭7", "down"), hl(f.third, "3rd")] }
      : f.seventhChange === "kept"
        ? { text: `Its ♭7, ${pn(f.seventh)}, stays, and ${pn(f.third)} makes it ${dom}.`, highlight: [hl(f.seventh, "♭7"), hl(f.third, "3rd")] }
        : { text: `Add the ♭7, ${pn(f.seventh)}, over ${pn(f.root)}. Now it's ${dom}.`, highlight: [hl(f.root, "root"), hl(f.seventh, "♭7", "up"), hl(f.third, "3rd")] };
  return {
    conceptId: "functional.secondaryDominant",
    headline: `Play ${orig} as ${dom}. Its 3rd, ${pn(f.third)}, now leans a half step up into ${target}.`,
    steps: [
      { text: `${orig} already falls a fifth to ${target}: ${pn(f.root)} down to ${pn(f.targetRoot)}.`, highlight: [hl(f.root, "root"), hl(f.targetRoot, "target", "down")], play: "before" },
      { ...third, term: "leading tone", prereqLink: "basics:dominantResolution" },
      { ...seventh, ask: { kind: "tapNotes", prompt: `Tap the 3rd and 7th of ${dom}.`, answer: [f.third, f.seventh] } },
      {
        text: `Into ${target}, ${moves(r3)} and ${moves(r7)}.`,
        highlight: [hl(r3.from, "↑"), hlTo(r3, pn(r3.to)), hl(r7.from, r7.semitones ? "↓" : "holds"), hlTo(r7, pn(r7.to))],
        play: "ab",
      },
      ...(f.targetMinor && f.flatNine
        ? [{ text: `${target} is minor, so add the ♭9, ${pn(f.flatNine)}: ${pn(f.flatNine)} falls a half step into ${target}.`, highlight: [hl(f.flatNine, "♭9")] }]
        : []),
    ],
    rule: "If a chord's root falls a fifth to the next chord, keep the root and make it a dominant 7th.",
    deeper: f.targetMinor
      ? `Over ${dom}, play ${pn(f.root)} Phrygian dominant: the 5th mode of ${pn(f.targetRoot)} harmonic minor.`
      : `Give ${dom} its own related ii and you have the full secondary ii–V.`,
  };
}

function secondaryTwoFive(f: SecondaryTwoFiveLearn): Lesson {
  const [orig, ii, V, target] = [ps(f.original), ps(f.ii), ps(f.V), ps(f.target)];
  const [s7toV, s7toT] = f.iiSeventh.motions;
  const [s3toV, s3toT] = f.iiThird.motions;
  return {
    conceptId: "functional.secondaryTwoFive",
    headline: f.related
      ? `Split ${orig} into ${ii} → ${V}: its related ii in front, a full ii–V into ${target}.`
      : `Swap ${orig} for ${ii} → ${V}: a ii–V that walks you into ${target}.`,
    steps: [
      {
        // say what goes before what comes: the chart's chord is dropped for a V of the target
        text: f.related
          ? `${V} is the V of ${target}: ${pn(f.VRoot)} falls a fifth to ${pn(f.targetRoot)}.`
          : `We drop ${orig} and set up ${target} with its own V, ${V}: ${pn(f.VRoot)} falls a fifth to ${pn(f.targetRoot)}.`,
        highlight: [hl(f.VRoot, "V"), hl(f.targetRoot, "target", "down")],
        play: "before",
        prereqLink: "functional.secondaryDominant",
      },
      {
        text:
          `${ii} is ${f.related ? `${V}'s related ii` : "the ii"}` +
          `${f.targetMinor ? `, half-diminished because ${target} is minor` : ""}: ${pn(f.iiRoot)} falls a fifth to ${pn(f.VRoot)}.`,
        highlight: [hl(f.iiRoot, "ii"), hl(f.VRoot, "V", "down"), hl(f.targetRoot, "target", "down")],
        ...(f.related ? { term: "related ii" } : f.targetMinor ? { term: "half-diminished" } : {}),
      },
      {
        text: `${ii}'s 7th: ${moves(s7toV)}, ${V}'s ${degreeWord(s7toV.toDegree)}. Its 3rd: ${moves(s3toV)}, ${V}'s ${degreeWord(s3toV.toDegree)}.`,
        highlight: [hl(f.iiSeventh.from, "7th"), hlTo(s7toV, degreeWord(s7toV.toDegree)), hl(f.iiThird.from, "3rd")],
        // the ii's root can be a chord tone of the V too (G is C7's 5th): the ask names the guide tones
        ask: { kind: "tapNotes", prompt: `Which of ${ii}'s guide tones stays for ${V}? Tap it.`, answer: [s3toV.semitones === 0 ? s3toV.to : s7toV.to] },
        prereqLink: "basics:twoFiveOne",
      },
      {
        text: `Into ${target}, ${moves(s7toT)} and ${moves(s3toT)}.`,
        highlight: [hl(s7toT.from, pn(s7toT.from)), hlTo(s7toT, pn(s7toT.to)), hl(s3toT.from, pn(s3toT.from)), hlTo(s3toT, pn(s3toT.to))],
        play: "after",
      },
      ...(f.related ? [] : [{ text: `The trade: ${orig}'s colour goes, and ${pn(f.VRoot)} to ${pn(f.targetRoot)} makes a stronger arrival on ${target}.`, highlight: [hl(f.VRoot, "V"), hl(f.targetRoot, "target", "down")], play: "ab" as const }]),
    ],
    rule: "Before any major or minor chord, go up a fifth for the V and another fifth for the ii.",
    deeper: `${V}'s ♭9, ${pn(f.flatNine[0])}, falls a half step to ${pn(f.flatNine[1])}, the 5th of ${target}.`,
  };
}

function borrowedIv(f: BorrowedIvLearn): Lesson {
  const [IV, iv, target] = [ps(f.IV), ps(f.iv), ps(f.target)];
  const [six, flatSix, five] = f.line;
  return {
    conceptId: "modal.borrowedIv",
    headline: f.kept
      ? `Let ${IV} turn into ${iv} before ${target}: one note drops a half step, and home sounds bittersweet.`
      : `Play ${iv} instead of ${IV}: one note drops a half step, and ${target} sounds bittersweet.`,
    steps: [
      { text: `${iv} is borrowed from ${pn(f.targetRoot)} minor: ${pn(f.root)}'s chord with ${pn(flatSix)} for its 3rd.`, highlight: [hl(f.root, "root"), hl(flatSix, "♭3", "up")], play: "after", term: "borrowed", prereqLink: "basics:parallelMinor" },
      {
        text: `Its only change is the 3rd: ${pn(six)} drops a half step to ${pn(flatSix)}.`,
        highlight: [hl(six, "3rd"), hl(flatSix, "♭3", "down")],
        play: "ab",
        // "the key that changes" could be the old 3rd or the new one, and a maj7 IV changes its 7th too (E → D in Fm6): ask for the new 3rd
        ask: { kind: "tapNotes", prompt: `Lower ${IV}'s 3rd a half step. Tap the new key.`, answer: [flatSix] },
      },
      { text: `Then ${pn(flatSix)} falls again, to ${pn(five)}: the 5th of ${target}.`, highlight: [hl(flatSix, "♭6"), hl(five, "5th", "down")], play: "after" },
      {
        text: `That line, ${pn(six)} → ${pn(flatSix)} → ${pn(five)}, is the minor plagal sound: bittersweet, a softer landing than V–I.`,
        highlight: [hl(six, "6"), hl(flatSix, "♭6", "down"), hl(five, "5", "down")],
        play: "ab",
        term: "minor plagal",
      },
    ],
    rule: "When IV goes to I, make it minor on the way: drop its 3rd a half step.",
  };
}

function backdoor(f: BackdoorLearn): Lesson {
  const [orig, target, bVII] = [ps(f.original), ps(f.target), ps(f.bVII)];
  const route = [f.iv && ps(f.iv), bVII].filter(Boolean).join(" → ");
  return {
    conceptId: "modal.backdoorTwoFive",
    headline: `Come home from below: ${route} → ${target}. Darker than ${orig}, with no ${pn(f.leadingTone)} leaning up into ${pn(f.targetRoot)}.`,
    steps: [
      {
        text: f.iv
          ? `The backdoor borrows two chords from ${pn(f.targetRoot)} minor: ${ps(f.iv)} (iv) and ${bVII} (♭VII7).`
          : `The backdoor borrows ${bVII} from ${pn(f.targetRoot)} minor: the ♭VII7.`,
        highlight: [hl(f.bVIIRoot, "♭VII"), hl(f.targetRoot, "home", "up")],
        play: "after",
        term: "backdoor",
        prereqLink: f.iv ? "modal.borrowedIv" : "basics:parallelMinor",
      },
      {
        text: `${bVII} has no ${pn(f.leadingTone)}, so no leading tone pushes up into ${pn(f.targetRoot)}.`,
        highlight: [hl(f.leadingTone, "missing"), hl(f.targetRoot, "home", "up")],
        play: "ab",
      },
      {
        text: `Its ${pn(f.bVIISeventh)} falls a half step to ${pn(f.targetFifth)}; its root ${pn(f.bVIIRoot)} climbs a whole step to ${pn(f.targetRoot)}.`,
        highlight: [hl(f.bVIISeventh, "♭7"), hl(f.targetFifth, "5th", "down"), hl(f.bVIIRoot, "root"), hl(f.targetRoot, "home", "up")],
        play: "after",
      },
      {
        text: `Its 9th is ${twin(f.bVIINinth, f.targetRoot)}: home is already sounding before you arrive.`,
        highlight: [hl(f.bVIINinth, "9th")],
        ask: { kind: "tapNotes", prompt: `Which key of ${bVII} is already ${target}'s root? Tap it.`, answer: [f.bVIINinth] },
      },
    ],
    rule: "For a major I, play the minor 7th a 4th above it, then the dominant 7th a whole step below it.",
  };
}

/** "A, A♭, then G". */
const walkList = (ns: string[]) => (ns.length < 2 ? ns.map(pn).join("") : `${ns.slice(0, -1).map(pn).join(", ")}, then ${pn(ns[ns.length - 1])}`);

function coltrane(f: ColtraneLearn): Lesson {
  const [ii, V, target] = [ps(f.ii), ps(f.V), ps(f.target)];
  const [c1, c2, home] = f.centres;
  const [d1, d2, d3] = f.dominantRoots;
  const stop = (s: PathStop) => (s.respelled ? `${pn(s.note)} (held, respelled ${pn(s.respelled)})` : s.holds ? `${pn(s.note)} (held)` : pn(s.note));
  return {
    conceptId: "symmetric.coltraneSubstitution",
    headline: `Over ${ii} → ${V} → ${target}, tour three keys a major 3rd apart before landing on ${pn(f.targetRoot)}.`,
    steps: [
      {
        // the map first: where the tour goes, before how it gets there
        text: `The map first: three key centres, ${pn(c1)}, ${pn(c2)} and ${pn(home)}, a major 3rd apart.`,
        highlight: [hl(c1, "♭VI"), hl(c2, "III", "down"), hl(home, "home", "down")],
        map: [...f.centres],
        play: "interval",
        term: "key centre",
        prereqLink: "basics:symmetricOctave",
      },
      {
        text: `Each key is tonicized by its own V7: ${f.dominants.map((d, k) => `${ps(d)} → ${ps(f.centreChords[k])}`).join(", ")}.`,
        highlight: [hl(d1, "V7"), hl(d2, "V7"), hl(d3, "V7")],
        ask: { kind: "tapNotes", prompt: `Each key gets its own V7. Tap the root a fifth above ${pn(c1)}.`, answer: [d1] },
        term: "tonicize",
        prereqLink: "functional.secondaryTwoFive",
      },
      {
        // a descending single voice (the ii's 3rd), its holds folded: not a guide-tone line
        text: `One voice carries it: ${f.line.map(stop).join(", ")}.`,
        highlight: f.line.slice(0, 4).map((s) => hl(s.note, s.holds ? "held" : pn(s.note))),
        play: "after",
      },
      {
        text: `Then ${ps(f.dominants[2])} → ${target}, the V–I you started with, lands home on time.`,
        highlight: [hl(d3, "V"), hl(f.targetRoot, "home")],
        play: "ab",
      },
    ],
    rule: "Over a ii–V–I, tonicize the keys a major 3rd apart: V7–I into ♭VI, V7–I into III, then V7–I home.",
    deeper: `The three dominants, ${f.dominants.slice(0, 2).map(ps).join(", ")} and ${ps(f.dominants[2])}, form a major-3rd cycle of their own.`,
  };
}

function constantStructure(f: ConstantStructureLearn): Lesson {
  const target = ps(f.target);
  const approach = ps(f.planed[f.planed.length - 1]);
  const lit = <T>(xs: T[]) => f.lit.map((k) => xs[k]);
  const twoStep = f.planed.length > 1;
  // a shape of up to 4 keys is asked whole; a bigger one by its 3rd and 7th, since only 4 keys light
  const ask =
    f.approachTones.length <= 4
      ? { prompt: `Move the whole shape up a half step. Tap ${approach}.`, answer: f.approachTones }
      : { prompt: `Move the whole shape up a half step. Tap the 3rd and 7th of ${approach}.`, answer: [...f.approachGuide] };
  return {
    conceptId: "chromatic.constantStructure",
    headline: `Slide into ${target} with its own shape: ${[...f.planed.map(ps), target].join(" → ")}, the whole hand moving together.`,
    steps: [
      {
        text: `${target}'s shape is ${f.shapeTones.map(pn).join(", ")}. Constant structure keeps that shape and moves it.`,
        highlight: lit(f.shapeTones).map((n) => hl(n, pn(n))),
        play: "interval",
        term: "constant structure",
      },
      {
        text: `Up a half step it's ${approach}: ${f.approachTones.map(pn).join(", ")}. Same shape, new root.`,
        highlight: lit(f.approachTones).map((n) => hl(n, pn(n))),
        ask: { kind: "tapNotes", ...ask },
      },
      {
        text: `Slide down: ${lit(f.slide)
          .map((m) => `${pn(m.from)} to ${pn(m.to)}`)
          .join(", ")}. Every voice moves together.`,
        highlight: lit(f.slide).map((m) => hl(m.to, pn(m.to))),
        play: "after",
      },
      {
        text: `The ear follows the moving shape, not the key, so ${f.planed.map(ps).join(" and ")} lead${twoStep ? "" : "s"} into ${target}.`,
        highlight: f.planedRoots.map((n, k) => hl(n, pn(n), k ? "down" : undefined)),
        play: "ab",
      },
    ],
    rule: "Near the end of a chord, play the next chord's exact shape a half step above it and slide the whole hand down.",
    deeper: twoStep
      ? `With room for two, start a whole step above, as here: ${ps(f.planed[0])}, ${approach}, then ${target}.`
      : "With a longer chord, start a whole step above and slide down twice.",
  };
}

function oneNoteOnTop(f: OneNoteOnTopLearn): Lesson {
  const T = pn(f.heldNote);
  const [orig, target] = [ps(f.original), ps(f.target)];
  const walk = [...f.basses, f.targetBass];
  const three = f.basses.length > 2;
  // over a walk bass, "the 3rd" or "the 7th" could be either quality, and the ask must name one bass: say which
  const role = (d: string) => (d === "7" ? "major 7th" : d === "b3" ? "minor 3rd" : degreeWord(d));
  const over = (k: number, it: string) => `${pn(f.basses[k])}, ${it} the ${role(f.roles[k])} of ${ps(f.walkChords[k])}`;
  const land = f.landing ? `Into ${target}, ${T} lands as the ${degreeWord(f.landing)}.` : `Then ${target} arrives under it.`;
  const top = hl(f.heldNote, "top");
  const shared = !f.fromMelody && f.heldIn && f.landing;
  // the ask: the second walk chord's role, which no other walk chord shares (each bass sits a different distance under the top)
  return {
    conceptId: "melody.oneNoteOnTop",
    headline: `Hold ${T} on top while the bass walks ${walk.map(pn).join(", ")}: one note, new colours under it.`,
    steps: [
      {
        text: shared
          ? `${T} is ${orig}'s ${degreeWord(f.heldIn!)} and ${target}'s ${degreeWord(f.landing!)}: it can stay on top through the change.`
          : f.fromMelody
            ? `The melody holds ${T}, so keep it as the top voice.`
            : `Keep ${T} on top through the change.`,
        highlight: [top],
        play: "before",
      },
      {
        text: `Under it, the bass walks down by half steps: ${walkList(walk)}.`,
        // a 3-chord walk has four basses: they fill the keyboard, and step 1 already lit the top
        highlight: [...(three ? [] : [top]), ...walk.map((n, k) => hl(n, pn(n), k ? "down" : three ? undefined : "down"))],
        play: "after",
        prereqLink: "basics:extensions",
      },
      {
        text: `Over ${over(0, `${T} is`)}; over ${over(1, "it's")}.`,
        highlight: [top, hl(f.basses[0], pn(f.basses[0]), "down"), hl(f.basses[1], pn(f.basses[1]), "down")],
        ask: { kind: "tapNotes", prompt: `${T} is the ${role(f.roles[1])} of one walk chord. Tap its bass.`, answer: [f.basses[1]] },
      },
      {
        text: three ? `Over ${over(2, `${T} is`)}. ${land}` : `${land} The top never moved; the colour under it did.`,
        highlight: [top, ...(three ? [hl(f.basses[2], pn(f.basses[2]), "down")] : []), hl(f.targetBass, pn(f.targetBass), "down")],
        play: "ab",
      },
    ],
    rule: "Under a held top note, walk the bass down by half steps and build each chord to contain that note.",
    deeper: three
      ? "The top never moved; the colour under it did. A half step above the bass suggests 7(♭9), a tritone 7(♯11)."
      : "The interval from bass to top note suggests the chord: a half step above the bass gives 7(♭9), a tritone 7(♯11).",
  };
}

/** Rule lessons by rule id, each reading its rule's `facts.learn`. */
export const RULE_LESSONS = {
  "dominant.tritoneSub": tritoneSub,
  "functional.secondaryDominant": secondaryDominant,
  "functional.secondaryTwoFive": secondaryTwoFive,
  "modal.borrowedIv": borrowedIv,
  "modal.backdoorTwoFive": backdoor,
  "symmetric.coltraneSubstitution": coltrane,
  "chromatic.constantStructure": constantStructure,
  "melody.oneNoteOnTop": oneNoteOnTop,
} as const satisfies Record<string, (f: never) => Lesson>;
