/**
 * Continuous controllers → the reharm dial.
 *
 * A pedal or mod wheel sends 0–127; the dial has five stops (L0–L4). Plain quantising would
 * flicker: a foot resting on a band edge jitters by a unit or two and the harmony would
 * flip back and forth every few milliseconds. So the mapping has hysteresis: to leave the
 * current level, the value has to travel `margin` units past that level's band edge.
 *
 * Guarantees (property-tested):
 * - 0 is always L0 and 127 is always the top level, whatever the previous level;
 * - a slow sweep up (or down) visits every level once, in order;
 * - values that stay inside any window narrower than 2 × margin change the level at most once (no flicker);
 * - well away from an edge it's plain quantising, so the dial and the pedal agree.
 */

/** Standard controller numbers that can drive the dial. */
export const DIAL_CONTROLLERS = { modWheel: 1, expression: 11 } as const;

export const PEDAL_MARGIN = 6;

export function pedalToLevel(value: number, prev: number | null, levels = 5, margin = PEDAL_MARGIN): number {
  const v = Math.min(127, Math.max(0, value));
  const band = 128 / levels;
  const raw = Math.min(levels - 1, Math.floor(v / band));
  if (prev === null || raw === prev) return raw;
  const upper = (prev + 1) * band; // where the next band starts
  const lower = prev * band; // where this band starts
  if (raw > prev && v >= Math.min(upper + margin, 127)) return raw;
  if (raw < prev && v <= Math.max(lower - margin, 0)) return raw;
  return prev;
}

/** Where a level's band sits, as fractions of the controller's travel (for drawing the dial's track). */
export function levelBand(level: number, levels = 5): { from: number; to: number } {
  return { from: level / levels, to: (level + 1) / levels };
}
