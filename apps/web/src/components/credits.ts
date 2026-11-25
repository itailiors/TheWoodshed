/*
 * Every third-party asset the app loads, with its attribution and licence. One list for the
 * ⚙ "Credits & licences" card; docs/licences.md records where each licence was checked.
 */

export interface Credit {
  /** What it is, as the attribution reads. */
  work: string;
  /** Author or maker. */
  by: string;
  /** What the app uses it for. */
  usedFor: string;
  licence: string;
  licenceUrl: string;
  /** Where the asset (or its notice) lives. */
  sourceUrl: string;
}

const CC_BY_3 = "https://creativecommons.org/licenses/by/3.0/";
const CC_BY_SA_3 = "https://creativecommons.org/licenses/by-sa/3.0/";
const OFL = "https://openfontlicense.org/";
const MIT_FLUID = "https://github.com/musescore/MuseScore/blob/master/share/sound/FluidR3Mono_License.md";
const GLEITZ = "https://github.com/gleitz/midi-js-soundfonts";

export const SAMPLE_CREDITS: Credit[] = [
  {
    work: "Salamander Grand Piano",
    by: "Alexander Holm (via Tone.js)",
    usedFor: "piano",
    licence: "CC BY 3.0",
    licenceUrl: CC_BY_3,
    sourceUrl: "https://github.com/Tonejs/audio/tree/master/salamander",
  },
  {
    work: "Musyng Kite soundfont, acoustic bass",
    by: "rendered by Benjamin Gleitzman's midi-js-soundfonts",
    usedFor: "bass",
    licence: "CC BY-SA 3.0",
    licenceUrl: CC_BY_SA_3,
    sourceUrl: GLEITZ,
  },
  {
    work: "Fluid R3 GM soundfont, acoustic bass",
    by: "Frank Wen; rendered by midi-js-soundfonts",
    usedFor: "bass (fallback)",
    licence: "CC BY 3.0 / MIT",
    licenceUrl: MIT_FLUID,
    sourceUrl: GLEITZ,
  },
  {
    work: "FatBoy soundfont, acoustic bass",
    by: "rendered by midi-js-soundfonts",
    usedFor: "bass (fallback)",
    licence: "CC BY-SA 3.0",
    licenceUrl: CC_BY_SA_3,
    sourceUrl: GLEITZ,
  },
  {
    work: "Fluid R3 GM drum kit",
    by: "Frank Wen; converted by Sergey Surikov's WebAudioFont",
    usedFor: "drums",
    licence: "MIT",
    licenceUrl: MIT_FLUID,
    sourceUrl: "https://github.com/surikov/webaudiofontdata",
  },
];

export const FONT_CREDITS: Credit[] = [
  {
    work: "Architects Daughter",
    by: "Kimberly Geswein",
    usedFor: "handwritten text",
    licence: "SIL OFL 1.1",
    licenceUrl: OFL,
    sourceUrl: "https://fonts.google.com/specimen/Architects+Daughter",
  },
  {
    work: "Kalam",
    by: "Indian Type Foundry",
    usedFor: "headings",
    licence: "SIL OFL 1.1",
    licenceUrl: OFL,
    sourceUrl: "https://fonts.google.com/specimen/Kalam",
  },
  {
    work: "Noto Music",
    by: "The Noto Project Authors",
    usedFor: "music symbols",
    licence: "SIL OFL 1.1",
    licenceUrl: OFL,
    sourceUrl: "https://fonts.google.com/noto/specimen/Noto+Music",
  },
];

export const REPO_URL = "https://github.com/itailiors/reharm-lab";
/**
 * The feedback form (a free Tally form). The one place its URL lives; the README's footer repeats it.
 * TODO(Itai): replace the placeholder with the Tally form's share link (https://tally.so/r/…) and
 * update the README footer. Until then the ⚙ "Send feedback" link stays hidden.
 * Opens Tally in a new tab; the app itself sends nothing.
 */
export const FEEDBACK_URL = "https://tally.so/r/TODO-feedback-form";
export const feedbackReady = (url: string = FEEDBACK_URL) => /^https:\/\/tally\.so\/r\/[A-Za-z0-9]+$/.test(url);
/** Bug reports for developers: a GitHub issue from `.github/ISSUE_TEMPLATE/bug.yml`. */
export const BUG_REPORT_URL = `${REPO_URL}/issues/new?template=bug.yml`;
export const CODE_NOTICE = "© Itai Lior, all rights reserved. Samples and fonts are under their own licences.";
