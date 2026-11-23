import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Rule 12: Tone.js loads only with the lazy audio chunk. `engine.ts` and `band.ts` are the only modules
 * that import `tone`, and nothing else imports a VALUE from `band.ts` or `engine.ts` (types are erased;
 * `player.ts` reaches the engine with a dynamic import, `ghostSax.ts` reaches band the same way).
 * A static value import anywhere else pulls Tone into the entry chunk: in Nov 2026 the mixer did, ~250 kB.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
/** Static imports that bring values: `import type { … }` is erased, so it's allowed. */
const valueImports = (src: string) =>
  [...code(src).matchAll(/^\s*import\s+(?!type\s)([\s\S]*?)\s+from\s+["']([^"']+)["']/gm)].map((m) => m[2]);

/** `bandTone.ts` (the band's EQ/glue stage) is imported only by `engine.ts`. */
const AUDIO_CHUNK = new Set(["audio/engine.ts", "audio/band.ts", "audio/bandTone.ts"]);

describe("Tone.js stays in the lazy audio chunk (rule 12)", () => {
  const all = files(SRC).map((f) => ({ rel: relative(SRC, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }));

  it("only the audio chunk (engine.ts, band.ts, bandTone.ts) imports tone", () => {
    const importers = all.filter((f) => valueImports(f.src).includes("tone")).map((f) => f.rel);
    expect(importers.sort()).toEqual([...AUDIO_CHUNK].sort());
  });

  it("main.tsx imports quietTone first, so TONE_SILENCE_LOGGING is set before Tone can load", () => {
    const main = all.find((f) => f.rel === "main.tsx")!;
    const first = code(main.src).match(/^\s*import\s+["']([^"']+)["']/m);
    expect(code(main.src).trimStart().startsWith(`import "./audio/quietTone"`)).toBe(true);
    expect(first?.[1]).toBe("./audio/quietTone");
  });

  it("nothing outside the audio chunk imports a value from band.ts, bandTone.ts or engine.ts", () => {
    const leaks = all
      .filter((f) => !AUDIO_CHUNK.has(f.rel))
      .flatMap((f) => valueImports(f.src).filter((p) => /(^|\/)(band|bandTone|engine)$/.test(p) && !p.includes("@reharm")).map((p) => `${f.rel} → ${p}`));
    expect(leaks).toEqual([]);
  });
});
