import { chordTones, guideTones, symbol, type ChordTone } from "./chords";
import { canonicalDrill } from "./learn/canonical";
import type { BackdoorLearn, BorrowedIvLearn, SecondaryDominantLearn, SecondaryTwoFiveLearn, TritoneSubLearn } from "./learn/facts";
import { degreeWord as lessonDegree, motionVerb, readable, twin } from "./learn/lesson";
import { classifyNote } from "./melody";
import { chroma, mod, prettyNote, prettySymbol, spellChroma } from "./pitch";
import { sortedHarmony } from "./time";
import type { ChordEvent, ReharmMove, Tune, VoiceMotion } from "./types";
import { voiceChord, type Voicing } from "./voicing";

export interface StepCue {
  /** Short functional role badge, e.g. "Tritone sub (♭II7)" or "Resolution target". */
  role: string;
  /** Voice-leading / harmonic reason for this specific step in the active key. */
  whyHere: string;
}

/** One chord the player has to strike, with the engine's reference voicing. */
export interface DrillStep {
  chord: ChordEvent;
  symbol: string;
  target: Voicing;
  /** The notes that make the chord what it is: 3rd (or sus 4th) and 7th. */
  required: ChordTone[];
  /** Alterations and extensions that are in the reference voicing. */
  colors: ChordTone[];
  /** True for the chord the move resolves into (not part of the move itself). */
  resolution: boolean;
  /** Pre-strike functional role and voice-leading cue for this step. */
  stepCue: StepCue;
}

/*
 * Step cues are said BEFORE the strike, so `whyHere` names only notes of the chord in your hands
 * (its tones or the reference voicing); other chords are named by symbol. Every note comes from
 * the engine: a lessoned rule's `facts.learn`, the move's other facts, or `guideTones()`. ≤ 25
 * words, display spelling, the lessons' house voice. `practice.test.ts` holds all of it in 12 keys,
 * and checks that no rule falls through to the generic cue at the bottom of the switch.
 */

/** Display spelling a reader can take in: B♭♭ shows as A (lesson.ts `readable`). */
const nn = (n: string) => prettyNote(readable(n));

/** "rises a half step to the 3rd", "holds as the 7th". */
const toDegree = (m: VoiceMotion) => `${motionVerb(m)} ${m.semitones === 0 ? "as" : "to"} the ${lessonDegree(m.toDegree)}`;

