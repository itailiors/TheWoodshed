import { chordTones, guideTones, prettyNote, symbol, voiceProgression, type ChordEvent, type ReharmMove } from "@reharm/theory-core";
import { useEffect, useRef, useState } from "react";
import { player } from "../audio/player";
import { countOpen } from "../usage/panelOpens";
import { SketchBox, SketchRule } from "../design/rough";
import { CATEGORY_LABEL, CATEGORY_WASH, paper, seedOf, styleLabel, wash } from "../design/tokens";
import { ChordName } from "./ChordName";
import { DeepDive } from "./DeepDive";
import { DoodleKeyboard } from "./DoodleKeyboard";

interface Props {
  tuneId: string;
  move: ReharmMove;
  /** The chord the move resolves into, from the tune as written: Before and After both land on it. */
  target?: ChordEvent;
  selected: boolean;
  alternatives: ReharmMove[];
  onSelect: () => void;
  onPick: (m: ReharmMove) => void;
  /** Loop this move in Practice Mode. */
  onPractice: () => void;
  /** Open the Comping Coach on this move's voicing. */
  onDrill: () => void;
}

const signed = (n: number) => (n === 0 ? "holds" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`);

function MoveKeyboard({ move }: { move: ReharmMove }) {
  const color = CATEGORY_WASH[move.category];
  if (move.voicingHint) {
    return (
      <DoodleKeyboard
        mode="ascending"
        octaves={3}
        notes={[...move.voicingHint.lh, ...move.voicingHint.rh]}
        accent={move.voicingHint.rh}
        color={color}
      />
    );
  }
  const shown = move.chords[move.chords.length - 1];
  return <DoodleKeyboard notes={chordTones(shown).map((t) => t.note)} accent={guideTones(shown).map((t) => t.note)} color={color} />;
}

/** Seconds per chord in the Before / After audition: long enough to hear each change land. */
const AUDITION_SECONDS = 1.1;
/** Un-presses whichever card's Before / After is sounding (one audition at a time). */
let unpress: (() => void) | null = null;

/**
 * ▶ Before / ▶ After on the card face: the written chords, then the move, each voice-led
 * (theory-core's `voiceProgression`) and played through the player's audition path, so this
 * stays Tone-free. Both halves end on the chord the move resolves into, when there is one.
 */
function BeforeAfter({ move, target }: { move: ReharmMove; target?: ChordEvent }) {
  const [sounding, setSounding] = useState<"before" | "after" | null>(null);
  const mine = useRef(() => setSounding(null)).current;
  // one audition at a time across cards: a new one silences the old one's callbacks, so un-press the old button here
  useEffect(
    () => () => {
      if (unpress === mine) {
        unpress = null;
        player.cancelAudition();
      }
    },
    [mine],
  );
  const play = (half: "before" | "after") => {
    const chords = [...(half === "before" ? move.original : move.chords), ...(target ? [target] : [])];
    if (unpress !== mine) unpress?.();
    unpress = mine;
    setSounding(half);
    void player.playSequence(
      voiceProgression(chords).map((v) => [v.bass, ...v.upper]),
      AUDITION_SECONDS,
      (i) => {
        if (i !== null) return;
        setSounding(null);
        if (unpress === mine) unpress = null;
      },
    );
  };
  const btn = (half: "before" | "after", label: string) => (
    <button
      type="button"
      aria-pressed={sounding === half}
      onClick={() => play(half)}
      title={half === "before" ? "Hear the changes as written" : "Hear the move"}
      className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-sm hover:-rotate-1 ${sounding === half ? "border-ink bg-paper-shade" : "border-ink-soft hover:border-ink"}`}
    >
      <span aria-hidden>▶ </span>
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Hear it" className="mt-2 flex flex-wrap items-center gap-2">
      {btn("before", "Before")}
      {btn("after", "After")}
    </div>
  );
}

