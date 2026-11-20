import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Grader isolation (PLAN safety rule 3): a lesson must never reach a drill, the chord-strike
 * grouper, the drill session or any path that saves a run. Structural: no file in this folder
 * may name them in an import or a call.
 */
const DIR = fileURLToPath(new URL(".", import.meta.url));
const FORBIDDEN = [/CoachDrill/, /useChordStrikes/, /useDrillSession/, /drillSession/, /library\/practice/, /savePractice|saveRun|postPractice/, /\.strike\(/, /ImprovHeatmap/];

describe("components/learn grader isolation", () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));

  it("covers the stepper, the note, the chip and their helpers", () => {
    for (const f of ["LessonStepper.tsx", "PrereqNote.tsx", "GlossaryChip.tsx", "lessonAudio.ts", "useTapAnswer.ts"]) expect(files).toContain(f);
  });

  it.each(files)("%s imports nothing that grades or saves", (f) => {
    const src = readFileSync(join(DIR, f), "utf8");
    const imports = src.match(/^import[^;]+;/gm) ?? [];
    for (const re of FORBIDDEN) {
      expect(imports.filter((l) => re.test(l)), `${f}: ${re}`).toEqual([]);
      // nor names them in code (a comment saying what it never imports is fine)
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(re.test(code), `${f}: ${re}`).toBe(false);
    }
  });
});