function buildStepCue(move: ReharmMove, c: ChordEvent, i: number, chords: ChordEvent[], resolution: boolean): StepCue {
  const sym = prettySymbol(symbol(c));
  const nextSym = chords[i + 1] ? prettySymbol(symbol(chords[i + 1])) : undefined;
  const into = nextSym ? ` into ${nextSym}` : "";
  const orig0 = move.original[0] ? prettySymbol(symbol(move.original[0])) : undefined;
  const [g3, g7] = guideTones(c).map((g) => nn(g.note));
  const gts = [g3, g7].filter(Boolean).join(" and ");
  const last = i === move.chords.length - 1;
  const facts = move.facts;
  const learn = facts.learn;

  if (resolution) {
    if (move.ruleId === "voicing.rootlessTwoFiveOne" && move.voicingHints?.[i]) {
      const h = move.voicingHints[i];
      return {
        role: `Type A resolution (${sym})`,
        whyHere: `Resolve into the 3–5–7–9 rootless grip (${[...h.lh, ...h.rh].map(nn).join("–")}) on ${sym}.`,
      };
    }
    return {
      role: `Resolution (${sym})`,
      whyHere: `Land on ${sym}: its guide tones, ${gts}, sit a step or less from where your hand is.`,
    };
  }

  switch (move.ruleId) {
    case "dominant.tritoneSub": {
      const L = learn as TritoneSubLearn | undefined;
      if (!L) break;
      const [o3, o7] = L.guideTones;
      const [s3, s7] = L.subGuideTones;
      return {
        role: `Tritone sub (♭II7 · ${sym})`,
        whyHere: `${prettySymbol(L.original)}'s guide tones stay: ${twin(s3, o7)} is ${sym}'s 3rd, ${twin(s7, o3)} its 7th. The bass slides down a half step${into}.`,
      };
    }
    case "functional.secondaryTwoFive": {
      const L = learn as SecondaryTwoFiveLearn | undefined;
      if (!L) break;
      const [s7toV, s7toT] = L.iiSeventh.motions;
      const [s3toV, s3toT] = L.iiThird.motions;
      if (i === 0) {
        return {
          // the related ii goes in front of an existing V7; the full ii–V brings its own
          role: `${L.related ? "Related ii" : "ii"} (${sym})`,
          whyHere: `${sym} sets up ${prettySymbol(L.V)}: its 7th, ${nn(L.iiSeventh.from)}, ${toDegree(s7toV)}; its 3rd, ${nn(L.iiThird.from)}, ${toDegree(s3toV)}.`,
        };
      }
      const flatNine = c.alterations.includes("b9") ? `; the ♭9, ${nn(L.flatNine[0])}, falls too` : "";
      return {
        role: `Secondary V7 (${sym})`,
        whyHere:
          `Into ${prettySymbol(L.target)}: the ${lessonDegree(s7toV.toDegree)}, ${nn(s7toT.from)}, ${motionVerb(s7toT)}; ` +
          `the ${lessonDegree(s3toV.toDegree)}, ${nn(s3toT.from)}, ${motionVerb(s3toT)}${flatNine}.`,
      };
    }
    case "functional.secondaryDominant": {
      const L = learn as SecondaryDominantLearn | undefined;
      if (!L) break;
      const changes = [
        L.raised && `raise its 3rd to ${nn(L.third)}`,
        L.seventhChange === "lowered" && `flatten its 7th to ${nn(L.seventh)}`,
        L.seventhChange === "added" && `add the ♭7, ${nn(L.seventh)}`,
      ].filter(Boolean);
      const lean = L.raised ? `${nn(L.third)} now rises` : `its 3rd, ${nn(L.third)}, rises`;
      const flatNine = L.flatNine && c.alterations.includes("b9") ? ` The ♭9, ${nn(L.flatNine)}, falls into it.` : "";
      return {
        role: `Secondary V7 (${sym})`,
        whyHere: `Keep ${prettySymbol(L.original)}'s root${changes.length ? `, ${changes.join(", ")}` : ""}: ${lean} a half step into ${prettySymbol(L.target)}.${flatNine}`,
      };
    }
    case "dominant.mediantDominant": {
      const dim = (facts.sharedDiminished as string[] | undefined) ?? [];
      return {
        role: `Mediant dominant (III7 · ${sym})`,
        whyHere: `Keep the ${dim.map(nn).join("–")} °7 of ${orig0 ? `${orig0}(♭9)` : "the V7(♭9)"} in your hands; only the bass moves, to ${nn(c.root)}. Its 3rd falls a half step${into}.`,
      };
    }
    case "voicing.rootlessTwoFiveOne": {
      const h = move.voicingHints?.[i];
      if (i === 0) {
        return {
          role: `Type A rootless ii (${sym})`,
          whyHere: h
            ? `Stack ♭3–5–♭7–9 (${[...h.lh, ...h.rh].map(prettyNote).join("–")}) with no root in the bass.`
            : `Stack ♭3–5–♭7–9 in close rootless position.`,
        };
      }
      return {
        role: `Type B rootless V (${sym})`,
        whyHere: h
          ? `Hold common tones and drop the ♭7 of ii a half step to the 3rd of V for ♭7–9–3–13 (${[...h.lh, ...h.rh].map(prettyNote).join("–")}).`
          : `Drop only the ♭7 of ii a half step to form the ♭7–9–3–13 Type B grip.`,
      };
    }
    case "voicing.upperStructureBVI":
      return {
        role: `Upper-structure ♭VI (${sym})`,
        whyHere: move.voicingHint
          ? `LH holds the ${move.voicingHint.lh.map(nn).join("–")} shell; RH stacks the ${nn(move.voicingHint.rh[0])} major triad (${move.voicingHint.rh.map(nn).join("–")}) for ♭13, 1, and ♯9.`
          : `Stack the ♭VI major triad in RH over the root–♭7–3 shell in LH.`,
      };
    case "voicing.upperStructureII":
      return {
        role: `Upper-structure II (${sym})`,
        whyHere: move.voicingHint
          ? `LH holds the ${move.voicingHint.lh.map(nn).join("–")} shell; RH plays the ${nn(move.voicingHint.rh[0])} major triad (${move.voicingHint.rh.map(nn).join("–")}) for 9, ♯11, and 13.`
          : `Stack the II major triad in RH over the root–3–♭7 shell in LH.`,
      };
    case "chromatic.minorLineCliche": {
      const degs = ["1 (root)", "♮7 (major 7th)", "♭7 (minor 7th)", "6 (sixth)"];
      return {
        role: `Line cliché step ${i + 1} (${sym})`,
        whyHere: `Keep the ${prettyNote(c.root)} minor triad anchored while the moving voice steps to ${degs[i] ?? "the next degree"}.`,
      };
    }
    case "melody.oneNoteOnTop": {
      const held = String(move.facts.heldNote ?? "");
      if (i === 0) {
        return {
          role: `Pin the top (${sym})`,
          whyHere: `Put ${prettyNote(held)} on top with your 5th finger and keep it there; only the bass and inner voices move from here.`,
        };
      }
      const roles = (move.facts.roles as string[] | undefined) ?? [];
      return {
        role: `Bass walks: ${sym}`,
        whyHere: `${prettyNote(held)} stays on top as the ${roles[i - 1] ?? "colour"} of ${sym}, while the bass steps down a half step${nextSym ? ` toward ${nextSym}` : ""}.`,
      };
    }
    case "gospel.halfStepTurnaround":
      if (i === 0) {
        return {
          role: `IV/V gospel sus (${sym})`,
          whyHere: `Suspends the leading tone by stacking a major triad a whole step below the dominant root before the chromatic approach.`,
        };
      }
      return {
        role: `♭II13(♯11) approach (${sym})`,
        whyHere: `Tritone-sub cluster a half step above ${nextSym ?? "home"}; every upper voice slides down by semitone or holds common tones.`,
      };
    case "modal.backdoorTwoFive": {
      const L = learn as BackdoorLearn | undefined;
      if (!L) break;
      if (i === 0 && L.iv) {
        return {
          role: `Borrowed iv (${sym})`,
          whyHere: `Borrowed from ${nn(L.targetRoot)} minor, ${sym} is the ii of ${prettySymbol(L.bVII)}: the backdoor's own ii–V.`,
        };
      }
      return {
        role: `Backdoor ♭VII7 (${sym})`,
        whyHere: `${sym}'s ${nn(L.bVIISeventh)} falls a half step into ${prettySymbol(L.target)}; its root, ${nn(L.bVIIRoot)}, climbs a whole step. The 9th, ${nn(L.bVIINinth)}, is home already.`,
      };
    }
    case "chromatic.passingDiminished": {
      const target = String(facts.target);
      const ascending = facts.ascending === true;
      if (c.quality !== "dim7") {
        return {
          role: `Before the °7 (${sym})`,
          whyHere: `${sym} keeps the downbeat. Then the bass, ${nn(c.root)}, ${ascending ? "climbs" : "falls"} a half step${into}.`,
        };
      }
      return {
        role: `Passing °7 (${sym})`,
        whyHere: ascending
          ? `${nn(c.root)} in the bass is the leading tone of ${target}: ${sym} works as its V7(♭9) with no root.`
          : `The bass, ${nn(c.root)}, falls a half step into ${target}; the symmetrical °7 lets the upper voices slip in by step.`,
      };
    }
    case "modal.flatSixFlatSeven": {
      const [, , home] = (facts.bassLine as string[] | undefined) ?? [];
      const target = String(facts.target);
      if (i === 0) {
        return {
          role: `♭VI, borrowed (${sym})`,
          whyHere: `Borrowed from ${home ? nn(home) : "the parallel"} minor: the bass, ${nn(c.root)}, starts a climb by whole steps into ${target}.`,
        };
      }
      return {
        role: `♭VII, borrowed (${sym})`,
        whyHere: `The bass, ${nn(c.root)}, climbs another whole step into ${target}. No dominant, no tritone: the rising roots carry the cadence.`,
      };
    }
    case "modal.borrowedIv": {
      const L = learn as BorrowedIvLearn | undefined;
      if (!L) break;
      const [six, flatSix] = L.line;
      if (!last) {
        return {
          role: `IV, about to turn minor (${sym})`,
          whyHere: `${sym} keeps its 3rd, ${nn(six)}, for now. Next that note drops a half step and the chord turns minor.`,
        };
      }
      return {
        role: `Borrowed iv (${sym})`,
        whyHere: `Borrowed from ${nn(L.targetRoot)} minor: the 3rd is now ${nn(flatSix)}, and it falls ${L.kept ? "another" : "a"} half step to ${prettySymbol(L.target)}'s 5th.`,
      };
    }
    case "chromatic.commonToneDiminished": {
      const lean = (facts.leaningTones as string[] | undefined) ?? [];
      const land = (facts.resolvesTo as string[] | undefined) ?? [];
      const chord = String(facts.chord);
      if (c.quality === "dim7") {
        return {
          role: `Common-tone °7 (${sym})`,
          whyHere: `Keep ${nn(c.root)} as the common tone. ${lean.map(nn).join(" and ")} are appoggiaturas: each leans up a half step into ${chord}.`,
        };
      }
      return {
        role: `Arrival (${sym})`,
        whyHere: `${land.map(nn).join(" and ")}, the 3rd and 5th, arrive: the °7 dissolves into the chord you were already on.`,
      };
    }
    case "symmetric.coltraneSubstitution": {
      const target = String(facts.target);
      if (i === 0) {
        const [centre1, centre2] = [chords[2], chords[4]].map((x) => (x ? prettySymbol(symbol(x)) : "?"));
        return {
          role: `ii, the tour starts (${sym})`,
          whyHere: `${sym} starts a tour of three keys a major 3rd apart: ${centre1}, ${centre2}, then ${target}.`,
        };
      }
      if (c.quality === "7") {
        return {
          role: `V7 of ${nextSym ?? target} (${sym})`,
          whyHere: `${sym} ${last ? "is the real V7 of" : "tonicizes"} ${nextSym ?? target}: its 3rd, ${g3}, rises a half step; its 7th, ${g7}, falls a half step.`,
        };
      }
      const n = i === 2 ? 1 : 2;
      return {
        role: `Key centre ${n} of 3 (${sym})`,
        whyHere: `${sym} is key centre ${n} of 3, a major 3rd above the next one. Land on its 3rd, ${g3}, and 7th, ${g7}.`,
      };
    }
    case "chromatic.constantStructure": {
      const target = String(facts.target);
      const planed = ((facts.planedRoots as string[] | undefined)?.length ?? 2) - 1;
      const above = (half: number) => (half === 2 ? "a whole step" : half === 1 ? "a half step" : `${half} half steps`);
      if (i === 0) {
        return {
          role: `Downbeat (${sym})`,
          whyHere: `${sym} keeps the downbeat. Then take ${target}'s exact shape ${above(planed)} above and slide the whole hand down.`,
        };
      }
      return {
        role: `Planing ${i} of ${planed} (${sym})`,
        whyHere: `${sym} is ${target}'s shape ${above(planed - i + 1)} up: constant structure. Every voice slides down a half step${into}.`,
      };
    }
  }
  // Generic: only for a rule with no cue of its own yet (practice.test.ts fails if any rule lands here).
  return {
    role: move.chords.length > 1 ? `${move.title} (${i + 1} of ${move.chords.length})` : move.title,
    whyHere: `Voice-lead guide tones (${gts}) smoothly${nextSym ? ` toward ${nextSym}` : ""}.`,
  };
}

