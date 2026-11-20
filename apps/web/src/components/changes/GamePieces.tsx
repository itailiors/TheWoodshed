import {
  chipOf,
  judge,
  MOTIONS,
  prettyNote,
  prettySymbol,
  verdictLine,
  type AltMotionId,
  type AnswerVerdict,
  type SpelledChord,
  type Stage,
  type Step,
} from "@reharm/theory-core";
import { pen } from "../../design/tokens";
import { ChordName } from "../ChordName";
import { OUTCOME_COLOR, OUTCOME_WORD, OutcomeGlyph } from "./OutcomeGlyph";

/*
 * The game's presentational pieces: the chord you're on, the option cards (Guided / Choices),
 * and the feedback line. They only render what the reducer says; every action is a callback.
 */

/** "bII7" → "♭II7", "viiø7" stays as it is. */
export const prettyNumeral = (n: string) => n.replace(/^b/, "♭").replace(/^#/, "♯");

// ── the chord you're on ──

export function PromptChord({ chord, keyTonic, onPlay, canPlay }: { chord: SpelledChord; keyTonic: string; onPlay: () => void; canPlay: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-hand text-sm text-ink-soft">in {prettyNote(keyTonic)} major</p>
        <ChordName symbol={chord.symbol} className="text-6xl leading-none md:text-7xl" />
        <p className="mt-1 font-hand text-sm text-ink-soft">{prettyNumeral(chord.numeral)}</p>
      </div>
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        title="Hear it again (Space)"
        className="tap-lg cursor-pointer rounded-full border-2 border-ink px-4 font-marker hover:bg-paper-shade disabled:cursor-default disabled:opacity-40"
      >
        ▶ Play it
      </button>
    </div>
  );
}

// ── option cards ──

const ALT_NAME: Record<AltMotionId, string> = {
  tritoneSub: "the tritone sub",
  backdoor: "the backdoor",
  passingDim: "a passing diminished",
};

/** The Coach concept that teaches each "real jazz move" alternative: "Learn the tritone sub →" opens it (`#coach/<id>`). */
const ALT_CONCEPT: Record<AltMotionId, string> = {
  tritoneSub: "dominant.tritoneSub",
  backdoor: "modal.backdoorTwoFive",
  passingDim: "chromatic.passingDiminished",
};

/** The Guided card's one line: the answer gets the teacher's hint; the others just say what they are. */
function preview(step: Step, keyTonic: string, c: SpelledChord): string {
  if (c.pc === step.expected.pc) return MOTIONS[step.motion].hint({ tonic: keyTonic, from: step.from, to: step.expected });
  const v = judge(step, keyTonic, c.pc);
  if (v.kind === "alt") return `${prettySymbol(c.symbol)}, ${v.move in ALT_NAME ? ALT_NAME[v.move as AltMotionId] : MOTIONS[v.move as keyof typeof MOTIONS].model}.`;
  return `${prettySymbol(c.symbol)}, the ${chipOf(c)}.`;
}

export function OptionCards({
  options,
  stage,
  step,
  keyTonic,
  enabled,
  onPick,
}: {
  options: SpelledChord[];
  stage: Exclude<Stage, "open">;
  step: Step;
  keyTonic: string;
  enabled: boolean;
  onPick: (pc: number) => void;
}) {
  return (
    <ol aria-label="Where does it go?" className={`grid gap-2 ${stage === "choices" ? "sm:grid-cols-3" : ""}`}>
      {options.map((c, i) => (
        <li key={c.pc}>
          <button
            type="button"
            disabled={!enabled}
            onClick={() => onPick(c.pc)}
            aria-keyshortcuts={String(i + 1)}
            className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border-2 border-ink bg-paper-light px-3 py-2 text-left hover:-rotate-[0.5deg] hover:bg-paper-shade disabled:cursor-default disabled:opacity-60 disabled:hover:rotate-0 motion-reduce:hover:rotate-0"
          >
            <span className="w-5 shrink-0 font-hand text-xs text-ink-faint">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <ChordName symbol={c.symbol} className="text-2xl" />
                {stage === "guided" && <span className="font-hand text-sm text-ink-soft">{prettyNumeral(c.numeral)}</span>}
              </span>
              {stage === "guided" && <span className="block font-hand text-sm leading-snug text-ink-soft">{preview(step, keyTonic, c)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// ── feedback ──

export function FeedbackLine({
  verdict,
  step,
  keyTonic,
  fixing,
  chip,
  whyOpen,
  canNext,
  onWhy,
  onNext,
}: {
  verdict: AnswerVerdict;
  step: Step;
  keyTonic: string;
  fixing: boolean;
  /** The function chip given at Open (Levels 2–3), if one was asked. */
  chip: { picked: string; right: boolean } | null;
  whyOpen: boolean;
  canNext: boolean;
  onWhy: () => void;
  onNext: () => void;
}) {
  const ctx = { tonic: keyTonic, from: step.from, to: step.expected };
  return (
    <div className="space-y-2">
      <p className="flex items-start gap-2 text-lg leading-snug" role="status" aria-live="assertive">
        <OutcomeGlyph outcome={verdict.kind} />
        <span>
          <span className="font-marker" style={{ color: OUTCOME_COLOR[verdict.kind] }}>
            {OUTCOME_WORD[verdict.kind]}
          </span>{" "}
          <span className="font-hand">{verdictLine(step, keyTonic, verdict)}</span>
        </span>
      </p>
      {verdict.kind === "alt" && verdict.move in ALT_CONCEPT && (
        // the game's line stays as written (ears.motions.test.ts); the lesson is one tap away, in Coach
        <p className="font-marker text-sm">
          <a href={`#coach/${ALT_CONCEPT[verdict.move as AltMotionId]}`} className="text-pen underline decoration-dotted underline-offset-4 hover:decoration-solid" data-learn-alt={verdict.move}>
            Learn {ALT_NAME[verdict.move as AltMotionId].replace(/^a /, "the ")} →
          </a>
        </p>
      )}
      {chip && (
        <p className="font-hand" style={{ color: chip.right ? "var(--color-sage-ink)" : pen.red }}>
          {chip.right
            ? `And yes, it's the ${chipOf(step.expected)}. (+4)`
            : `${prettySymbol(step.expected.symbol)} is the ${chipOf(step.expected)} here, not the ${chip.picked}. The root still counts.`}
        </p>
      )}
      {fixing && (
        <p className="font-marker" style={{ color: pen.red }}>
          → Play {prettyNote(step.expected.root)} to go on.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 font-marker text-sm">
        {!fixing && (
          <button type="button" onClick={onWhy} aria-expanded={whyOpen} className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 hover:bg-paper-shade">
            why?
          </button>
        )}
        {canNext && (
          <button type="button" onClick={onNext} title="Next (Enter or Space)" className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade">
            Next →
          </button>
        )}
      </div>
      {whyOpen && <p className="max-w-prose font-hand text-sm text-ink-soft">{MOTIONS[step.motion].why(ctx)}</p>}
    </div>
  );
}
