import { BANNED_PHRASES } from "@reharm/theory-core";

/*
 * The Deep Dive output validator (spec §F). Runs after the Zod parse, on every Claude answer, and
 * holds the text to the style guide: short sentences, no hype, no markdown, the facts' spelling,
 * at least two real notes, nothing the lesson's steps already said. Pure: no I/O, no clock.
 */

export interface ExplanationText {
  summary: string;
  deepDive: string;
  recreateRule: string;
}

/** The slice of `buildFacts` output the validator reads; everything else is scanned for note names. */
export interface ValidationFacts {
  move: { melodyVerified: boolean };
  lesson: { steps: string[] } | null;
}

export type CheckId = "caps" | "banned" | "format" | "spelling" | "notes" | "redundancy" | "ruleNotes" | "melody";

export interface CheckFailure {
  check: CheckId;
  /** Said to the model on the retry, so it is an instruction, not a diagnosis. */
  message: string;
}

export const SUMMARY_MAX_WORDS = 20;
export const SENTENCE_MAX_WORDS = 25;
export const DEEP_DIVE_WORDS = [100, 180] as const;
export const DEEP_DIVE_PARAGRAPHS = [2, 3] as const;
/** A run of this many words shared with a lesson step counts as restating it. */
export const SHARED_RUN = 8;

export const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
export const sentences = (s: string) =>
  s
    .split(/\n\s*\n/)
    .flatMap((p) => p.trim().split(/(?<=[.!?])\s+/))
    .filter((x) => /[\p{L}\p{N}]/u.test(x));
const paragraphs = (s: string) => s.split(/\n\s*\n/).filter((p) => p.trim());

/*
 * A note-name token: a capital A–G with display accidentals, standing alone or as a chord
 * symbol's root ("Gm9", "Cmaj7", "E♭7(♯11)", "C♯dim7"). An English word that starts with A–G
 * ("Bill", "Dominant", "Amazing") isn't one. A sentence-initial "A" before a lowercase word is
 * the article, so it is skipped.
 */
const NOTE_TOKEN = /(?<![\p{L}\p{N}♭♯])([A-G](?:♭♭|♯♯|♭|♯)?)(?=$|[^\p{L}♭♯]|maj|m(?![\p{L}])|dim|aug|sus|add|ø)/gu;

export function noteTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NOTE_TOKEN)) {
    const at = m.index!;
    const before = text.slice(0, at);
    const sentenceStart = /(^|[.!?:]\s+|\n\s*)$/.test(before);
    if (m[1] === "A" && sentenceStart && /^A [a-z]/.test(text.slice(at))) continue;
    out.push(m[1]);
  }
  return out;
}

/** Every note name the facts spell, anywhere in them (chord roots, scale notes, motions, prose). */
export function factNotes(facts: unknown): Set<string> {
  const notes = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "string") noteTokens(v).forEach((n) => notes.add(n));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return notes;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}♭♯]+|[^\p{L}\p{N}♭♯]+$/gu, ""))
    .filter(Boolean);
const runs = (ws: string[], n: number) => Array.from({ length: Math.max(0, ws.length - n + 1) }, (_, i) => ws.slice(i, i + n).join(" "));

/** An ASCII accidental: any "#", or a "b" right after a note letter ("Bb", "Ebm7", "Dbmaj7"), never "Above". */
const ASCII_ACCIDENTAL = /#|(?<![\p{L}\p{N}])[A-G]b(?=$|[^\p{L}]|m(?![\p{L}])|maj|dim|aug|sus)/u;
const MARKDOWN = /(^|\n)\s*(#|[-*•]\s|\d+\.\s)|\*\*|__|`/;
const CHECK_THE_MELODY = /\bcheck\b[^.!?]*\bmelody\b/i;

/** Every failed check, in spec order. An empty list means the answer can be served and cached. */
export function validateExplanation(out: ExplanationText, facts: ValidationFacts): CheckFailure[] {
  const fail: CheckFailure[] = [];
  const all = [out.summary, out.deepDive, out.recreateRule].join("\n\n");

  // 1. word and sentence caps
  const caps: string[] = [];
  if (words(out.summary) > SUMMARY_MAX_WORDS) caps.push(`the summary has ${words(out.summary)} words; keep it to ${SUMMARY_MAX_WORDS} or fewer`);
  const long = sentences(all).filter((s) => words(s) > SENTENCE_MAX_WORDS);
  if (long.length) caps.push(`${long.length} sentence(s) run over ${SENTENCE_MAX_WORDS} words, e.g. "${long[0].slice(0, 60)}…"; split them`);
  const dw = words(out.deepDive);
  if (dw < DEEP_DIVE_WORDS[0] || dw > DEEP_DIVE_WORDS[1]) caps.push(`the deepDive has ${dw} words; write ${DEEP_DIVE_WORDS[0]}–${DEEP_DIVE_WORDS[1]}`);
  const dp = paragraphs(out.deepDive).length;
  if (dp < DEEP_DIVE_PARAGRAPHS[0] || dp > DEEP_DIVE_PARAGRAPHS[1]) caps.push(`the deepDive has ${dp} paragraph(s); write 2 or 3, separated by a blank line`);
  if (sentences(out.recreateRule).length !== 1) caps.push("the recreateRule must be exactly one sentence");
  if (caps.length) fail.push({ check: "caps", message: `Length: ${caps.join("; ")}.` });

  // 2. banned phrases
  const banned = BANNED_PHRASES.exec(all);
  if (banned) fail.push({ check: "banned", message: `Remove "${banned[0]}": it is filler the style guide bans.` });

  // 3. markdown and ASCII accidentals
  if (MARKDOWN.test(all) || ASCII_ACCIDENTAL.test(all))
    fail.push({ check: "format", message: "Write plain prose with no markdown, and accidentals as ♭ and ♯ (never b or #)." });

  // 4. every note named is in the facts, spelled as they spell it (catches A♯ for B♭)
  const known = factNotes(facts);
  const foreign = [...new Set(noteTokens(all))].filter((n) => !known.has(n));
  if (foreign.length) fail.push({ check: "spelling", message: `Spell notes exactly as the facts do: ${foreign.join(", ")} ${foreign.length === 1 ? "is" : "are"} not in the facts.` });

  // 5. the Deep Dive names real notes
  const named = new Set(noteTokens(out.deepDive).filter((n) => known.has(n)));
  if (named.size < 2) fail.push({ check: "notes", message: "Name at least two notes from the facts in the deepDive." });

  // 6. redundancy: no 8-word run shared with a lesson step
  const stepRuns = new Set((facts.lesson?.steps ?? []).flatMap((s) => runs(norm(s), SHARED_RUN)));
  const shared = runs(norm(out.deepDive), SHARED_RUN).find((r) => stepRuns.has(r));
  if (shared) fail.push({ check: "redundancy", message: `The deepDive repeats a lesson step ("${shared}"). Cover what the steps don't.` });

  // 7. the rule works in any key
  if (noteTokens(out.recreateRule).length) fail.push({ check: "ruleNotes", message: "Write the recreateRule in degrees and functions, with no note names." });

  // 8. the melody line matches what the engine could check
  if (!facts.move.melodyVerified && !/\bmelody\b/i.test(all))
    fail.push({ check: "melody", message: "No melody was entered for these bars: add one brief line telling the player to check the move against their lead sheet's melody." });
  if (facts.move.melodyVerified && CHECK_THE_MELODY.test(all))
    fail.push({ check: "melody", message: "The melody was checked by the engine: drop the line asking the player to check it." });

  return fail;
}
