import { prettySymbol, RULES, symbol, type ChordEvent, type HarmonicFunction, type ReharmMove } from "@reharm/theory-core";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CATEGORY_WASH, pen } from "../design/tokens";
import { ChordName } from "./ChordName";

/*
 * Chord by chord: one dropdown per chord change of the tune. Each lists what you can do there:
 * let the dial decide, keep the chord as written, or any move the engine accepted over it,
 * with the logic behind it (its formula and why it works). Picking is the same as "Also works
 * here" on a move card; keeping a chord stops the dial from touching it.
 */

const RULE = new Map(RULES.map((r) => [r.id, r]));

const FUNCTION_WORD: Partial<Record<HarmonicFunction, string>> = {
  T: "home: the chord at rest",
  PD: "pre-dominant: leads toward the V",
  D: "tension: wants to resolve",
  passing: "passing: connects two chords",
  chromatic: "chromatic colour",
  modal: "borrowed / modal colour",
};

type Choice = { kind: "dial" } | { kind: "kept" } | { kind: "move"; move: ReharmMove };

interface Props {
  /** The tune's own changes, in order. */
  chords: ChordEvent[];
  /** Every move the engine accepted for this tune. */
  accepted: ReharmMove[];
  /** The moves in the current reharm. */
  pathway: ReharmMove[];
  /** Moves you picked, and chords you kept as written. */
  forcedIds: string[];
  keptIds: string[];
  level: number;
  selectedId?: string | null;
  onPick: (m: ReharmMove) => void;
  onKeep: (chordId: string) => void;
  /** Hand a chord back to the dial: drop any pick or keep that touches it. */
  onDial: (chordId: string) => void;
  onSelect: (moveId: string) => void;
}

const route = (m: ReharmMove) => (
  <>
    {m.chords.map((c, i) => (
      <span key={c.id}>
        {i > 0 && <span className="text-ink-faint"> · </span>}
        <ChordName symbol={symbol(c)} />
      </span>
    ))}
    {m.targetSymbol && (
      <>
        <span className="text-ink-soft"> → </span>
        <ChordName symbol={m.targetSymbol} className="text-ink-soft" />
      </>
    )}
  </>
);

/** The logic behind a move, for the tooltip and the line under it. */
function logicOf(m: ReharmMove) {
  const p = RULE.get(m.ruleId)?.pedagogy;
  return {
    formula: p?.formula ?? "",
    why: p?.whyItWorks ?? m.text.summary,
    tip: [p?.formula, p?.whyItWorks, p?.whenToUse ? `When to use: ${p.whenToUse}` : ""].filter(Boolean).join("\n"),
  };
}

