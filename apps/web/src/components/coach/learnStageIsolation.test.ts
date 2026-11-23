import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Grader isolation on Coach's Learn stage (PLAN safety rule 3). Structural: the files the Learn
 * stage is made of never name a drill, the chord-strike grouper, the drill session or a saving
 * path, and the page renders the Learn stage and the drill as alternatives, never side by side.
 * (e2e/coach.spec.ts plays notes through every Learn step and checks nothing was saved.)
 */
const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const FORBIDDEN = [/CoachDrill/, /useChordStrikes/, /useDrillSession/, /drillSession/, /library\/practice/, /savePractice|saveRun|saveCoachRun|postPractice/, /\.strike\(/, /ImprovHeatmap/, /noteBus/];

describe("Coach's Learn stage mounts nothing that grades or saves", () => {
  it.each(["./LearnStage.tsx", "./coachLesson.ts", "./StageLadder.tsx"])("%s names nothing that grades or saves", (f) => {
    const src = code(read(f));
    for (const re of FORBIDDEN) expect(re.test(src), `${f}: ${re}`).toBe(false);
  });

  it("CoachPage renders the Learn stage INSTEAD of the drill (one ternary, Learn first)", () => {
    // whitespace dropped, so a Prettier reflow can't break the token checks
    const raw = code(read("./CoachPage.tsx"));
    const src = raw.replace(/\s+/g, "");
    const learnAt = src.search(/stage===["']learn["']&&learn\?/);
    const stageAt = src.indexOf("<LearnStage", learnAt);
    const drillAt = src.indexOf("<CoachDrill", learnAt);
    expect(learnAt, "the Learn branch").toBeGreaterThan(0);
    expect(stageAt).toBeGreaterThan(learnAt);
    // the drill sits in a later branch of the same conditional, after the Learn stage's
    expect(drillAt).toBeGreaterThan(stageAt);
    expect(raw.match(/<CoachDrill\b/g)).toHaveLength(1);
    expect(raw.match(/<LearnStage\b/g)).toHaveLength(1);
  });

  it("the drill hears strikes only when the stage says so", () => {
    const src = code(read("./CoachDrill.tsx"));
    expect(src.replace(/\s+/g, "")).toMatch(/useChordStrikes\(\w+,stageMode\.strikes\)/);
    expect(src).not.toMatch(/useGradingMode|coachGrading/);
  });
});
