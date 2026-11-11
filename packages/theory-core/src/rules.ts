import {
  chordChromas,
  chordTones,
  guideTones,
  isDominant,
  isMajorQ,
  isMinorQ,
  resolvesDownFifth,
  symbol,
} from "./chords";
import { chroma, parseNote, prettyNote as pn, prettySymbol, simplifyNote, transpose } from "./pitch";
import type { ChordEvent, MoveCategory, MoveText, Quality, Tune, VoiceMotion } from "./types";
import { nearestMotion } from "./voiceLeading";

export type NewChord = Omit<ChordEvent, "id" | "at">;

export interface RuleContext {
  tune: Tune;
  index: number;
  chord: ChordEvent;
  prev?: ChordEvent;
  next?: ChordEvent;
}

export interface Proposal {
  /** How many consecutive chords (from ctx.index) the move replaces. Default 1. */
  replaceCount?: number;
  chords: NewChord[];
  title: string;
  level: 1 | 2 | 3 | 4;
  category: MoveCategory;
  styleTags: string[];
  voicingHint?: { lh: string[]; rh: string[] };
  voiceLeading?: VoiceMotion[];
  facts: Record<string, unknown>;
  text: MoveText;
}

export interface Rule {
  id: string;
  name: string;
  propose(ctx: RuleContext): Proposal | null;
}

// ── helpers ────────────────────────────────────────────────────────────
const ps = (c: Parameters<typeof symbol>[0]) => prettySymbol(symbol(c));

const tidy = (n: string) => {
  const s = parseNote(n);
  return Math.abs(s.alter) >= 2 || ["Cb", "Fb", "E#", "B#"].includes(n) ? simplifyNote(n) : n;
};

function mk(root: string, quality: Quality, beats: number, extensions: string[] = [], alterations: string[] = []): NewChord {
  return { root, quality, beats, extensions, alterations };
}

/** Split a chord's duration in two (3 beats → 2+1, 4 → 2+2). */
function splitBeats(total: number): [number, number] | null {
  if (total < 2) return null;
  if (total % 2 === 0) return [total / 2, total / 2];
  const a = Math.ceil((total * 2) / 3);
  return [a, total - a];
}

const romanName = (c: ChordEvent) => c.analysis?.roman.replace(/(maj7|m7b5|m7|m6|7|6)$/, "");

function chain(voices: string[], chords: Array<Parameters<typeof chordTones>[0]>): string {
  return voices
    .map((v) => {
      const path = [v];
      let cur = v;
      for (const c of chords) {
        cur = nearestMotion(cur, chordTones(c)).to;
        path.push(cur);
      }
      return path.map(pn).join(" → ");
    })
    .join(", ");
}

