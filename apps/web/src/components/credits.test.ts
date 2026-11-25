import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUG_REPORT_URL, FEEDBACK_URL, feedbackReady, FONT_CREDITS, SAMPLE_CREDITS } from "./credits";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// band.ts imports Tone, so its lists are read from the source rather than imported
const band = read("../audio/band.ts");
const list = (name: string) => [...new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(band)![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const BASS_SOUNDFONTS = list("BASS_SOUNDFONTS").map((f) => `https://gleitz.github.io/midi-js-soundfonts/${f}/`);
const DRUM_KITS = list("DRUM_KITS");

describe("credits", () => {
  it("credits every bass soundfont and drum kit the band loads", () => {
    const names = SAMPLE_CREDITS.map((c) => c.work.replace(/\s/g, "").toLowerCase());
    for (const url of BASS_SOUNDFONTS) {
      const font = /midi-js-soundfonts\/([^/]+)\//.exec(url)![1].replace(/_GM$/, "").toLowerCase();
      expect(names.some((n) => n.includes(font)), url).toBe(true);
    }
    for (const kit of DRUM_KITS) {
      const font = /^0_([A-Za-z0-9]+)_/.exec(kit)![1].toLowerCase();
      expect(names.some((n) => n.includes(font) && n.includes("drum")), kit).toBe(true);
    }
  });

  it("only loads drum kits whose licence is established", () => {
    expect(DRUM_KITS.some((k) => /JCLive|SBLive/.test(k))).toBe(false);
  });

  it("credits every Google Font index.html loads", () => {
    const href = /fonts\.googleapis\.com\/css2\?([^"]+)"/.exec(read("../../index.html"))![1];
    const families = [...href.matchAll(/family=([^:&]+)/g)].map((m) => m[1].replace(/\+/g, " "));
    expect(families.length).toBeGreaterThan(0);
    for (const f of families) expect(FONT_CREDITS.map((c) => c.work)).toContain(f);
  });

  it("bug reports open a GitHub issue template that exists", () => {
    const tpl = /template=([^&]+)/.exec(BUG_REPORT_URL)![1];
    expect(BUG_REPORT_URL.startsWith("https://github.com/itailiors/reharm-lab/issues/new")).toBe(true);
    expect(read(`../../../../.github/ISSUE_TEMPLATE/${tpl}`)).toMatch(/^name:/m);
  });

  it("the feedback link shows only once a real Tally form URL is set", () => {
    expect(feedbackReady("https://tally.so/r/TODO-feedback-form")).toBe(false);
    expect(feedbackReady("https://tally.so/r/w4bXyZ")).toBe(true);
    expect(feedbackReady("https://example.com/r/w4bXyZ")).toBe(false);
    // the README footer and the app must point at the same form
    if (feedbackReady()) expect(read("../../../../README.md")).toContain(FEEDBACK_URL);
  });
});
