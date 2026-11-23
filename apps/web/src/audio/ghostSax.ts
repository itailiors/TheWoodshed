/*
 * The Ghost Master's saxophone, without Tone.js: a stand-in that loads `band.ts` (and Tone, in the lazy
 * audio chunk) on first use, so the improv heatmap can sit in the entry chunk (rule 12). Calls made while
 * it loads run in order once it's in; after that each call is one resolved-promise hop.
 */

type Band = typeof import("./band");
let band: Promise<Band> | null = null;
const load = () => (band ??= import("./band"));

export const ghostSax = {
  play(midiOrVoicing: number | number[], durSeconds: number, delaySeconds = 0, vel = 0.72): void {
    void load().then((b) => b.ghostSax.play(midiOrVoicing, durSeconds, delaySeconds, vel));
  },
  /** Nothing to release until the synth has been loaded by a play. */
  release(): void {
    if (band) void band.then((b) => b.ghostSax.release());
  },
};
