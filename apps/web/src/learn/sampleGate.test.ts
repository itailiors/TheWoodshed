import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Rule 11: the demo's sample notebook never drives anything of the player's own. One place decides
 * it (`ownProgressOnly` in pathStates.ts); everything else may read `.sample` only to LABEL the
 * sample. Structural: a new reader of `.sample` has to be added here on purpose.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const ALLOWED = new Set([
  "learn/pathStates.ts", // the gate itself
  "components/learn/PathView.tsx", // "The sample notebook isn't counted."
  "components/progress/PracticeDashboard.tsx", // the sample banner; the local-storage notice for your own
  "components/coach/CoachPage.tsx", // the clean-in line's sample label
]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("the sample notebook has one gate", () => {
  it("only pathStates.ts and the display labels read `.sample`", () => {
    const readers = files(SRC)
      .filter((p) => /\?\.sample\b|\.sample\b(?!Rate)/.test(readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")))
      .map((p) => relative(SRC, p).replace(/\\/g, "/"));
    expect(readers.filter((r) => !ALLOWED.has(r))).toEqual([]);
    expect(readers).toContain("learn/pathStates.ts");
  });
});
