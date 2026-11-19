/** Shared by the Coach drill and the Voicings tab: how a phone lays out the keys a chord needs. */

const isBlackKey = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

/** White keys from `a` to `b`, inclusive. */
export const whiteCount = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i).filter((m) => !isBlackKey(m)).length;

/**
 * The keyboard for a phone: just the notes in play (two semitones of room either side,
 * snapped to white keys) and, when that's more than ~10 white keys, two rows split at a C or
 * an F near the middle, so every key stays wide enough to tap.
 */
export function phoneKeyboardRows(notes: number[]): { low: number; high: number }[] {
  const black = isBlackKey;
  let low = Math.max(21, Math.min(...notes) - 2);
  let high = Math.min(108, Math.max(...notes) + 2);
  while (black(low)) low--;
  while (black(high)) high++;
  if (high - low < 12) high = low + 12 + (black(low + 12) ? 1 : 0); // at least an octave to play in
  const whites = whiteCount;
  if (whites(low, high) <= 10) return [{ low, high }];
  // split at a C or an F (white keys whose neighbour below is white too, so each row starts and
  // ends on a white key): the one that balances the rows best
  const cuts = Array.from({ length: high - low }, (_, i) => low + 1 + i).filter((m) => m % 12 === 0 || m % 12 === 5);
  if (!cuts.length) return [{ low, high }];
  const balance = (c: number) => Math.min(whites(low, c - 1), whites(c, high));
  const c = cuts.reduce((best, x) => (balance(x) > balance(best) ? x : best));
  return [
    { low, high: c - 1 },
    { low: c, high },
  ];
}
