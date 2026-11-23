/**
 * Tone.js logs its version banner when its `core/Global` module first evaluates, unless
 * `window.TONE_SILENCE_LOGGING` is already set. Tone is lazy (engine.ts), so setting the flag
 * here, as main.tsx's first import, runs long before it loads. Dev keeps the banner.
 * Tone-free on purpose: importing this must never pull Tone into the main chunk.
 */
if (!import.meta.env.DEV && typeof window !== "undefined") {
  (window as Window & { TONE_SILENCE_LOGGING?: boolean }).TONE_SILENCE_LOGGING = true;
}

export {};
