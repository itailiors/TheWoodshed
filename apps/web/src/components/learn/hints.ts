/**
 * The first-run hint per screen (spec §D): one dismissible line each, shown by `FirstRunHint`.
 */
export const FIRST_RUN_HINTS = {
  study: "Each card leads with what you'll hear. Press ▶ Before / After, then open the steps.",
  coach: "Pick a concept. New ones start with a short lesson; nothing is saved until Self-check.",
  voicings: "Start with Shells: the 3rd and 7th that every other shape builds on.",
  practice: "Practice is for moves you know. ⌨ shows the shortcuts.",
  changes: "Hear the chord, then play the root of the chord it goes to. After each answer, why? says what you heard.",
} as const;

export type HintScreen = keyof typeof FIRST_RUN_HINTS;

/**
 * The demo's Study hint for a 20-second visitor (a portfolio link): what the app is, then what to
 * press. It takes the place of the Study line, so Study still shows one hint.
 */
export const DEMO_STUDY_HINT = "A deterministic engine reharmonizes this tune; each card teaches one move. Press ▶ Before / After, then open the steps.";