export function MoveCard({ tuneId, move, target, selected, alternatives, onSelect, onPick, onPractice, onDrill }: Props) {
  const color = CATEGORY_WASH[move.category];
  const bar = move.span.from.bar;
  // Level 2 of the card: theory, melody check, voice leading, keys, rule, Deep Dive. Closes with the card.
  const [why, setWhy] = useState(false);
  useEffect(() => {
    if (!selected) setWhy(false);
  }, [selected]);
  return (
    <SketchBox seed={seedOf(move.id)} fill={selected ? paper.light : undefined} className="text-ink" roughness={selected ? 1.6 : 1.2}>
      <article className="p-4" data-move-id={move.id}>
        <button type="button" onClick={onSelect} className="w-full cursor-pointer text-left" aria-expanded={selected}>
          <header className="flex items-start gap-3">
            <span aria-hidden className="mt-1 inline-block h-4 w-4 shrink-0 rotate-3 rounded-[3px] opacity-80" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <h3 className="ink-wobble font-marker text-xl font-bold uppercase leading-tight tracking-wide">
                {move.title} <span className="text-base font-normal normal-case">(Bar {bar})</span>
              </h3>
              <p className="text-ink-soft text-xs">
                {CATEGORY_LABEL[move.category]} · L{move.level} · heard in {move.styleTags.map(styleLabel).join(", ")}
              </p>
            </div>
          </header>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg">
            {move.original.map((c) => (
              <ChordName key={c.id} symbol={symbol(c)} className="text-ink-faint line-through decoration-2" />
            ))}
            <span className="font-marker text-ink-soft">→</span>
            {move.chords.map((c, i) => (
              <span key={c.id} className="flex items-baseline gap-2">
                {i > 0 && <span className="text-ink-faint">·</span>}
                <ChordName symbol={symbol(c)} />
              </span>
            ))}
            {move.targetSymbol && (
              <>
                <span className="font-marker text-ink-soft">→</span>
                <ChordName symbol={move.targetSymbol} className="text-ink-soft" />
              </>
            )}
          </div>

          <p className="mt-2 text-[15px] leading-snug">{move.text.summary}</p>
        </button>

        <BeforeAfter move={move} target={target} />

        {selected && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <button
              type="button"
              onClick={onPractice}
              className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light hover:-rotate-1"
            >
              🎹 Practice this move
            </button>
            <button
              type="button"
              onClick={onDrill}
              className="cursor-pointer rounded-full border-2 border-ink px-4 py-1 font-marker hover:-rotate-1 hover:bg-paper-shade"
              title="The Comping Coach: play the voicing on your keyboard, get red-pen feedback"
            >
              ✍ Drill the voicing
            </button>
            <button
              type="button"
              aria-expanded={why}
              onClick={() => {
                if (!why) countOpen("study.why");
                setWhy(!why);
              }}
              className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-1 font-marker text-ink-soft hover:border-ink hover:text-ink"
            >
              Why it works <span aria-hidden>{why ? "▾" : "▸"}</span>
            </button>
          </div>
        )}

        {selected && why && (
          <div className="mt-3 space-y-4">
            <SketchRule seed={seedOf(move.id + "r")} />
            <p className="text-[15px] leading-relaxed">{move.text.theory}</p>

            <section aria-label="Melody check" className="flex flex-wrap gap-2 text-sm">
              {move.checks.melody.map((m, i) => (
                <span key={i} className="rounded-full border border-dashed border-ink-soft px-2 py-0.5">
                  melody {prettyNote(m.note)} = {prettyNote(m.role)} ✓
                </span>
              ))}
              {!move.checks.melodyVerified && (
                <span className="rounded-full border border-dashed border-wash-brick px-2 py-0.5 text-wash-brick">
                  ⚠ no melody entered here, so check it against your lead sheet
                </span>
              )}
            </section>

            {move.voiceLeading.length > 0 && (
              <section>
                <h4 className="font-marker text-sm font-bold uppercase tracking-wider text-ink-soft">Voice leading</h4>
                <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3">
                  {move.voiceLeading.map((v, i) => (
                    <li key={i}>
                      {prettyNote(v.from)} → {prettyNote(v.to)} <span className="text-ink-faint">({signed(v.semitones)})</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <MoveKeyboard move={move} />

            <SketchBox seed={seedOf(move.id + "note")} fill={wash.mustard} fillStyle="hachure" className="-rotate-1">
              <div className="bg-paper-light/80 m-1.5 p-3">
                <h4 className="font-marker text-sm font-bold uppercase tracking-wider">Recreate it</h4>
                <p className="text-[15px] leading-snug">{move.text.recreateRule}</p>
              </div>
            </SketchBox>

            {move.text.insight && (
              <p className="border-l-4 pl-3 text-[15px] leading-snug" style={{ borderColor: wash.blue }}>
                💡 {move.text.insight}
              </p>
            )}

            <DeepDive key={tuneId} tuneId={tuneId} move={move} />
          </div>
        )}

        {selected && alternatives.length > 0 && (
          <section className="mt-3">
            <h4 className="font-marker text-sm font-bold uppercase tracking-wider text-ink-soft">Also works here</h4>
            <div className="mt-1 flex flex-wrap gap-2">
              {alternatives.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick(a)}
                  className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 text-sm hover:bg-paper-shade"
                >
                  {a.title} · L{a.level}
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
    </SketchBox>
  );
}
