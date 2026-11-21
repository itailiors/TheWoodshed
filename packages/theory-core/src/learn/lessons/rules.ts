import type { VoiceMotion } from "../../types";
import type { PathStop } from "../../voiceLeading";
import type {
  BackdoorLearn,
  BorrowedIvLearn,
  ColtraneLearn,
  CommonToneDiminishedLearn,
  ConstantStructureLearn,
  FlatSixFlatSevenLearn,
  GospelTurnaroundLearn,
  MediantDominantLearn,
  MinorLineClicheLearn,
  OneNoteOnTopLearn,
  PassingDiminishedLearn,
  RootlessTwoFiveOneLearn,
  SecondaryDominantLearn,
  SecondaryTwoFiveLearn,
  TritoneSubLearn,
  UpperStructureBVILearn,
  UpperStructureIILearn,
} from "../facts";
import { degreeWord, hl, hlTo, motionVerb, moves, pn, ps, twin, type Lesson } from "../lesson";

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
      `And ${pn(f.subRoot)} Lydian dominant and ${pn(f.originalRoot)} altered share all seven notes: both are modes of ${pn(f.parentMelodicMinor)} melodic minor.`,
  };
}

function secondaryDominant(f: SecondaryDominantLearn): Lesson {
  const [orig, dom, target] = [ps(f.original), ps(f.dominant), ps(f.target)];
  // the 3rd and ♭7 make the plain 7th chord: its ♭9 (A7(♭9)) or 9 (C9) only comes later, if at all
  const plain = ps(f.dominantPlain);
  const [r3, r7] = f.resolution;
  const third = f.raised
    ? { text: `Raise its 3rd: ${pn(f.raised[0])} becomes ${pn(f.raised[1])}, the leading tone of ${pn(f.targetRoot)}.`, highlight: [hl(f.raised[0], "♭3"), hl(f.raised[1], "3rd", "up"), hl(f.targetRoot, "target", "up")] }
    : { text: `Its 3rd, ${pn(f.third)}, is already the leading tone of ${pn(f.targetRoot)}.`, highlight: [hl(f.third, "3rd"), hl(f.targetRoot, "target", "up")] };
  // the ask is "the 3rd and 7th", so both answer keys are lit on the reveal
  const seventh =
    f.seventhChange === "lowered" && f.lowered
      ? { text: `Flatten its 7th: ${pn(f.lowered[0])} drops to ${pn(f.lowered[1])}. Now it's ${plain}.`, highlight: [hl(f.lowered[0], "7"), hl(f.lowered[1], "♭7", "down"), hl(f.third, "3rd")] }
      : f.seventhChange === "kept"
        ? { text: `Its ♭7, ${pn(f.seventh)}, stays: with ${pn(f.third)} it's ${plain}.`, highlight: [hl(f.seventh, "♭7"), hl(f.third, "3rd")] }
        : { text: `Add the ♭7, ${pn(f.seventh)}, over ${pn(f.root)}. Now it's ${plain}.`, highlight: [hl(f.root, "root"), hl(f.seventh, "♭7", "up"), hl(f.third, "3rd")] };
  return {
    conceptId: "functional.secondaryDominant",
    headline: `Play ${orig} as ${dom}. Its 3rd, ${pn(f.third)}, now leans a half step up into ${target}.`,
    steps: [
      { text: `${orig} already falls a fifth to ${target}: ${pn(f.root)} down to ${pn(f.targetRoot)}.`, highlight: [hl(f.root, "root"), hl(f.targetRoot, "target", "down")], play: "before" },
      { ...third, term: "leading tone", prereqLink: "basics:dominantResolution" },
      { ...seventh, ask: { kind: "tapNotes", prompt: `Tap the 3rd and 7th of ${plain}.`, answer: [f.third, f.seventh] } },
      {
        text: `Into ${target}, ${moves(r3)} and ${moves(r7)}.`,
        highlight: [hl(r3.from, "↑"), hlTo(r3, pn(r3.to)), hl(r7.from, r7.semitones ? "↓" : "holds"), hlTo(r7, pn(r7.to))],
        play: "ab",
      },
      ...(f.targetMinor && f.flatNine
        ? [{ text: `${target} is minor, so add the ♭9, ${pn(f.flatNine)}, for ${dom}: ${pn(f.flatNine)} falls a half step into ${target}.`, highlight: [hl(f.flatNine, "♭9")] }]
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
          : `Drop ${orig} and set up ${target} with its own V, ${V}: ${pn(f.VRoot)} falls a fifth to ${pn(f.targetRoot)}.`,
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
    rule: "Before any major or minor chord, go up a fifth for the V and another fifth for the ii; into minor, make the ii m7♭5.",
    deeper: `${V}'s ♭9, ${pn(f.flatNine[0])}, falls a half step to ${pn(f.flatNine[1])}, the 5th of ${target}.`,
  };
}

/** "C minor"; in G♭, "F♯ minor (G♭'s parallel minor)": 9 flats isn't a key anyone reads in. */
const minorName = (minorKey: string, home: string) => (pn(minorKey) === pn(home) ? `${pn(home)} minor` : `${pn(minorKey)} minor (${pn(home)}'s parallel minor)`);

function borrowedIv(f: BorrowedIvLearn): Lesson {
  const [IV, iv, target] = [ps(f.IV), ps(f.iv), ps(f.target)];
  const [six, flatSix, five] = f.line;
  return {
    conceptId: "modal.borrowedIv",
    headline: f.kept
      ? `Let ${IV} turn into ${iv} before ${target}: one note drops a half step, and home sounds bittersweet.`
      : `Play ${iv} instead of ${IV}: one note drops a half step, and ${target} sounds bittersweet.`,
    steps: [
      { text: `${iv} is borrowed from ${minorName(f.minorKey, f.targetRoot)}: ${pn(f.root)}'s chord with ${pn(flatSix)} for its 3rd.`, highlight: [hl(f.root, "root"), hl(flatSix, "♭3", "up")], play: "after", term: "borrowed", prereqLink: "basics:parallelMinor" },
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
          ? `The backdoor borrows two chords from ${minorName(f.minorKey, f.targetRoot)}: ${ps(f.iv)} (iv) and ${bVII} (♭VII7).`
          : `The backdoor borrows ${bVII} from ${minorName(f.minorKey, f.targetRoot)}: the ♭VII7.`,
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
        // the root charted otherwise than the key's ♭7 (E in G♭) gets its twin, so the whole step reads as one
        text:
          pn(f.bVIIRoot) === pn(f.bVIIDegree)
            ? `Its ${pn(f.bVIISeventh)} falls a half step to ${pn(f.targetFifth)}; its root ${pn(f.bVIIRoot)} climbs a whole step to ${pn(f.targetRoot)}.`
            : `Its ${pn(f.bVIISeventh)} falls to ${pn(f.targetFifth)}; its root ${twin(f.bVIIRoot, f.bVIIDegree)} climbs a whole step to ${pn(f.targetRoot)}.`,
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
        // a centre charted by its easier key signature (E♭ over B) shows the key's own degree once: "E♭ (same key as D♯)"
        text: `The map first: three key centres, ${twin(c1, f.centreDegrees[0])}, ${twin(c2, f.centreDegrees[1])} and ${pn(home)}, a major 3rd apart.`,
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

/** "A, B and C". */
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** "G♯ falls a half step to G", "G♯ holds". */
const COUNT = ["", "", "two", "three", "four"];
/** Words as the copy budget counts them (anything with a letter or digit). */
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** A short verb for a voice that moves ("slips to", "steps down to"); a run of the same verb says it once: "C♯ slips to C, B♭ to A". */
const shortVerb = (m: VoiceMotion) => {
  const n = Math.abs(m.semitones);
  return n === 1 ? (m.semitones < 0 ? "slips to" : "rises to") : n === 2 ? (m.semitones < 0 ? "steps down to" : "steps up to") : "moves to";
};
function voiceList(moving: VoiceMotion[]): string {
  return moving.map((m, k) => `${pn(m.from)} ${k > 0 && shortVerb(moving[k - 1]) === shortVerb(m) ? "to" : shortVerb(m)} ${pn(m.to)}`).join(", ");
}

function mediantDominant(f: MediantDominantLearn): Lesson {
  const [orig, sub, target] = [ps(f.original), ps(f.sub), ps(f.target)];
  const [r3, r7] = f.resolution;
  const [b9, fifth] = f.inner;
  // every voice into the target: the four upper ones by motion, the bass (the target's 3rd) and any upper voice that holds, together
  const voices = [r3, b9, r7, fifth];
  const moving = voices.filter((m) => m.semitones !== 0);
  const held = [f.subRoot, ...voices.filter((m) => m.semitones === 0).map((m) => m.from)].map(pn);
  const into = `Into ${target}, ${voiceList(moving)}; ${listOf(held)} ${held.length > 1 ? "hold" : "holds"}.`;
  // III7(♭9)'s own spelling, with the °7 key it shares in parentheses where they differ (G♯, same key as A♭)
  const named = f.subTones.map((n, k) => twin(n, f.dimTwins[k]));
  return {
    conceptId: "dominant.mediantDominant",
    headline: `Play ${sub} instead of ${orig}: the same diminished shape on top, a new bass under it.`,
    steps: [
      {
        text: `Add the ♭9 to ${orig} and drop the root: ${f.dim.map(pn).join(", ")}, a diminished 7th.`,
        highlight: f.dim.map((n) => hl(n, pn(n))),
        play: "ab",
        term: "diminished 7th",
        prereqLink: "basics:dim7",
      },
      {
        text: `Put ${pn(f.subRoot)} under them: ${listOf(named)} make ${sub}.`,
        highlight: [hl(f.subRoot, "bass"), hl(f.subTones[0], "3rd"), hl(f.subTones[2], "♭7"), hl(f.subTones[3], "♭9")],
        ask: { kind: "tapNotes", prompt: `Keep those four keys. Tap the bass a major 3rd above ${pn(f.targetRoot)}.`, answer: [f.subRoot] },
      },
      {
        text: into,
        // the four upper voices (the step's cap), each marked with where it goes
        highlight: voices.map((m) => hl(m.from, m.semitones === 0 ? "holds" : `→ ${pn(m.to)}`)),
        play: "ab",
      },
      {
        // the four dominants by root: "E7" would be a second name for this move's E7(♭9)
        text: `With a ♭9, the dominants on ${listOf(f.familyRoots.map(pn))} all hold these four keys: the Family.`,
        highlight: f.familyRoots.map((n, k) => hl(n, ["V", "♭VII", "♭II", "III"][k])),
        term: "the Family",
      },
    ],
    rule: "Over V7 to I, keep the diminished 7th a half step below I and put the bass a major 3rd above I.",
    deeper: `${sub} usually leads to ${ps(f.relativeMinorChord)}, so the ear expects ${pn(f.relativeMinor)} minor and gets ${pn(f.targetRoot)} major instead.`,
  };
}

function gospelTurnaround(f: GospelTurnaroundLearn): Lesson {
  const [orig, sus, approach, target, landing] = [ps(f.original), ps(f.sus), ps(f.approach), ps(f.target), ps(f.landing)];
  const [lh, rh] = [f.grip.lh, f.grip.rh];
  const falls = f.gripMotions.filter((m) => m.semitones < 0);
  const rises = f.gripMotions.filter((m) => m.semitones > 0);
  // the held keys, a respelled one last: "G and C♭ (same key as B) hold"
  const holds = f.gripMotions.filter((m) => m.semitones === 0).sort((a, b) => Number(pn(a.from) !== pn(a.to)) - Number(pn(b.from) !== pn(b.to)));
  const holdList = `${listOf(holds.map((m) => twin(m.from, m.to)))} hold${holds.length === 1 ? "s" : ""}`;
  const risen = rises.map((m) => `${moves(m)}; `).join("");
  const full = `Into ${landing}, ${listOf(falls.map((m) => pn(m.from)))} fall a half step; ${risen}${holdList}.`;
  // a respelled hold plus a rising voice runs past 20 words: then the falling voices go unnamed
  const short = `Into ${landing}, ${holdList}; ${risen}every other voice falls a half step.`;
  const one = f.held.length === 1;
  return {
    conceptId: "gospel.halfStepTurnaround",
    headline: `Turn ${orig} → ${target} into ${sus} → ${approach} → ${landing}: a slide into home from a half step above.`,
    steps: [
      {
        // one name for the chord: F/G, glossed as "a sus chord" rather than renamed G9sus
        text: `${sus}: the ${pn(f.susTriad[0])} triad over ${pn(f.susRoot)} in the bass, a sus chord. No ${pn(f.leadingTone)}, so nothing leans into ${pn(f.targetRoot)} yet.`,
        highlight: [hl(f.susRoot, "bass"), ...f.susTriad.map((n) => hl(n, pn(n), "up"))],
        play: "after",
        term: "sus",
      },
      {
        text: `${approach} is the tritone sub of ${orig}, its root a half step above ${pn(f.targetRoot)}.`,
        highlight: [hl(f.approachRoot, "♭II"), hl(f.targetRoot, "home", "down"), hl(f.susRoot, "old root", "up")],
        prereqLink: "dominant.tritoneSub",
      },
      {
        // a playable grip, not a 7-note cluster
        text: `Left hand ${lh.map(pn).join(", ")}; right hand the ${pn(rh[0])} triad: the 9th, ♯11 and 13th.`,
        highlight: [hl(lh[0], "root"), hl(rh[0], "9th"), hl(rh[1], "♯11", "up"), hl(rh[2], "13th", "up")],
        play: "after",
        prereqLink: "basics:extensions",
      },
      {
        text: wordCount(full) <= 20 ? full : short,
        highlight: [
          ...holds.map((m) => hl(m.from, pn(m.from) === pn(m.to) ? "holds" : `holds as ${pn(m.to)}`)),
          ...rises.map((m) => hl(m.from, "↑")),
          hl(falls[0].from, "↓"),
          hlTo(falls[0], pn(falls[0].to)),
        ].slice(0, 4),
        play: "after",
        ask: {
          kind: "tapNotes",
          prompt: one ? `Which key of ${approach} stays put into ${landing}? Tap it.` : `Which keys of ${approach} stay put into ${landing}? Tap them.`,
          answer: f.held,
        },
      },
      {
        text: `Compare: ${pn(f.susRoot)} falls a fifth to ${pn(f.targetRoot)}; here ${pn(f.approachRoot)} slides down a half step after the sus.`,
        highlight: [hl(f.susRoot, "old"), hl(f.approachRoot, "new"), hl(f.targetRoot, "home", "down")],
        play: "ab",
      },
    ],
    rule: "Before a major I, play IV/V, then a 13(♯11) chord a half step above I, and slide down into I.",
    deeper: `${approach}'s ♯11 is ${twin(f.sharpEleven, f.susRoot)}: the sub keeps ${orig}'s root inside, as the ♯11.`,
  };
}

function passingDiminished(f: PassingDiminishedLearn): Lesson {
  const [from, dim, target] = [ps(f.from), ps(f.dim), ps(f.target)];
  const dir = f.ascending ? "up" : "down";
  const walk = [f.fromRoot, f.dimRoot, f.targetRoot];
  const gap = {
    text: `${pn(f.fromRoot)} to ${pn(f.targetRoot)} is a whole step. ${dim} fills it, so the bass ${f.ascending ? "moves" : "walks down"} by half steps.`,
    highlight: walk.map((n, k) => hl(n, pn(n), k ? dir : undefined)),
    play: "ab" as const,
    prereqLink: "basics:dim7",
  };
  const headline = `Between ${from} and ${target}, slip in ${dim}: the bass walks ${f.ascending ? "" : "down "}${walk.map(pn).join(", ")} by half steps.`;
  const rule = "Between two chords a whole step apart, put a diminished 7th on the half step between their roots.";
  if (f.ascending) {
    // going up, the °7 is the target's V7(♭9) without its root: its 3rd rises home, its ♭9 falls to the 5th
    const [lead, flatNine] = f.pull!;
    const v = f.vTones!;
    // spelled as the V7(♭9)'s own 3rd, 5th, ♭7 and ♭9, so the intervals match the claim; the first key
    // that the °7's own spelling names differently gets its twin (B♯, same key as C, under Cdim7)
    const twinAt = v.findIndex((n, k) => pn(n) !== pn(f.dimTones[k]));
    const named = v.map((n, k) => (k === twinAt ? twin(n, f.dimTones[k]) : pn(n)));
    return {
      conceptId: "chromatic.passingDiminished",
      headline,
      steps: [
        gap,
        {
          text: `${named.join(", ")} are ${ps(f.impliedV7)} without ${pn(f.impliedV)}: its ${listOf(f.roles.map(degreeWord))}.`,
          highlight: [hl(f.impliedV, "V"), hl(v[0], degreeWord(f.roles[0])), hl(v[2], degreeWord(f.roles[2])), hl(v[3], degreeWord(f.roles[3]))],
          ask: { kind: "tapNotes", prompt: `${dim} is a dominant without its root. Tap that root: the V of ${target}.`, answer: [f.impliedV] },
          prereqLink: "functional.secondaryDominant",
        },
        {
          text: `So ${dim} works as ${target}'s V7(♭9) with no root: ${moves(lead)}, ${moves(flatNine)}.`,
          highlight: [hl(lead.from, "↑"), hlTo(lead, pn(lead.to)), hl(flatNine.from, "↓"), hlTo(flatNine, pn(flatNine.to))],
          play: "after",
        },
      ],
      rule,
      deeper: `Any rising passing °7 works the same way: it is the next chord's V7(♭9) with no root, like ${ps(f.impliedVPlain)} here.`,
    };
  }
  // going down, it isn't a dominant: it shares keys with the target and the rest step into it
  const movers = f.moving;
  const n = f.shared.length;
  return {
    conceptId: "chromatic.passingDiminished",
    headline,
    steps: [
      gap,
      {
        text: `${dim} already holds ${listOf(f.shared.map((s) => pn(s.note)))}, ${target}'s ${listOf(f.shared.map((s) => degreeWord(s.degree)))}.`,
        highlight: f.shared.map((s) => hl(s.note, degreeWord(s.degree))),
        ask: { kind: "tapNotes", prompt: n === 1 ? `Tap the key ${dim} shares with ${target}.` : `Tap the ${COUNT[n]} keys ${dim} shares with ${target}.`, answer: f.shared.map((s) => s.note) },
      },
      {
        text: `The other keys move: ${listOf(movers.map(moves))}.`,
        highlight: movers.slice(0, 2).flatMap((m) => [hl(m.from, pn(m.from)), hlTo(m, pn(m.to))]),
        play: "after",
      },
    ],
    rule,
    deeper: `Falling, ${dim} isn't a dominant: its symmetrical shape lets every voice hold or step into ${target}.`,
  };
}

function commonToneDiminished(f: CommonToneDiminishedLearn): Lesson {
  const [dim, chord] = [ps(f.dim), ps(f.chord)];
  const [l3, l5] = f.leans;
  const [root, , , sixth] = f.dimTones;
  return {
    conceptId: "chromatic.commonToneDiminished",
    headline: `Start on ${dim}, then ${chord}: two notes lean a half step up into the chord.`,
    steps: [
      {
        text: `${dim} is ${f.dimTones.map(pn).join(", ")}: it shares ${f.shared.length === 1 ? `only ${pn(root)}` : listOf(f.shared.map(pn))} with ${chord}${f.bassStays ? ", and the bass stays" : ""}.`,
        highlight: [hl(root, "root"), hl(l3.from, "♯2", "up"), hl(l5.from, "♯4", "up"), hl(sixth, "6th", "up")],
        play: "after",
        prereqLink: "basics:dim7",
      },
      {
        text: `${moves(l3)}, the 3rd; ${moves(l5)}, the 5th.`,
        highlight: [hl(l3.from, "♯2"), hlTo(l3, "3rd"), hl(l5.from, "♯4"), hlTo(l5, "5th")],
        play: "after",
        ask: { kind: "tapNotes", prompt: `Which two keys of ${dim} rise a half step into ${chord}? Tap them.`, answer: [l3.from, l5.from] },
      },
      {
        text: `${pn(l3.from)} and ${pn(l5.from)} are appoggiaturas: tension on the beat that resolves up into ${chord}.`,
        highlight: [hl(l3.from, "↑"), hl(l5.from, "↑")],
        play: "ab",
        term: "appoggiatura",
      },
    ],
    rule: "On a major chord that lasts, start on the diminished 7th with the same root and let its middle notes rise a half step.",
    // key-proof: over B the ♯2 is D (C𝄪 respelled), so "sharps" would be contradicted by the spelling beside it
    deeper: "Spelled as a raised 2nd and 4th because they rise: the passing °7 that falls spells the same keys with flats.",
  };
}

function minorLineCliche(f: MinorLineClicheLearn): Lesson {
  const [, seven, flatSeven, six] = f.line;
  return {
    conceptId: "chromatic.minorLineCliche",
    headline: `Hold ${ps(f.stops[0])} and walk its root down by half steps: ${f.line.map(pn).join(", ")}.`,
    steps: [
      {
        text: `Keep ${pn(f.third)} and ${pn(f.fifth)} still: the minor triad's 3rd and 5th.`,
        highlight: [hl(f.third, "3rd"), hl(f.fifth, "5th", "up")],
        play: "before",
      },
      {
        text: `The root voice walks down by half steps: ${f.line.map(pn).join(", ")}. That's a line cliché.`,
        highlight: f.line.map((n, k) => hl(n, pn(n), k ? "down" : undefined)),
        play: "after",
        ask: { kind: "tapNotes", prompt: `Start on ${pn(f.root)}. Tap the next three keys down by half steps.`, answer: f.line.slice(1) },
        term: "line cliché",
      },
      {
        text: `Each stop renames the chord: ${f.stops.map(ps).join(", ")}.`,
        highlight: [hl(seven, "maj7"), hl(flatSeven, "♭7", "down"), hl(six, "6", "down")],
        play: "ab",
      },
    ],
    rule: "Over a long minor chord, hold the 3rd and 5th; walk the root voice down, inside or in the bass: 1, 7, ♭7, 6.",
    deeper: "Move the line to the top voice and it becomes a melody over a still chord.",
  };
}

function rootlessTwoFiveOne(f: RootlessTwoFiveOneLearn): Lesson {
  const [ii, V, I] = [ps(f.ii), ps(f.V), ps(f.I)];
  const moving = f.toV.find((m) => m.semitones !== 0)!;
  const kept = f.toV.filter((m) => m.semitones === 0).map((m) => pn(m.from));
  const vWords = f.vDegrees.map(degreeWord);
  const falls = f.toI.filter((m) => m.semitones !== 0);
  const holds = f.toI.filter((m) => m.semitones === 0);
  // "F falls to E, A to G, E to D; B holds"
  const fallList = falls.map((m, k) => (k ? `${pn(m.from)} to ${pn(m.to)}` : `${pn(m.from)} falls to ${pn(m.to)}`)).join(", ");
  return {
    conceptId: "voicing.rootlessTwoFiveOne",
    headline: `Voice ${ii} → ${V} → ${I} without roots: one finger moves from ii to V.`,
    steps: [
      {
        text: `Play ${ii} rootless: ${f.iiGrip.map(pn).join(", ")}, its 3rd, 5th, 7th and 9th.`,
        highlight: f.iiGrip.map((n, k) => hl(n, ["3rd", "5th", "7th", "9th"][k])),
        play: "after",
        term: "rootless",
        prereqLink: "basics:extensions",
      },
      {
        text: `Only ${pn(moving.from)} moves: it ${motionVerb(moving)} to ${pn(moving.to)}, ${V}'s 3rd. ${listOf(kept)} stay.`,
        highlight: [hl(moving.from, "7th"), hlTo(moving, "3rd"), ...f.toV.filter((m) => m.semitones === 0).slice(0, 2).map((m) => hl(m.from, pn(m.from)))],
        ask: { kind: "tapNotes", prompt: `One key of ${ii} moves to make ${V}. Tap where it goes.`, answer: [moving.to] },
        prereqLink: "basics:twoFiveOne",
      },
      {
        text: `Now ${f.vGrip.map(pn).join(", ")} read as ${V}'s ${listOf(vWords)}.`,
        highlight: f.vGrip.map((n, k) => hl(n, vWords[k])),
        play: "after",
      },
      {
        text: `Into ${I}, ${fallList}${holds.length ? `; ${listOf(holds.map(moves))}` : ""}.`,
        highlight: f.iGrip.map((n, k) => hl(n, ["3rd", "5th", "7th", "9th"][k])),
        play: "ab",
      },
    ],
    rule: "Over ii–V–I, voice ii as 3–5–7–9, drop only its 7th a half step for V, then step down into 3–5–7–9 on I.",
    deeper: "Grip A has the 3rd on the bottom, grip B the 7th. Start ii on either; each fifth down swaps them.",
  };
}

function upperStructureBVI(f: UpperStructureBVILearn): Lesson {
  const [voiced, target] = [ps(f.voiced), ps(f.target)];
  const [root, seventh, third] = f.shell;
  const [flat13, , sharp9] = f.triad;
  const r = f.thirdResolves;
  return {
    conceptId: "voicing.upperStructureBVI",
    // the shell by its notes, not "A7's shell": the chart may call this chord A7(♭9), and the move names it once, as `voiced`
    headline: `Play the ${pn(f.triadRoot)} triad over ${listOf(f.shell.map(pn))}: one hand shape gives you ${voiced}.`,
    steps: [
      {
        text: `Left hand: ${f.shell.map(pn).join(", ")}. Root, ♭7 and 3rd: the dominant's shell.`,
        highlight: [hl(root, "root"), hl(seventh, "♭7", "up"), hl(third, "3rd", "up")],
        play: "interval",
        term: "shell",
        prereqLink: "basics:guideTones",
      },
      {
        text: `Right hand: the ${pn(f.triadRoot)} major triad, a major 3rd below ${pn(f.root)}: the upper structure.`,
        highlight: f.triad.map((n) => hl(n, pn(n))),
        ask: { kind: "tapNotes", prompt: `Tap the major triad a major 3rd below ${pn(f.root)}.`, answer: [...f.triad] },
        term: "upper structure",
      },
      {
        text: `Over ${pn(f.root)}, the triad reads ♭13, root, ♯9: ${twin(sharp9, f.sharpNine)} is the ♯9.`,
        highlight: [hl(flat13, "♭13"), hl(f.root, "root"), hl(sharp9, "♯9")],
        play: "after",
        prereqLink: "basics:extensions",
      },
      {
        text: f.common.length
          ? `Into ${target}, ${moves(r)}, and ${listOf(f.common.map(pn))} ${f.common.length > 1 ? "are" : "is"} already there.`
          : `Into ${target}, ${moves(r)}.`,
        highlight: [hl(r.from, r.semitones > 0 ? "↑" : r.semitones < 0 ? "↓" : "holds"), hlTo(r, pn(r.to)), ...f.common.map((n) => hl(n, "held"))].slice(0, 4),
        play: "ab",
      },
    ],
    rule: "Over a dominant 7th, hold root, ♭7 and 3rd in the left hand and play the major triad on its ♭13 above.",
    deeper: `All three triad notes sit in ${pn(f.root)} altered, so the right hand can keep going in that scale.`,
  };
}

function upperStructureII(f: UpperStructureIILearn): Lesson {
  const voiced = ps(f.voiced);
  const [root, third, seventh] = f.shell;
  const [nine, sharp11, thirteen] = f.triad;
  return {
    conceptId: "voicing.upperStructureII",
    headline: `Play the ${pn(f.triadRoot)} major triad over ${listOf(f.shell.map(pn))}: ${voiced}, bright and open.`,
    steps: [
      {
        text: `Left hand: ${f.shell.map(pn).join(", ")}. Root, 3rd and ♭7: the shell.`,
        highlight: [hl(root, "root"), hl(third, "3rd", "up"), hl(seventh, "♭7", "up")],
        play: "interval",
        term: "shell",
        prereqLink: "basics:guideTones",
      },
      {
        text: `Right hand: the ${pn(f.triadRoot)} major triad, a whole step above ${pn(f.root)}: the upper structure.`,
        highlight: f.triad.map((n) => hl(n, pn(n))),
        ask: { kind: "tapNotes", prompt: `Tap the major triad a whole step above ${pn(f.root)}.`, answer: [...f.triad] },
        term: "upper structure",
      },
      {
        text: `Over ${pn(f.root)}, ${pn(nine)} is the 9th, ${pn(sharp11)} the ♯11, ${pn(thirteen)} the 13th.`,
        highlight: [hl(f.root, "root"), hl(nine, "9th"), hl(sharp11, "♯11"), hl(thirteen, "13th")],
        play: "after",
        prereqLink: "basics:extensions",
      },
      {
        text: `${pn(sharp11)} is the bright note: a ♯11 where a plain ${pn(f.naturalEleven)} would rub against ${pn(third)}, the 3rd.`,
        highlight: [hl(sharp11, "♯11"), hl(f.naturalEleven, "11", "down"), hl(third, "3rd", "down")],
        play: "ab",
      },
    ],
    rule: "Over a dominant 7th, hold root, 3rd and ♭7 in the left hand and play the major triad a whole step above the root.",
    deeper: `Together they're ${pn(f.root)} Lydian dominant without its 5th: the 4th mode of ${pn(f.parentMelodicMinor)} melodic minor.`,
  };
}

function flatSixFlatSeven(f: FlatSixFlatSevenLearn): Lesson {
  const [orig, bVI, bVII] = [ps(f.original), ps(f.bVI), ps(f.bVII)];
  const home = pn(f.targetRoot);
  const bass = [hl(f.bVIRoot, pn(f.bVIRoot)), hl(f.bVIIRoot, pn(f.bVIIRoot), "up"), hl(f.targetRoot, pn(f.targetRoot), "up")];
  return {
    conceptId: "modal.flatSixFlatSeven",
    headline: `Replace ${orig} with ${bVI} → ${bVII}: the bass climbs two whole steps into ${home}.`,
    steps: [
      {
        text: `${bVI} and ${bVII} are borrowed from ${minorName(f.minorKey, f.targetRoot)}: they sit on its ♭6 and ♭7.`,
        highlight: [hl(f.bVIRoot, "♭6"), hl(f.bVIIRoot, "♭7", "up"), hl(f.targetRoot, "home", "up")],
        play: "after",
        term: "borrowed",
        prereqLink: "basics:parallelMinor",
      },
      {
        // a root charted otherwise than the key's degree (E for F♭) gets its twin, so each whole step reads as one
        text: `The bass climbs by whole steps: ${twin(f.bVIRoot, f.bVIDegree)} to ${twin(f.bVIIRoot, f.bVIIDegree)} to ${home}.`,
        highlight: bass,
        play: "after",
        ask: { kind: "tapNotes", prompt: `Tap the bass line into ${home}.`, answer: [f.bVIRoot, f.bVIIRoot, f.targetRoot] },
      },
      {
        text: `${bVII} has no ${pn(f.leadingTone)}: nothing leans up into ${home}. Its 9th is ${twin(f.bVIINinth, f.targetRoot)}, already home.`,
        highlight: [hl(f.leadingTone, "missing"), hl(f.bVIINinth, "9th")],
        play: "ab",
      },
      {
        text: "You hear a lift by whole steps, not a half-step pull: a phrase-ending sound.",
        highlight: bass,
        play: "ab",
      },
    ],
    rule: "Before a major I, play the major chords on ♭6 and ♭7 and let the bass climb by whole steps into I.",
    deeper: `${bVII} is the backdoor's ♭VII with ${pn(f.bVIISixth)} in place of ${pn(f.backdoorSeventh)}: same root, no tritone.`,
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
  "dominant.mediantDominant": mediantDominant,
  "gospel.halfStepTurnaround": gospelTurnaround,
  "chromatic.passingDiminished": passingDiminished,
  "chromatic.commonToneDiminished": commonToneDiminished,
  "chromatic.minorLineCliche": minorLineCliche,
  "voicing.rootlessTwoFiveOne": rootlessTwoFiveOne,
  "voicing.upperStructureBVI": upperStructureBVI,
  "voicing.upperStructureII": upperStructureII,
  "modal.flatSixFlatSeven": flatSixFlatSeven,
} as const satisfies Record<string, (f: never) => Lesson>;
