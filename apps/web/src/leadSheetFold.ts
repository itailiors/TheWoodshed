/*
 * Study on a phone: the lead sheet (two bars a line) is about 1,000 px tall, which pushed the
 * first move card 2+ screens down. Folded, it draws bars 1–4 and a "Show all N bars" button.
 * It opens on its own whenever there's something to see past bar 4: the band is playing (the
 * playhead walks the whole form), or you opened a move or a chord out there.
 */

/** Bars a folded lead sheet draws: two systems of two. */
export const FOLD_BARS = 4;

export interface FoldInput {
  /** Phone-width layout (`useNarrow`). Wider screens never fold. */
  narrow: boolean;
  /** Bars in the form. */
  bars: number;
  /** The player pressed "Show all N bars". */
  open: boolean;
  /** The band is playing. */
  playing: boolean;
  /** The last bar of what the player chose to look at (an opened move, the chord cursor), if anything. */
  focusBar: number | null;
}

/** Folding hides at least a line: a 6-bar tune keeps all its bars. */
export const foldable = ({ narrow, bars }: Pick<FoldInput, "narrow" | "bars">) => narrow && bars > FOLD_BARS + 2;

/** Something past the fold needs the whole sheet, so the fold button has nothing to do. */
export const forcedOpen = ({ playing, focusBar }: Pick<FoldInput, "playing" | "focusBar">) =>
  playing || (focusBar != null && focusBar > FOLD_BARS);

/** The last bar the lead sheet draws. */
export function lastShownBar(f: FoldInput): number {
  if (!foldable(f) || f.open || forcedOpen(f)) return f.bars;
  return FOLD_BARS;
}
