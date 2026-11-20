/**
 * The first-run hint per screen (spec §D): one dismissible line each, shown by `FirstRunHint`.
 * Study keeps its own inline one (`hint.study`).
 */
export const FIRST_RUN_HINTS = {
  coach: "Pick a concept. New ones start with a short lesson; nothing is saved until Self-check.",
  voicings: "Start with Shells: the 3rd and 7th that every other shape builds on.",
  practice: "Practice is for moves you know. ⌨ shows the shortcuts.",
  changes: "Hear the chord, then play the root of the chord it goes to. After each answer, why? says what you heard.",
} as const;

export type HintScreen = keyof typeof FIRST_RUN_HINTS;