// ── Rule 1: secondary ii–V (approach) / related ii ─────────────────────
export const secondaryTwoFive: Rule = {
  id: "functional.secondaryTwoFive",
  name: "Secondary ii–V",
  propose({ chord, prev, next }) {
    if (!next) return null;
    const tMajor = isMajorQ(next.quality);
    const tMinor = isMinorQ(next.quality);
    if (!tMajor && !tMinor) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;

    const V = tidy(transpose(next.root, "5"));
    const ii = tidy(transpose(V, "5"));
    const iiChord = mk(ii, tMinor ? "m7b5" : "m7", split[0], tMinor ? [] : ["9"]);
    const vChord = mk(V, "7", split[1], [], ["b9"]);
    const alreadyV = isDominant(chord.quality) && chroma(chord.root) === chroma(V);

    if (alreadyV && prev && chroma(prev.root) === chroma(ii) && (prev.quality === "m7" || prev.quality === "m7b5")) {
      return null; // the ii is already there
    }

    const gtChain = chain(
      guideTones(iiChord).map((t) => t.note),
      [vChord, next],
    );
    const facts = { target: symbol(next), ii: symbol(iiChord), V: symbol(vChord), guideToneChain: gtChain, related: alreadyV };

    if (alreadyV) {
      return {
        title: "Add the related ii",
        level: 1,
        category: "functional",
        styleTags: ["bebop", "standard"],
        chords: [iiChord, vChord],
        facts,
        text: {
          summary: `Put the related ii in front of the dominant: ${ps(iiChord)} → ${ps(vChord)} → ${ps(next)}.`,
          theory:
            `${ps(chord)} already resolves down a 5th to ${ps(next)}. Every dominant has a "related ii", the minor chord a 5th above its root. ` +
            `Inserting it turns one chord into a full ii–V and doubles the forward motion.` +
            (tMinor ? ` The target is minor, so the ii is half-diminished (${ps(iiChord)}), borrowed from ${pn(next.root)} harmonic minor.` : "") +
            ` Guide tones: ${gtChain}.`,
          recreateRule:
            "Any dominant can borrow its related ii: the minor 7 chord a 5th above its root (m7♭5 if the target is minor).",
        },
      };
    }

    const r = romanName(next);
    return {
      title: r ? `ii–V into the ${r}` : `ii–V into ${ps(next)}`,
      level: 2,
      category: "functional",
      styleTags: ["bebop", "standard"],
      chords: [iiChord, vChord],
      facts,
      text: {
        summary: `Replace ${ps(chord)} with the target's own ii–V: ${ps(iiChord)} → ${ps(vChord)} → ${ps(next)}.`,
        theory:
          `${ps(next)}${r ? ` is the ${r} chord.` : "."} Putting its own ii–V in front briefly makes it sound like home: ` +
          `${pn(V)} is a perfect 5th above ${pn(next.root)}, and ${pn(ii)} is a 5th above that. ` +
          `The guide tones barely move: ${gtChain}. ` +
          `You give up the colour of ${ps(chord)} and get the strongest pull in tonal harmony instead: the root falls a 5th, twice.`,
        recreateRule:
          "Any major or minor chord can get its own ii–V: from the target, go up a 5th for the V and another 5th for the ii.",
      },
    };
  },
};

// ── Rule 2: tritone substitution ───────────────────────────────────────
export const tritoneSub: Rule = {
  id: "dominant.tritoneSub",
  name: "Tritone substitution",
  propose({ chord, next }) {
    if (!next || chord.quality !== "7" || !resolvesDownFifth(chord, next)) return null;
    const subRoot = simplifyNote(transpose(chord.root, "b5"));
    const sub = mk(subRoot, "7", chord.beats, ["9"]);
    const [o3, o7] = guideTones({ ...chord, alterations: [] }).map((t) => t.note);
    const [s3, s7] = guideTones(sub).map((t) => t.note);
    const mm = simplifyNote(transpose(subRoot, "5"));
    return {
      title: "Tritone sub",
      level: 2,
      category: "dominant-sub",
      styleTags: ["bebop"],
      chords: [sub],
      facts: { original: symbol(chord), sub: symbol(sub), sharedTritone: [o3, o7], parentMelodicMinor: mm },
      text: {
        summary: `Swap ${ps(chord)} for ${ps(sub)}, the dominant a tritone away.`,
        theory:
          `${ps(chord)} and ${ps(sub)} share the same tritone: ${pn(o3)}–${pn(o7)} (3rd and ♭7 of ${pn(chord.root)}7) ` +
          `are ${pn(s7)}–${pn(s3)} (♭7 and 3rd of ${pn(subRoot)}7), the same keys spelled differently. ` +
          `That interval is what makes a dominant want to resolve, so the substitute still lands on ${ps(next)}. ` +
          `The difference is the bass, which now slides down a half step (${pn(subRoot)} → ${pn(next.root)}) instead of falling a 5th.`,
        recreateRule:
          "Any dominant 7 can be replaced by the dominant 7 a tritone (♭5) away. The 3rd and ♭7 swap roles, and the bass moves by a half step.",
        insight:
          `${pn(subRoot)} Lydian dominant uses exactly the same 7 notes as ${pn(chord.root)} altered: both are modes of ${pn(mm)} melodic minor. ` +
          `Soloing over the sub is the same as playing altered over the original.`,
      },
    };
  },
};

