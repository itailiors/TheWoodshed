import { LEVELS, type LevelId, type Stage } from "@reharm/theory-core";
import { wash } from "../../design/tokens";

/*
 * The game's controls: which level, how much help (the stage), and the function chips the
 * Open stage asks for from Level 2 ("which job is it?"). Pills follow the app's language:
 * solid ink when on, dashed ink-soft when off.
 */

const STAGE_LABEL: Record<Stage, { label: string; title: string }> = {
  guided: { label: "Guided", title: "Up to three cards, each saying what it is. The most help" },
  choices: { label: "Choices", title: "The same cards, chord names only" },
  open: { label: "Open", title: "No cards: play the next root yourself" },
};

const pill = (on: boolean) =>
  `cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker ${on ? "border-ink bg-ink text-paper-light" : "border-dashed border-ink-soft hover:bg-paper-shade"}`;

export function StageSelector({ value, onChange }: { value: Stage; onChange: (s: Stage) => void }) {
  return (
    <div role="radiogroup" aria-label="How much help" className="flex flex-wrap gap-1.5 text-sm">
      {(Object.keys(STAGE_LABEL) as Stage[]).map((st) => (
        <button key={st} type="button" role="radio" aria-checked={value === st} title={STAGE_LABEL[st].title} onClick={() => onChange(st)} className={pill(value === st)}>
          {STAGE_LABEL[st].label}
        </button>
      ))}
    </div>
  );
}

export function LevelPicker({ value, onChange, nextUp, mastered = [] }: { value: LevelId; onChange: (l: LevelId) => void; nextUp: LevelId | null; mastered?: LevelId[] }) {
  return (
    <div role="radiogroup" aria-label="Level" className="grid gap-2 sm:grid-cols-3">
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          onClick={() => onChange(l.id)}
          className={`tap-lg relative cursor-pointer rounded-lg border-2 px-3 py-2 text-left ${value === l.id ? "border-ink bg-paper-light" : "border-dashed border-ink-soft hover:bg-paper-shade"}`}
        >
          <span className="block font-marker">
            {l.id}. {l.name}
            {mastered.includes(l.id) && <span className="ml-1.5" style={{ color: "var(--color-sage-ink)" }} aria-label="mastered">✓</span>}
          </span>
          <span className="block font-hand text-xs text-ink-soft">{LEVEL_BLURB[l.id]}</span>
          {nextUp === l.id && (
            <span className="absolute -right-1 -top-2 -rotate-3 rounded px-1.5 font-marker text-xs" style={{ background: `${wash.mustard}66` }}>
              next up
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const LEVEL_BLURB: Record<LevelId, string> = {
  1: "V → I in C and F",
  2: "ii → V → I in C, F, B♭",
  3: "the whole staircase, and the turnaround",
};

/** "Which job is it?": the function chips, after a right root at Open (Levels 2–3). Keys 1–7 too. */
export function FunctionChips({ chips, root, onPick }: { chips: readonly string[]; root: string; onPick: (chip: string) => void }) {
  return (
    <div className="space-y-2" aria-live="polite">
      <p className="font-marker text-lg">
        <span style={{ color: "var(--color-sage-ink)" }}>✓ {root}.</span> Which job is it?
      </p>
      <div role="group" aria-label="Function" className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-keyshortcuts={String(i + 1)}
            className="tap-lg min-w-12 cursor-pointer rounded-full border-2 border-ink px-3 font-marker text-lg hover:bg-paper-shade"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