/** Turn a hint like {lh:[G,F,B], rh:[Eb,G,Bb]} into MIDI: LH from the bass register up, RH stacked above. */
export function hintToVoicing(hint: { lh: string[]; rh: string[] }): Voicing {
  const up = (names: string[], floor: number) => {
    let prev = floor - 1;
    return names.map((n) => {
      const c = chroma(n);
      const m = prev + 1 + mod(c - (prev + 1), 12);
      prev = m;
      return m;
    });
  };
  const lh = up(hint.lh, 38);
  const rh = up(hint.rh, Math.max(lh[lh.length - 1] + 1, 55));
  return { bass: lh[0], upper: [...lh.slice(1), ...rh] };
}

/** The progression a move asks you to play: its chords plus the chord it resolves into. */
export function drillSteps(tune: Tune, move: ReharmMove): DrillStep[] {
  const all = sortedHarmony(tune);
  const before = all.filter((c) => c.at.bar < move.span.from.bar || (c.at.bar === move.span.from.bar && c.at.beat < move.span.from.beat)).pop();
  const target = all.find((c) => c.at.bar === move.span.to.bar && c.at.beat === move.span.to.beat);
  const chords = [...move.chords, ...(target ? [target] : [])];
  const seed = before ? voiceChord(before) : undefined;
  const voicings: Voicing[] = [];
  chords.forEach((c, i) => {
    const prev = voicings[i - 1] ?? seed;
    const stepHint = move.voicingHints?.[i] ?? (i === 0 ? move.voicingHint : undefined);
    voicings.push(stepHint ? hintToVoicing(stepHint) : voiceChord(c, prev));
  });
  return chords.map((c, i) => {
    const tones = chordTones(c);
    const upperPcs = new Set(voicings[i].upper.map((m) => mod(m, 12)));
    const resolution = !!target && i === chords.length - 1;
    return {
      chord: c,
      symbol: symbol(c),
      target: voicings[i],
      required: guideTones(c),
      colors: tones.filter((t) => !["1", "3", "b3", "4", "5", "b7", "7", "bb7", "6"].includes(t.degree) && upperPcs.has(chroma(t.note))),
      resolution,
      stepCue: buildStepCue(move, c, i, chords, resolution),
    };
  });
}

