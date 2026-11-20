import { chipSegments, type ChipOptions, type Segment } from "./chipText";
import { GlossaryChip } from "./GlossaryChip";

interface Props extends Omit<ChipOptions, "seen"> {
  text?: string;
  /**
   * Segments already split (`chipLines` over every line of a view, so a term is chipped at its
   * first use in the view only). Without them `text` is split on its own.
   */
  segments?: Segment[];
  onLearn?: (conceptId: string) => void;
}

/**
 * A line of copy with its chips (spec §D): the named glossary terms, the roman numerals and
 * chord symbols, each chipped at its first use. The text reads exactly as written; chips hold
 * plain text only, so they add no element (or disclosure level) inside the line. Pure render:
 * the split never depends on what an earlier render chipped (StrictMode renders twice).
 */
export function GlossText({ text = "", segments, terms, numerals, symbols, onLearn }: Props) {
  const segs = segments ?? chipSegments(text, { terms, numerals, symbols });
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "text" ? (
          s.text
        ) : s.kind === "term" ? (
          <GlossaryChip key={i} term={s.term} onLearn={onLearn}>
            {s.text}
          </GlossaryChip>
        ) : (
          <GlossaryChip key={i} symbol={s.text} />
        ),
      )}
    </>
  );
}