// ── Rule 3: upper-structure triad (bVI over a dominant shell) ──────────
export const upperStructure: Rule = {
  id: "voicing.upperStructureBVI",
  name: "Upper-structure triad",
  propose({ chord, next }) {
    if (!next || chord.quality !== "7") return null;
    const altered = chord.alterations.some((a) => a === "#5" || a === "b13");
    const toMinor = isMinorQ(next.quality) || next.quality === "m7b5";
    if (!toMinor && !altered) return null;

    const newChord = mk(chord.root, "7", chord.beats, [], ["#9", "b13"]);
    const tr = tidy(transpose(chord.root, "b6"));
    const rh = [tr, transpose(tr, "3"), transpose(tr, "5")];
    const lh = [chord.root, transpose(chord.root, "b7"), transpose(chord.root, "3")];
    const targetSet = chordChromas(next);
    const common = rh.filter((n) => targetSet.has(chroma(n)));
    const commonText = common.length
      ? ` ${common.map(pn).join(" and ")} ${common.length > 1 ? "are" : "is"} already in ${ps(next)}, so the resolution is effortless.`
      : "";
    return {
      title: "Upper-structure triad",
      level: 2,
      category: "voicing",
      styleTags: ["modern", "bebop"],
      chords: [newChord],
      voicingHint: { lh, rh },
      facts: { triad: rh, shell: lh, commonTonesWithTarget: common },
      text: {
        summary: `Same chord, new voicing: a ${pn(tr)} major triad over a ${lh.map(pn).join("–")} shell gives ${ps(newChord)}.`,
        theory:
          `The left hand holds only what defines the dominant: the root, the ♭7 (${pn(lh[1])}) and the 3rd (${pn(lh[2])}). ` +
          `The right hand plays a plain ${pn(tr)} triad (${rh.map(pn).join(" ")}), which over ${pn(chord.root)} reads as ♭13, root and ♯9. ` +
          `The shape is easy and the tension is high.${commonText}`,
        recreateRule:
          "Over a dominant, play the major triad built on its ♭13 (a major 3rd below the root) above a root–♭7–3 shell. You get a 7(♯9,♭13).",
      },
    };
  },
};

// ── Rule 4: gospel turnaround (IV/V sus → half-step-above 13#11) ───────
export const gospelTurnaround: Rule = {
  id: "gospel.halfStepTurnaround",
  name: "Gospel turnaround",
  propose({ chord, next }) {
    if (!next || chord.quality !== "7" || !isMajorQ(next.quality) || !resolvesDownFifth(chord, next)) return null;
    const split = splitBeats(chord.beats);
    if (!split) return null;

    const susTop = tidy(transpose(chord.root, "b7"));
    const sus: NewChord = { ...mk(chord.root, "7sus4", split[0], ["9"]), display: `${susTop}/${chord.root}` };
    const apRoot = simplifyNote(transpose(next.root, "b2"));
    const approach = mk(apRoot, "7", split[1], ["9", "13"], ["#11"]);
    const targetRich = { ...next, extensions: ["9", "13"] };
    const targetSym = symbol({ ...next, extensions: ["9"] });
    const vl = chordTones(approach).map((t) => nearestMotion(t.note, chordTones(targetRich)));

    return {
      title: "Gospel turnaround",
      level: 3,
      category: "gospel",
      styleTags: ["gospel", "neo-soul"],
      chords: [sus, approach],
      voiceLeading: vl,
      facts: { sus: sus.display, approach: symbol(approach), target: targetSym, motions: vl },
      text: {
        summary: `${ps(chord)} → ${ps(next)} becomes ${prettySymbol(sus.display!)} → ${ps(approach)} → ${prettySymbol(targetSym)}.`,
        theory:
          `${prettySymbol(sus.display!)} is a ${pn(chord.root)}9sus: a ${pn(susTop)} triad over ${pn(chord.root)}. It's the gospel way to sound the dominant ` +
          `while holding back the 3rd. ${ps(approach)} is the tritone sub of ${pn(chord.root)}7, voiced as a 13(♯11) cluster ` +
          `a half step above ${pn(next.root)}. Each voice either slides down a half step or stays put as it lands on ${prettySymbol(targetSym)}.`,
        recreateRule:
          "Before a tonic, play a 13(♯11) chord a half step above it and slide the whole shape down. Put IV/V in front (a triad on the dominant's ♭7, over its root) for the sus colour.",
      },
    };
  },
};

export const RULES: Rule[] = [secondaryTwoFive, tritoneSub, upperStructure, gospelTurnaround];