export type ConceptDrillResult = DrillStep[] & {
  /** The canonical chart; null for an unknown rule. */
  tune: Tune | null;
  /** The rule's own move on it; null (and no steps) when it doesn't fire, never another rule's move. */
  move: ReharmMove | null;
  steps: DrillStep[];
};

/**
 * The rule's canonical progression (`CANONICAL_PROGRESSIONS`, shared with the Learn stage) in
 * `targetKey`, and its `DrillStep[]` (also carrying `.tune`, `.move`, and `.steps`).
 */
export function conceptDrillSteps(ruleId: string, targetKey: string): ConceptDrillResult {
  const drill = canonicalDrill(ruleId, targetKey);
  const move = drill?.move && drill.move.ruleId === ruleId ? drill.move : null;
  const steps = drill && move ? drillSteps(drill.tune, move) : [];
  return Object.assign(steps, { tune: drill?.tune ?? null, move, steps });
}

export interface ToneCheck {
  degree: string;
  note: string;
  present: boolean;
  /** Where that note sits in the reference voicing (where the red pen should circle). */
  targetMidi: number;
}

export interface WrongNote {
  midi: number;
  name: string;
  why: string;
}

export interface StrikeDiff {
  played: number[];
  bass: { expected: string; played: string | null; ok: boolean; rootless: boolean };
  guideTones: ToneCheck[];
  colors: ToneCheck[];
  wrongNotes: WrongNote[];
  /** Same pitch classes as the reference voicing (octaves may differ). */
  matchesTarget: boolean;
  verdict: "perfect" | "correct" | "incomplete" | "wrong";
  comments: string[];
}

