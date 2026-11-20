import type { BackdoorLearn, BorrowedIvLearn, SecondaryDominantLearn, SecondaryTwoFiveLearn, TritoneSubLearn } from "../facts";
import { degreeWord, hl, moves, pn, ps, twin, type Lesson } from "../lesson";

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
        highlight: [hl(f.originalRoot, pn(f.originalRoot)), hl(f.subRoot, pn(f.subRoot))],
        play: "interval",
        term: "tritone",
        prereqLink: "basics:tritone",
      },
      {
        text: `Go up a tritone from ${pn(f.originalRoot)}, the V of ${pn(f.targetRoot)}, and you land on ${pn(f.subRoot)}: the ♭II.`,
        highlight: [hl(f.originalRoot, "V"), hl(f.subRoot, "♭II")],
      },
      {
        text: `${orig}'s guide tones: ${pn(o3)} and ${pn(o7)}. ${sub} swaps them: ${twin(s3, o7)} is its 3rd, ${twin(s7, o3)} its 7th.`,
        highlight: [hl(o3, `3rd → ${pn(s7)} 7th`), hl(o7, `7th → ${pn(s3)} 3rd`)],
        ask: { kind: "tapNotes", prompt: `Tap the two keys ${orig} and ${sub} share.`, answer: [o3, o7] },
        prereqLink: "basics:guideTones",
      },
      {
        text: `Both pull the same way: ${moves(r3)}, ${moves(r7)}. That's the resolution into ${target}.`,
        highlight: [hl(r3.from, "↑"), hl(r3.to, pn(r3.to)), hl(r7.from, "↓"), hl(r7.to, pn(r7.to))],
        play: "ab",
        prereqLink: "basics:dominantResolution",
      },
      {
        text: `What changes is the bass: ${pn(f.subRoot)} slides down a half step to ${pn(f.targetRoot)}, not ${pn(f.originalRoot)} falling a fifth.`,
        highlight: [hl(f.subRoot, "new bass"), hl(f.targetRoot, "home"), hl(f.originalRoot, "old bass")],
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
    ? { text: `Raise its 3rd: ${pn(f.raised[0])} becomes ${pn(f.raised[1])}, the leading tone of ${pn(f.targetRoot)}.`, highlight: [hl(f.raised[0], "♭3"), hl(f.raised[1], "3rd"), hl(f.targetRoot, "target")] }
    : { text: `Its 3rd, ${pn(f.third)}, is already the leading tone of ${pn(f.targetRoot)}.`, highlight: [hl(f.third, "3rd"), hl(f.targetRoot, "target")] };
  const seventh =
    f.seventhChange === "lowered" && f.lowered
      ? { text: `Flatten its 7th: ${pn(f.lowered[0])} drops to ${pn(f.lowered[1])}. Now it's ${dom}.`, highlight: [hl(f.lowered[0], "7"), hl(f.lowered[1], "♭7")] }
      : f.seventhChange === "kept"
        ? { text: `Its ♭7, ${pn(f.seventh)}, stays, and ${pn(f.third)} makes it ${dom}.`, highlight: [hl(f.seventh, "♭7"), hl(f.third, "3rd")] }
        : { text: `Add the ♭7, ${pn(f.seventh)}, over ${pn(f.root)}. Now it's ${dom}.`, highlight: [hl(f.root, "root"), hl(f.seventh, "♭7")] };
  return {
    conceptId: "functional.secondaryDominant",
    headline: `Play ${orig} as ${dom}. Its 3rd, ${pn(f.third)}, now leans a half step up into ${target}.`,
    steps: [
      { text: `${orig} already falls a fifth to ${target}: ${pn(f.root)} down to ${pn(f.targetRoot)}.`, highlight: [hl(f.root, "root"), hl(f.targetRoot, "target")], play: "before" },
      { ...third, term: "leading tone", prereqLink: "basics:dominantResolution" },
      { ...seventh, ask: { kind: "tapNotes", prompt: `Tap the 3rd and 7th of ${dom}.`, answer: [f.third, f.seventh] } },
      {
        text: `Into ${target}, ${moves(r3)} and ${moves(r7)}.`,
        highlight: [hl(r3.from, "↑"), hl(r3.to, pn(r3.to)), hl(r7.from, r7.semitones ? "↓" : "holds"), hl(r7.to, pn(r7.to))],
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
      { text: `${V} is the V of ${target}: ${pn(f.VRoot)} falls a fifth to ${pn(f.targetRoot)}.`, highlight: [hl(f.VRoot, "V"), hl(f.targetRoot, "target")], play: "before", prereqLink: "functional.secondaryDominant" },
      {
        text:
          `${ii} is ${f.related ? `${V}'s related ii` : "the ii"}` +
          `${f.targetMinor ? `, half-diminished because ${target} is minor` : ""}: ${pn(f.iiRoot)} falls a fifth to ${pn(f.VRoot)}.`,
        highlight: [hl(f.iiRoot, "ii"), hl(f.VRoot, "V"), hl(f.targetRoot, "target")],
        ...(f.related ? { term: "related ii" } : f.targetMinor ? { term: "half-diminished" } : {}),
      },
      {
        text: `${ii}'s 7th: ${moves(s7toV)}, ${V}'s ${degreeWord(s7toV.toDegree)}. Its 3rd: ${moves(s3toV)}, ${V}'s ${degreeWord(s3toV.toDegree)}.`,
        highlight: [hl(f.iiSeventh.from, "7th"), hl(s7toV.to, degreeWord(s7toV.toDegree)), hl(f.iiThird.from, "3rd")],
        ask: { kind: "tapNotes", prompt: `Which key of ${ii} stays for ${V}? Tap it.`, answer: [s3toV.semitones === 0 ? s3toV.to : s7toV.to] },
        prereqLink: "basics:twoFiveOne",
      },
      {
        text: `Into ${target}, ${moves(s7toT)} and ${moves(s3toT)}.`,
        highlight: [hl(s7toT.from, pn(s7toT.from)), hl(s7toT.to, pn(s7toT.to)), hl(s3toT.from, pn(s3toT.from)), hl(s3toT.to, pn(s3toT.to))],
        play: "after",
      },
      ...(f.related ? [] : [{ text: `The trade: ${orig}'s colour goes, and ${pn(f.VRoot)} to ${pn(f.targetRoot)} makes a stronger arrival on ${target}.`, highlight: [hl(f.VRoot, "V"), hl(f.targetRoot, "target")], play: "ab" as const }]),
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
      { text: `${iv} is borrowed from ${pn(f.targetRoot)} minor: ${pn(f.root)}'s chord with ${pn(flatSix)} for its 3rd.`, highlight: [hl(f.root, "root"), hl(flatSix, "♭3")], term: "borrowed", prereqLink: "basics:parallelMinor" },
      {
        text: `Its only change is the 3rd: ${pn(six)} drops a half step to ${pn(flatSix)}.`,
        highlight: [hl(six, "3rd"), hl(flatSix, "♭3")],
        play: "ab",
        ask: { kind: "tapNotes", prompt: `Tap the one key that changes from ${IV} to ${iv}.`, answer: [flatSix] },
      },
      { text: `Then ${pn(flatSix)} falls again, to ${pn(five)}: the 5th of ${target}.`, highlight: [hl(flatSix, "♭6"), hl(five, "5th")], play: "after" },
      {
        text: `That line, ${pn(six)} → ${pn(flatSix)} → ${pn(five)}, is the minor plagal sound: bittersweet, not final.`,
        highlight: [hl(six, "6"), hl(flatSix, "♭6"), hl(five, "5")],
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
        highlight: [hl(f.bVIIRoot, "♭VII"), hl(f.targetRoot, "home")],
        term: "backdoor",
        prereqLink: f.iv ? "modal.borrowedIv" : "basics:parallelMinor",
      },
      {
        text: `${bVII} has no ${pn(f.leadingTone)}, so no leading tone pushes up into ${pn(f.targetRoot)}.`,
        highlight: [hl(f.leadingTone, "missing"), hl(f.targetRoot, "home")],
        play: "ab",
      },
      {
        text: `Its ${pn(f.bVIISeventh)} falls a half step to ${pn(f.targetFifth)}; its root ${pn(f.bVIIRoot)} climbs a whole step to ${pn(f.targetRoot)}.`,
        highlight: [hl(f.bVIISeventh, "♭7"), hl(f.targetFifth, "5th"), hl(f.bVIIRoot, "root"), hl(f.targetRoot, "home")],
        play: "after",
      },
      {
        text: `Its 9th is ${twin(f.bVIINinth, f.targetRoot)}: home is already sounding before you arrive.`,
        highlight: [hl(f.bVIINinth, "9th")],
        ask: { kind: "tapNotes", prompt: `Tap the note ${bVII} already shares with ${target}'s root.`, answer: [f.bVIINinth] },
      },
    ],
    rule: "For a major I, play the minor 7th a 4th above it, then the dominant 7th a whole step below it.",
  };
}

/** Rule lessons by rule id, each reading its rule's `facts.learn`. */
export const RULE_LESSONS = {
  "dominant.tritoneSub": tritoneSub,
  "functional.secondaryDominant": secondaryDominant,
  "functional.secondaryTwoFive": secondaryTwoFive,
  "modal.borrowedIv": borrowedIv,
  "modal.backdoorTwoFive": backdoor,
} as const satisfies Record<string, (f: never) => Lesson>;
