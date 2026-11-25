import { BAND_STYLES, DEFAULT_SWING, VOICING_STYLES, clampSwing, type BandStyle, type VoicingStyle } from "@reharm/theory-core";

/*
 * How the band plays: the swing ratio, the band style and the comping pianist's voicing
 * style. Tone-free (the mixer UI imports it), persisted per browser, and read by the engine
 * on every arrangement. The engine subscribes, so a change re-lays the parts on the
 * Transport and lands on the next event.
 */

const SWING_KEY = "reharm.swing";
const STYLE_KEY = "reharm.bandStyle";
const VOICING_KEY = "reharm.voicingStyle";
const TONE_KEY = "reharm.bandTone";

/** The band's mix: "clean" is the original, "warm" a darker, glued small-group sound (experimental). */
export type BandTone = "clean" | "warm";
export const BAND_TONES: readonly { id: BandTone; label: string; hint: string }[] = [
  { id: "clean", label: "Clean", hint: "Bright and dry: every cymbal stroke in the open." },
  { id: "warm", label: "Warm club (experimental)", hint: "Dark ride, round bass up front, the band glued together." },
];
const isTone = (s: string): s is BandTone => BAND_TONES.some((x) => x.id === s);

export interface BandFeelSettings {
  /** Swung offbeat position, 0.5 (straight) to 0.75 (hard); 2/3 is the triplet default. */
  swing: number;
  style: BandStyle;
  /** How the comping piano lays its chords out ("close" is the engine's default). */
  voicing: VoicingStyle;
  tone: BandTone;
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
const isVoicing = (s: string): s is VoicingStyle => VOICING_STYLES.some((x) => x.id === s);

let settings: BandFeelSettings = {
  swing: read(SWING_KEY, (r) => clampSwing(Number(r)), DEFAULT_SWING),
  style: read(STYLE_KEY, (r) => (isStyle(r) ? r : "as-written"), "as-written" as BandStyle),
  voicing: read(VOICING_KEY, (r) => (isVoicing(r) ? r : "close"), "close" as VoicingStyle),
  tone: read(TONE_KEY, (r) => (isTone(r) ? r : "clean"), "clean" as BandTone),
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

export function setVoicingStyle(voicing: VoicingStyle): void {
  if (voicing === settings.voicing || !isVoicing(voicing)) return;
  settings = { ...settings, voicing };
  write(VOICING_KEY, voicing);
  subs.forEach((fn) => fn());
}

export function setBandTone(tone: BandTone): void {
  if (tone === settings.tone || !isTone(tone)) return;
  settings = { ...settings, tone };
  write(TONE_KEY, tone);
  subs.forEach((fn) => fn());
}

export function resetBandFeel(): void {
  setSwing(DEFAULT_SWING);
  setBandStyle("as-written");
  setVoicingStyle("close");
  setBandTone("clean");
}

export function subscribeBandFeel(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