const BASS_SPLIT = 55; // notes below G3 count as left-hand bass

const degreeWord = (d: string) =>
  ({ "3": "3rd", b3: "♭3rd", "4": "sus 4th", "7": "maj 7th", b7: "♭7th", bb7: "°7th", "6": "6th" })[d] ?? prettyNote(d);

function nearestInVoicing(target: Voicing, pc: number): number {
  const all = [target.bass, ...target.upper];
  return all.find((m) => mod(m, 12) === pc) ?? target.upper[0] + mod(pc - target.upper[0], 12);
}

/**
 * Compare a struck chord (MIDI notes) with a drill step. Pitch classes are what
 * count: any inversion of the right notes is "correct", and the exact reference
 * voicing is "perfect". Rootless voicings are accepted.
 */
export function diffStrike(playedRaw: number[], step: DrillStep): StrikeDiff {
  const played = [...new Set(playedRaw)].sort((a, b) => a - b);
  const pcs = new Set(played.map((m) => mod(m, 12)));
  const chord = step.chord;
  const bassName = chord.bass ?? chord.root;
  const tones = chordTones(chord);
  const spell = (m: number) => tones.find((t) => chroma(t.note) === mod(m, 12))?.note ?? spellChroma(m);

  const lowest = played[0];
  const hasBass = lowest !== undefined && (lowest < BASS_SPLIT || played.length >= 2);
  const bassOk = lowest !== undefined && mod(lowest, 12) === chroma(bassName);
  const rootless = !bassOk && lowest !== undefined && tones.some((t) => chroma(t.note) === mod(lowest, 12));

  const check = (t: ChordTone): ToneCheck => ({
    degree: t.degree,
    note: t.note,
    present: pcs.has(chroma(t.note)),
    targetMidi: nearestInVoicing(step.target, chroma(t.note)),
  });
  const guide = step.required.map(check);
  const colors = step.colors.map(check);

  // anything outside the chord, its reference colours and the usual 9/13 is a wrong note
  const allowed = new Set([
    ...tones.map((t) => chroma(t.note)),
    ...[step.target.bass, ...step.target.upper].map((m) => mod(m, 12)),
  ]);
  const wrongNotes: WrongNote[] = played
    .filter((m) => !allowed.has(mod(m, 12)))
    .map((m) => {
      const name = spellChroma(m);
      const cls = classifyNote({ ...chord, display: undefined }, name);
      const why =
        cls.verdict === "avoid"
          ? `${prettyNote(name)} is an avoid note here (${prettyNote(cls.role)})`
          : `${prettyNote(name)} isn't in ${prettyNote(step.symbol)}`;
      return { midi: m, name, why };
    });

  const targetPcs = new Set([step.target.bass, ...step.target.upper].map((m) => mod(m, 12)));
  const upperPcs = new Set(played.filter((m) => m !== lowest || !hasBass).map((m) => mod(m, 12)));
  const matchesTarget =
    [...targetPcs].every((c) => pcs.has(c)) && [...pcs].every((c) => targetPcs.has(c)) && step.target.upper.every((m) => upperPcs.has(mod(m, 12)));

  const missingGuide = guide.filter((g) => !g.present);
  const comments: string[] = [];
  for (const g of missingGuide) comments.push(`Missing the ${degreeWord(g.degree)} (${prettyNote(g.note)}). That's what makes it ${prettyNote(step.symbol)}.`);
  for (const w of wrongNotes) comments.push(w.why);
  const missingColors = colors.filter((c) => !c.present);
  if (!missingGuide.length && !wrongNotes.length && missingColors.length) {
    comments.push(`Right chord. Add the ${missingColors.map((c) => prettyNote(c.degree)).join(" and ")} for the full colour.`);
  }
  if (rootless && !missingGuide.length) comments.push("Rootless voicing. Fine, the bass player has the root.");

  const verdict: StrikeDiff["verdict"] = wrongNotes.length
    ? "wrong"
    : missingGuide.length
      ? "incomplete"
      : matchesTarget && (bassOk || rootless)
        ? "perfect"
        : "correct";

  return {
    played,
    bass: { expected: bassName, played: lowest !== undefined ? spell(lowest) : null, ok: bassOk, rootless },
    guideTones: guide,
    colors,
    wrongNotes,
    matchesTarget,
    verdict,
    comments,
  };
}

