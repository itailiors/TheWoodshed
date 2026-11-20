import { chordTones, guideTones, symbol, type ChordTone } from "./chords";
import { canonicalDrill } from "./learn/canonical";
import { classifyNote } from "./melody";
import { chroma, mod, prettyNote, prettySymbol, spellChroma } from "./pitch";
import { sortedHarmony } from "./time";
import type { ChordEvent, ReharmMove, Tune } from "./types";
import { voiceChord, voiceProgression, type Voicing } from "./voicing";

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

function buildStepCue(move: ReharmMove, c: ChordEvent, i: number, chords: ChordEvent[], resolution: boolean, target?: ChordEvent): StepCue {
  const sym = prettySymbol(symbol(c));
  const nextSym = chords[i + 1] ? prettySymbol(symbol(chords[i + 1])) : undefined;
  const orig0 = move.original[0] ? prettySymbol(symbol(move.original[0])) : undefined;
  const gts = guideTones(c).map((g) => prettyNote(g.note)).join(" & ");

  if (resolution) {
    if (move.ruleId === "voicing.rootlessTwoFiveOne" && move.voicingHints?.[i]) {
      const h = move.voicingHints[i];
      return {
        role: `Type A resolution (${sym})`,
        whyHere: `Resolve into the 3–5–7–9 rootless grip (${[...h.lh, ...h.rh].map(prettyNote).join("–")}) on ${sym}.`,
      };
    }
    return {
      role: `Resolution (${sym})`,
      whyHere: `Land smoothly by resolving the guide tones by step into ${sym} (${gts}).`,
    };
  }

  switch (move.ruleId) {
    case "dominant.tritoneSub":
      return {
        role: `Tritone sub (♭II7 · ${sym})`,
        whyHere: `Shares the exact 3rd & ♭7 tritone (${gts}) with ${orig0 ?? "the V7"}, while the bass ${prettyNote(c.root)} slides down a half step${nextSym ? ` into ${nextSym}` : ""}.`,
      };
    case "functional.secondaryTwoFive":
      if (i === 0) {
        return {
          // the related ii goes in front of an existing V7; the full ii–V brings its own
          role: `${move.facts.related ? "Related ii" : "ii"} (${sym})`,
          whyHere: `Sets up the dominant a 5th below (${nextSym ?? "V7"}); lock in guide tones ${gts}.`,
        };
      }
      return {
        role: `Secondary V7 (${sym})`,
        whyHere: `The 7th of ${prettySymbol(symbol(chords[0]))} drops a half step to become the 3rd of ${sym} (${gts}), pulling into ${nextSym ?? "the target"}.`,
      };
    case "functional.secondaryDominant": {
      const raised = move.facts.raised as string[] | undefined;
      const lowered = move.facts.lowered as string[] | undefined;
      const change = raised
        ? `raise ${prettyNote(raised[0])} to ${prettyNote(raised[1])}`
        : lowered
          ? `drop ${prettyNote(lowered[0])} to ${prettyNote(lowered[1])}`
          : "play it as a dominant";
      return {
        role: `Secondary V7 (${sym})`,
        whyHere: `Same root as ${orig0 ?? "before"}: ${change}. That ${prettyNote(String(move.facts.leadingTone))} is the leading tone into ${nextSym ?? (move.targetSymbol ? prettySymbol(move.targetSymbol) : "the target")}.`,
      };
    }
    case "dominant.mediantDominant": {
      const dim = (move.facts.sharedDiminished as string[] | undefined) ?? [];
      return {
        role: `Mediant dominant (III7 · ${sym})`,
        whyHere: `Hands on the ${dim.map(prettyNote).join("–")} diminished 7th, the same shape as ${orig0 ? `${orig0}(♭9)` : "the V7(♭9)"}; only the bass moves to ${prettyNote(c.root)}. Its 3rd then falls a half step${nextSym ? ` into ${nextSym}` : ""}.`,
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
          ? `LH holds the ${move.voicingHint.lh.map(prettyNote).join("–")} shell; RH stacks a ${prettyNote(move.voicingHint.rh[0])} major triad (${move.voicingHint.rh.map(prettyNote).join("–")}) for ♭13, 1, and ♯9.`
          : `Stack the ♭VI major triad in RH over the root–♭7–3 shell in LH.`,
      };
    case "voicing.upperStructureII":
      return {
        role: `Upper-structure II (${sym})`,
        whyHere: move.voicingHint
          ? `LH holds the ${move.voicingHint.lh.map(prettyNote).join("–")} shell; RH plays a ${prettyNote(move.voicingHint.rh[0])} major triad (${move.voicingHint.rh.map(prettyNote).join("–")}) for 9, ♯11, and 13.`
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
    case "modal.backdoorTwoFive":
      if (i === 0 && move.chords.length > 1) {
        return {
          role: `Borrowed iv (${sym})`,
          whyHere: `Minor iv borrowed from the parallel minor; prepares the ♭VII7 backdoor dominant (${nextSym ?? "♭VII7"}).`,
        };
      }
      return {
        role: `Backdoor ♭VII7 (${sym})`,
        whyHere: `Whole step below ${nextSym ?? "I"}; its ♭7 falls a half step to the 5th of the tonic while the root steps up a whole tone.`,
      };
    default:
      return {
        role: move.chords.length > 1 ? `${move.title} (${i + 1} of ${move.chords.length})` : move.title,
        whyHere: `Voice-lead guide tones (${gts}) smoothly${nextSym ? ` toward ${nextSym}` : ""}.`,
      };
  }
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
      stepCue: buildStepCue(move, c, i, chords, resolution, target),
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
