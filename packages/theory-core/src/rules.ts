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
import { chroma, prettySymbol, simplifyNote, transpose } from "./pitch";
import { chain, mk, pn, ps, romanName, splitBeats, tidy, type NewChord, type Rule } from "./ruleKit";
import type { Quality } from "./types";
import { nearestMotion } from "./voiceLeading";

export type { NewChord, Proposal, Rule, RuleContext } from "./ruleKit";

// ── Rule 1: secondary ii–V (approach) / related ii ─────────────────────
export const secondaryTwoFive: Rule = {
  id: "functional.secondaryTwoFive",
  name: "Secondary ii–V",
  pedagogy: {
    formula: "V7 → ii7 – V7 → I",
    whenToUse: "Before any major or minor target chord (or solitary V7) with at least 2 beats.",
    whyItWorks: "Splitting one chord into a fifth-falling ii–V doubles harmonic momentum and creates a smooth 7th → 3rd guide-tone chain.",
    bandstandCue: "From the target chord, go up a 5th for V7 and another 5th (or a whole step above the target) for ii.",
  },
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

// ── Rule 1b: secondary dominant (make the chord the V of its target) ──
const SECONDARY_SOURCES = new Set<Quality>(["maj", "maj7", "6", "m", "m7", "m6", "m7b5"]);

export const secondaryDominant: Rule = {
  id: "functional.secondaryDominant",
  name: "Secondary dominant",
  pedagogy: {
    formula: "vi7 → VI7(♭9) → ii",
    whenToUse: "Any chord whose root falls a 5th into the next chord, as long as it isn't already a dominant.",
    whyItWorks:
      "Keep the root and make the chord a dominant: its 3rd becomes the leading tone of the next chord's root, so a diatonic step turns into a resolution.",
    bandstandCue: "Same bass note, raise the minor 3rd a half step (or flatten the major 7th): you're now playing the V of the next chord.",
  },
  propose({ chord, next, afterNext }) {
    if (!next || chord.display || chord.bass || !SECONDARY_SOURCES.has(chord.quality)) return null;
    if (!resolvesDownFifth(chord, next)) return null;
    // The ii of a written ii–V already points at its target: turning Dm7 → G7 → C into D9 → G7 → C
    // just trades the ii's colour for nothing, in every tune. Save the move for chords that don't point yet.
    const isMinorish = isMinorQ(chord.quality) || chord.quality === "m7b5";
    if (isMinorish && next.quality === "7" && afterNext && resolvesDownFifth(next, afterNext)) return null;
    const tMinor = isMinorQ(next.quality) || next.quality === "m7b5";
    if (!tMinor && !isMajorQ(next.quality) && next.quality !== "7") return null;

    // ♭9 (Phrygian dominant) into a minor target, the natural 9 into a major or dominant one
    const dom = tMinor ? mk(chord.root, "7", chord.beats, [], ["b9"]) : mk(chord.root, "7", chord.beats, ["9"]);
    const [oldThird, oldSeventh] = guideTones(chord);
    const [third, seventh] = guideTones(dom);
    const raised = oldThird && chroma(oldThird.note) !== chroma(third.note) ? [oldThird.note, third.note] : undefined;
    const lowered = oldSeventh && oldSeventh.degree === "7" ? [oldSeventh.note, seventh.note] : undefined;
    const gtChain = chain([third.note, seventh.note], [next]);
    const r = romanName(next);
    const facts = {
      original: symbol(chord),
      dominant: symbol(dom),
      target: symbol(next),
      leadingTone: third.note,
      ...(raised ? { raised } : {}),
      ...(lowered ? { lowered } : {}),
      guideToneChain: gtChain,
    };
    const change = [
      raised && `its ${pn(raised[0])} rises to ${pn(raised[1])}`,
      lowered && `its ${pn(lowered[0])} drops to ${pn(lowered[1])}`,
    ]
      .filter(Boolean)
      .join(" and ");

    return {
      title: r ? `Make it the V of ${r}` : `Make it the V of ${ps(next)}`,
      level: 1,
      category: "functional",
      styleTags: ["standard", "bebop", "gospel"],
      chords: [dom],
      facts,
      text: {
        summary: `Play ${ps(chord)} as ${ps(dom)}, the dominant of ${ps(next)}.`,
        theory:
          `${ps(chord)} already sits a 5th above ${ps(next)}, so one change is enough: ${change || `add the ♭7 (${pn(seventh.note)})`}, and it becomes ${ps(next)}'s own dominant. ` +
          `${pn(third.note)}, the new 3rd, is a half step below ${pn(next.root)}: the leading tone of the chord you're about to land on. ` +
          `Guide tones: ${gtChain}.` +
          (tMinor ? ` The target is minor, so the dominant takes the ♭9 (${pn(transpose(chord.root, "b9"))}) from ${pn(next.root)} harmonic minor.` : ""),
        recreateRule:
          "If a chord's root falls a 5th into the next chord, you can keep the root and make it a dominant 7: raise a minor 3rd, flatten a major 7th. Add the ♭9 when the target is minor.",
        insight: tMinor
          ? `Over ${ps(dom)}, play ${pn(chord.root)} Phrygian dominant: the 5th mode of ${pn(next.root)} harmonic minor.`
          : `This is the first step of backing up the circle: give the ${ps(dom)} its own related ii and you have the full secondary ii–V.`,
      },
    };
  },
};

// ── Rule 2: tritone substitution ───────────────────────────────────────
export const tritoneSub: Rule = {
  id: "dominant.tritoneSub",
  name: "Tritone substitution",
  pedagogy: {
    formula: "V7 → ♭II7 → I",
    whenToUse: "Any dominant 7th chord resolving down a perfect 5th.",
    whyItWorks: "Dominant chords a tritone apart share the exact same 3rd and ♭7 (with roles swapped), so the tritone still resolves while the bass slides down by half step.",
    bandstandCue: "Keep your original V7 guide-tone shell (3rd & ♭7) and put the root a half step above the target chord.",
  },
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
  pedagogy: {
    formula: "♭VI triad / V7 shell",
    whenToUse: "Any altered dominant 7th (especially V7 resolving to a minor chord).",
    whyItWorks: "A plain major triad built on ♭13 stacks the ♭13, root, and ♯9 in the right hand over the left hand's root–♭7–3 dominant shell.",
    bandstandCue: "Hold a root–♭7–3 shell in LH; in RH play the major triad a major 3rd below the dominant's root.",
  },
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
  pedagogy: {
    formula: "IV/V → ♭II13(♯11) → I",
    whenToUse: "A V7 resolving to a major tonic with at least 2 beats.",
    whyItWorks: "The IV/V sus delays the leading tone; the ♭II13(♯11) is a tritone-sub cluster a half step above I where every voice slides down by semitone or holds.",
    bandstandCue: "Play a major triad a whole step below V over the V bass, then plane a 13(♯11) chord from a half step above I down into home.",
  },
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

// ── Rule 5: Bill Evans rootless ii–V–I (Type A → Type B → Type A) ──────
export const rootlessTwoFiveOne: Rule = {
  id: "voicing.rootlessTwoFiveOne",
  name: "Rootless ii–V–I",
  pedagogy: {
    formula: "ii9 (3–5–♭7–9) → V13 (♭7–9–3–13) → Imaj9 (3–5–7–9)",
    whenToUse: "Over any major ii–V–I when comping with a bassist or playing rootless left-hand shells.",
    whyItWorks: "Alternating Type A (3–5–7–9) and Type B (7–9–3–13) grips keeps common tones anchored while the 7th of each chord drops a half step into the next chord's 3rd.",
    bandstandCue: "Play ♭3–5–♭7–9 on ii; hold 3 fingers and drop only the ♭7 down a half step to 3 for V13; then step down into 3–5–7–9 on I.",
  },
  propose({ chord, next, afterNext }) {
    if (!next || !afterNext || afterNext.display) return null;
    if (chord.quality !== "m7" || next.quality !== "7" || afterNext.quality !== "maj7") return null;
    if (!resolvesDownFifth(chord, next) || !resolvesDownFifth(next, afterNext)) return null;
    if (!chord.analysis && chord.extensions.length === 0) return null;

    const iiChord = mk(chord.root, "m7", chord.beats, ["9"]);
    const vChord = mk(next.root, "7", next.beats, ["9", "13"]);

    const iiGrip = {
      lh: [tidy(transpose(chord.root, "b3")), tidy(transpose(chord.root, "5"))],
      rh: [tidy(transpose(chord.root, "b7")), tidy(transpose(chord.root, "9"))],
    };
    const vGrip = {
      lh: [tidy(transpose(next.root, "b7")), tidy(transpose(next.root, "9"))],
      rh: [tidy(transpose(next.root, "3")), tidy(transpose(next.root, "13"))],
    };
    const iGrip = {
      lh: [tidy(transpose(afterNext.root, "3")), tidy(transpose(afterNext.root, "5"))],
      rh: [tidy(transpose(afterNext.root, "7")), tidy(transpose(afterNext.root, "9"))],
    };

    const b7ii = iiGrip.rh[0];
    const thirdV = vGrip.rh[0];
    return {
      replaceCount: 2,
      title: "Rootless ii–V–I (Type A → B)",
      level: 2,
      category: "voicing",
      styleTags: ["bill-evans", "standard", "bebop"],
      chords: [iiChord, vChord],
      voicingHint: iiGrip,
      voicingHints: [iiGrip, vGrip, iGrip],
      facts: {
        typeA_ii: [...iiGrip.lh, ...iiGrip.rh],
        typeB_V: [...vGrip.lh, ...vGrip.rh],
        typeA_I: [...iGrip.lh, ...iGrip.rh],
        movingVoice: `${pn(b7ii)} → ${pn(thirdV)}`,
      },
      text: {
        summary: `Voice ${ps(iiChord)} → ${ps(vChord)} → ${ps(afterNext)} with Bill Evans rootless Type A and Type B grips.`,
        theory:
          `On ${ps(iiChord)}, stack ♭3–5–♭7–9 (${[...iiGrip.lh, ...iiGrip.rh].map(pn).join("–")}). ` +
          `To reach ${ps(vChord)}, three voices stay put (${pn(vGrip.lh[0])}, ${pn(vGrip.lh[1])}, ${pn(vGrip.rh[1])}) while only ${pn(b7ii)} drops a half step to ${pn(thirdV)} ` +
          `to form the ♭7–9–3–13 Type B grip. From there, step down into ${ps(afterNext)} (${[...iGrip.lh, ...iGrip.rh].map(pn).join("–")}).`,
        recreateRule:
          "Over ii–V–I, voice ii as ♭3–5–♭7–9 (Type A), drop only the ♭7 a half step to get ♭7–9–3–13 on V (Type B), then resolve into 3–5–7–9 on I.",
      },
    };
  },
};

// ── Rule 6: upper-structure II triad (Lydian dominant 13#11 grip) ──────
export const upperStructureII: Rule = {
  id: "voicing.upperStructureII",
  name: "Upper-structure II (Lydian dominant)",
  pedagogy: {
    formula: "II triad / V7 shell → 13(♯11)",
    whenToUse: "Over any Lydian dominant 7(♯11), backdoor ♭VII7, tritone sub, or bright major-target V7.",
    whyItWorks: "Stacking a major triad a whole step above the root puts the 9th, ♯11th, and 13th in the right hand over the 1–3–♭7 shell in the left hand.",
    bandstandCue: "Play the 1–3–♭7 shell in LH; in RH play a plain major triad built a whole step above the chord root.",
  },
  propose({ chord, next }) {
    if (!next || chord.quality !== "7") return null;
    const hasSharp11 = chord.alterations.includes("#11");
    const hasOtherAlt = chord.alterations.some((a) => a !== "#11");
    if (hasOtherAlt) return null;
    const toMaj7 = next.quality === "maj7" && !next.display && resolvesDownFifth(chord, next) && !!chord.analysis;
    if (!hasSharp11 && !toMaj7) return null;

    const newChord = mk(chord.root, "7", chord.beats, ["9", "13"], ["#11"]);
    const tr = tidy(transpose(chord.root, "2"));
    const lh = [chord.root, tidy(transpose(chord.root, "3")), tidy(transpose(chord.root, "b7"))];
    const rh = [tr, tidy(transpose(tr, "3")), tidy(transpose(tr, "5"))];
    return {
      title: "Upper-structure II (13♯11)",
      level: 2,
      category: "voicing",
      styleTags: ["modern", "bebop", "lydian-dominant"],
      chords: [newChord],
      voicingHint: { lh, rh },
      voicingHints: [{ lh, rh }],
      facts: { triad: rh, shell: lh, triadRoot: tr },
      text: {
        summary: `Stack a ${pn(tr)} major triad over a ${lh.map(pn).join("–")} shell for ${ps(newChord)}.`,
        theory:
          `The left hand plays the ${pn(chord.root)}7 guide-tone shell (${lh.map(pn).join("–")}). ` +
          `The right hand plays a plain ${pn(tr)} major triad (${rh.map(pn).join(" ")}), a whole step above ${pn(chord.root)}, ` +
          `which automatically supplies the 9th (${pn(rh[0])}), ♯11th (${pn(rh[1])}), and 13th (${pn(rh[2])}) — the signature Lydian dominant polychord.`,
        recreateRule:
          "Over a dominant 7th, hold the root–3–♭7 shell in the left hand and play the major triad a whole step above the root in the right hand for 13(♯11).",
      },
    };
  },
};

export const CORE_RULES: Rule[] = [secondaryTwoFive, secondaryDominant, tritoneSub, upperStructure, gospelTurnaround, rootlessTwoFiveOne, upperStructureII];