export interface VoiceLeadingDiff {
  /** Semitone moves of your upper voices, paired bottom-to-top. */
  moves: number[];
  maxLeap: number;
  total: number;
  /** Total movement of the engine's reference voicings for the same change. */
  ideal: number;
  smooth: boolean;
  comment: string;
}

/** How smoothly did the right hand move between two strikes? */
export function diffVoiceLeading(prevPlayed: number[], played: number[], prevStep: DrillStep, step: DrillStep): VoiceLeadingDiff {
  const upper = (ns: number[]) => {
    const s = [...ns].sort((a, b) => a - b);
    return s.length > 1 && s[0] < BASS_SPLIT ? s.slice(1) : s;
  };
  const a = upper(prevPlayed);
  const b = upper(played);
  const moves = b.map((n) => {
    const nearest = a.reduce((best, m) => (Math.abs(m - n) < Math.abs(best - n) ? m : best), a[0] ?? n);
    return n - nearest;
  });
  const maxLeap = Math.max(0, ...moves.map(Math.abs));
  const total = moves.reduce((s, m) => s + Math.abs(m), 0);
  const ideal = step.target.upper.reduce(
    (s, n) => s + Math.min(...prevStep.target.upper.map((m) => Math.abs(m - n))),
    0,
  );
  const smooth = maxLeap <= 2;
  const comment = smooth
    ? `Smooth: no voice moved more than ${maxLeap} semitone${maxLeap === 1 ? "" : "s"}.`
    : `One voice jumped ${maxLeap} semitones. Look for a closer inversion (the engine's moves ${ideal} semitones in total).`;
  return { moves, maxLeap, total, ideal, smooth, comment };
}
