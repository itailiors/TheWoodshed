import { chordTones, prettyNote, symbol, type ChordEvent, type ImprovEntry } from "@reharm/theory-core";
import { SketchBox } from "../design/rough";
import { seedOf } from "../design/tokens";
import { ChordName } from "./ChordName";
import { FUNCTION_WORD } from "./ChordMoveSelector";
import { ImprovCard } from "./ImprovCard";

/*
 * What Study's right panel shows when the chord cursor (⇧ ← →) sits on a chord the reharm leaves
 * alone: the chord itself (its function, its tones) and how to play over it, instead of whatever
 * move happened to be open before. Every note comes from theory-core.
 */
export function ChordFactsCard({ chord, entry }: { chord: ChordEvent; entry?: ImprovEntry }) {
  const tones = chordTones(chord);
  const at = `bar ${chord.at.bar}${chord.at.beat > 1 ? `.${chord.at.beat}` : ""}`;
  return (
    <div className="space-y-4" data-chord-facts={chord.id}>
      <SketchBox seed={seedOf("facts" + chord.id)} className="text-ink">
        <section className="p-4" aria-label={`The chord in ${at}`}>
          <p className="font-hand text-sm text-ink-soft">{at} · as written, no move here</p>
          <ChordName symbol={symbol(chord)} className="block text-3xl" />
          {chord.analysis && (
            <p className="mt-1 text-sm">
              <span className="font-marker">{chord.analysis.roman}</span>
              <span className="text-ink-soft"> · {FUNCTION_WORD[chord.analysis.func] ?? chord.analysis.func}</span>
            </p>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {tones.map((t) => (
              <div key={t.degree} className="flex items-baseline gap-1">
                <dt className="font-hand text-xs text-ink-soft">{t.degree}</dt>
                <dd className="font-marker">{prettyNote(t.note)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </SketchBox>
      {entry && <ImprovCard entries={[entry]} title={at} />}
    </div>
  );
}