export function ChordMoveSelector({ chords, accepted, pathway, forcedIds, keptIds, level, selectedId, onPick, onKeep, onDial, onSelect }: Props) {
  const rows = chords
    .map((c) => ({ chord: c, options: accepted.filter((m) => m.replaces.includes(c.id)).sort((a, b) => a.level - b.level || a.priority - b.priority) }))
    .filter((r) => r.options.length > 0);
  const quiet = chords.length - rows.length;

  return (
    <section aria-labelledby="chord-by-chord-h" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="chord-by-chord-h" className="font-marker text-lg uppercase">
          Chord by chord
        </h3>
        <p className="text-xs text-ink-soft">
          Pick the move for each change, or keep it as written.{quiet > 0 ? ` ${quiet} other chord${quiet === 1 ? " has" : "s have"} no move that fits.` : ""}
        </p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ chord, options }) => {
          const inPath = pathway.find((m) => m.replaces.includes(chord.id));
          const choice: Choice = keptIds.includes(chord.id)
            ? { kind: "kept" }
            : inPath && forcedIds.includes(inPath.id)
              ? { kind: "move", move: inPath }
              : { kind: "dial" };
          return (
            <li key={chord.id}>
              <ChordRow
                chord={chord}
                options={options}
                choice={choice}
                dialMove={choice.kind === "dial" ? (inPath ?? null) : null}
                level={level}
                selected={!!inPath && inPath.id === selectedId}
                onPick={onPick}
                onKeep={() => onKeep(chord.id)}
                onDial={() => onDial(chord.id)}
                onSelect={onSelect}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ChordRow({
  chord,
  options,
  choice,
  dialMove,
  level,
  selected,
  onPick,
  onKeep,
  onDial,
  onSelect,
}: {
  chord: ChordEvent;
  options: ReharmMove[];
  choice: Choice;
  /** With the dial deciding: the move it put here, if any. */
  dialMove: ReharmMove | null;
  level: number;
  selected: boolean;
  onPick: (m: ReharmMove) => void;
  onKeep: () => void;
  onDial: () => void;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const sym = symbol(chord);
  const fn = chord.analysis ? `${chord.analysis.roman} · ${FUNCTION_WORD[chord.analysis.func] ?? chord.analysis.func}` : null;
  const current = choice.kind === "move" ? choice.move : choice.kind === "dial" ? dialMove : null;

  // close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 ${selected ? "border-ink bg-paper-light" : "border-ink-faint/60"}`}
      >
        <span className="w-16 shrink-0 text-xs text-ink-soft">
          bar {chord.at.bar}
          {chord.at.beat > 1 ? `.${chord.at.beat}` : ""}
          <ChordName symbol={sym} className="block text-lg text-ink" />
        </span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`Move for ${prettySymbol(sym)} in bar ${chord.at.bar}: ${current ? current.title : "as written"}${choice.kind === "dial" ? " (the dial's choice)" : ""}`}
          onClick={() => setOpen((o) => !o)}
          className="tap-lg flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full border-2 border-ink px-3 text-left hover:bg-paper-shade"
        >
          {current && <span className="h-3 w-3 shrink-0 -rotate-6 rounded-sm" style={{ background: CATEGORY_WASH[current.category] }} />}
          <span className="min-w-0 flex-1 truncate font-marker text-sm">
            {current ? current.title : "As written"}
            <span className="font-hand text-xs text-ink-soft">
              {choice.kind === "dial" ? " · dial" : choice.kind === "kept" ? " · kept" : " · your pick"}
            </span>
          </span>
          <span aria-hidden className="text-ink-soft">
            ▾
          </span>
        </button>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Moves for ${prettySymbol(sym)}`}
          className="absolute left-0 right-0 z-30 mt-1 max-h-[70vh] space-y-1 overflow-y-auto rounded-lg border-2 border-ink bg-paper-light p-1.5 shadow-[3px_3px_0_var(--color-ink-faint)]"
        >
          <Option
            selected={choice.kind === "dial"}
            onChoose={choose(onDial)}
            title="Let the dial decide"
            sub={dialMove && choice.kind === "dial" ? `Right now: ${dialMove.title}` : `It picks the best moves for L${level}, phrase by phrase.`}
            tip="Hand this chord back to the reharm dial: no pick, no keep."
          />
          <Option
            selected={choice.kind === "kept"}
            onChoose={choose(onKeep)}
            title={
              <>
                As written: <ChordName symbol={sym} />
              </>
            }
            sub={fn ?? "The tune's own chord."}
            tip={`Keep ${prettySymbol(sym)} as the tune has it, whatever the dial says.${fn ? `\n${fn}` : ""}`}
          />
          {options.map((m) => {
            const logic = logicOf(m);
            const alsoReplaces = m.original.filter((c) => c.id !== chord.id).map((c) => prettySymbol(symbol(c)));
            return (
              <Option
                key={m.id}
                selected={choice.kind === "move" && choice.move.id === m.id}
                onChoose={choose(() => {
                  onPick(m);
                  onSelect(m.id);
                })}
                swatch={CATEGORY_WASH[m.category]}
                title={
                  <>
                    {m.title} <span className="font-hand text-xs text-ink-soft">L{m.level}</span>
                    <span className="block text-sm">{route(m)}</span>
                  </>
                }
                sub={
                  <>
                    {logic.formula && <span className="font-marker text-ink">{logic.formula} · </span>}
                    {logic.why}
                    {alsoReplaces.length > 0 && <span className="block text-ink-faint">Also replaces {alsoReplaces.join(", ")}.</span>}
                    {m.level > level && (
                      <span className="block" style={{ color: pen.red }}>
                        Spicier than the dial (L{level}): it goes in because you picked it.
                      </span>
                    )}
                  </>
                }
                tip={logic.tip}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Option({
  selected,
  onChoose,
  title,
  sub,
  tip,
  swatch,
}: {
  selected: boolean;
  onChoose: () => void;
  title: ReactNode;
  sub: ReactNode;
  tip: string;
  swatch?: string;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        title={tip}
        onClick={onChoose}
        className={`flex w-full cursor-pointer items-start gap-2 rounded-md border-2 px-2 py-1.5 text-left ${
          selected ? "border-ink bg-wash-mustard/25" : "border-transparent hover:border-ink-faint"
        }`}
      >
        <span className="mt-1 h-3 w-3 shrink-0 -rotate-6 rounded-sm" style={{ background: swatch ?? "transparent" }} />
        <span className="min-w-0 flex-1">
          <span className="block font-marker text-[15px] leading-snug">
            {selected && <span aria-hidden>✓ </span>}
            {title}
          </span>
          <span className="block font-hand text-xs leading-snug text-ink-soft">{sub}</span>
        </span>
      </button>
    </li>
  );
}
