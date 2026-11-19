import { BAND_STYLES, DEFAULT_SWING, clampSwing, type BandStyle } from "@reharm/theory-core";

/*
 * How the band plays: the swing ratio and the band style. Tone-free (the mixer UI imports
 * it), persisted per browser, and read by the engine on every arrangement. The engine
 * subscribes, so a change re-lays the parts on the Transport and lands on the next event.
 */

const SWING_KEY = "reharm.swing";
const STYLE_KEY = "reharm.bandStyle";

export interface BandFeelSettings {
  /** Swung offbeat position, 0.5 (straight) to 0.75 (hard); 2/3 is the triplet default. */
  swing: number;
  style: BandStyle;
}

const subs = new Set<() => void>();

const read = <T,>(key: string, parse: (raw: string) => T, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
};

const isStyle = (s: string): s is BandStyle => BAND_STYLES.some((x) => x.id === s);

let settings: BandFeelSettings = {
  swing: read(SWING_KEY, (r) => clampSwing(Number(r)), DEFAULT_SWING),
  style: read(STYLE_KEY, (r) => (isStyle(r) ? r : "as-written"), "as-written" as BandStyle),
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
};

export function getBandFeel(): BandFeelSettings {
  return settings;
}

export function setSwing(ratio: number): void {
  const swing = clampSwing(ratio);
  if (swing === settings.swing) return;
  settings = { ...settings, swing };
  write(SWING_KEY, String(swing));
  subs.forEach((fn) => fn());
}

export function setBandStyle(style: BandStyle): void {
  if (style === settings.style || !isStyle(style)) return;
  settings = { ...settings, style };
  write(STYLE_KEY, style);
  subs.forEach((fn) => fn());
}

export function resetBandFeel(): void {
  setSwing(DEFAULT_SWING);
  setBandStyle("as-written");
}

export function subscribeBandFeel(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
