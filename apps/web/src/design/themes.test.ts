/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_KEY, THEMES } from "./themes";

// read from disk: vitest hands CSS imports (even `?raw`) back as an empty string
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

/** `--name: value;` pairs inside the first `{ … }` after `selector` (blocks here hold no nested rules before the vars). */
function vars(selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) return new Map();
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const rootVars = vars(":root {");
const base = new Map([...vars("@theme static"), ...rootVars]);
/** What a theme must set: every colour token, and every theme value in the plain `:root` block. */
const required = [...base.keys()].filter((k) => k.startsWith("--color-") || rootVars.has(k));
/** Textures a theme may pick from (the `html { … }` library block). */
const library = vars("html {");
/** SVG filter ids the app renders (SketchFilters). */
const filterIds = [...readFileSync(new URL("./rough.tsx", import.meta.url), "utf8").matchAll(/<filter id="([\w-]+)"/g)].map((m) => m[1]);

function themeVars(id: string): Map<string, string> {
  return id === DEFAULT_THEME ? base : vars(`:root[data-theme="${id}"]`);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** HSV saturation (0 = grey/cream, 1 = pure colour). */
function saturation(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(...c);
  return max === 0 ? 0 : (max - Math.min(...c)) / max;
}

/** Degrees between two colours' hues on the colour wheel (0–180). */
function hueGap(a: string, b: string): number {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d === 0) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const gap = Math.abs(hue(a) - hue(b));
  return Math.min(gap, 360 - gap);
}

describe("colour themes", () => {
  it("parses the default tokens", () => {
    expect(required).toEqual(expect.arrayContaining(["--color-ink", "--color-paper", "--color-pen", "--color-key-white", "--wash-blend"]));
  });

  for (const t of THEMES) {
    describe(t.id, () => {
      const v = themeVars(t.id);

      it("sets every colour token", () => {
        expect(required.filter((k) => !v.has(k))).toEqual([]);
      });

      it("has a swatch that matches its CSS", () => {
        expect(t.swatch).toEqual({ ground: v.get("--color-paper"), ink: v.get("--color-ink") });
        expect(t.chrome).toBe(v.get("--color-paper"));
      });

      it("keeps text readable on paper and on cards", () => {
        for (const ground of ["--color-paper", "--color-paper-light"]) {
          const g = v.get(ground)!;
          expect(contrast(v.get("--color-ink")!, g), `ink on ${ground}`).toBeGreaterThanOrEqual(4.5);
          for (const fg of ["--color-ink-soft", "--color-pen", "--color-sage-ink"]) {
            expect(contrast(v.get(fg)!, g), `${fg} on ${ground}`).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it("is easy on the eyes: body text 7–13:1 (strain below, halation above)", () => {
        for (const ground of ["--color-paper", "--color-paper-light"]) {
          const c = contrast(v.get("--color-ink")!, v.get(ground)!);
          expect(c, `ink on ${ground}`).toBeGreaterThanOrEqual(7);
          expect(c, `ink on ${ground}`).toBeLessThanOrEqual(13);
        }
      });

      it("keeps the pen apart from the ink (another hue, unless the ink is a near-neutral)", () => {
        const ink = v.get("--color-ink")!;
        if (saturation(ink) >= 0.4) expect(hueGap(v.get("--color-pen")!, ink)).toBeGreaterThanOrEqual(60);
        else expect(saturation(v.get("--color-pen")!)).toBeGreaterThanOrEqual(0.5);
      });

      it("keeps headings and the focus ring visible", () => {
        for (const ground of ["--color-paper", "--color-paper-light"]) {
          expect(contrast(v.get("--color-heading")!, v.get(ground)!), `heading on ${ground}`).toBeGreaterThanOrEqual(3);
          expect(contrast(v.get("--color-focus")!, v.get(ground)!), `focus on ${ground}`).toBeGreaterThanOrEqual(3);
        }
        // shaded cards and hovered pills sit behind the ring too
        expect(contrast(v.get("--color-focus")!, v.get("--color-paper-shade")!), "focus on --color-paper-shade").toBeGreaterThanOrEqual(3);
      });

      it("only uses filters and textures that exist", () => {
        for (const k of ["--wash-filter", "--wobble-filter"]) {
          const f = v.get(k)!;
          if (f !== "none") expect(filterIds, `${k}: ${f}`).toContain(f.match(/^url\(#([\w-]+)\)$/)?.[1]);
        }
        for (const k of ["--page-texture", "--page-art"]) {
          const ref = v.get(k)!.match(/^var\((--[\w-]+)\)$/)?.[1];
          if (v.get(k) !== "none") expect(library.has(ref ?? ""), `${k}: ${v.get(k)}`).toBe(true);
        }
      });

      it("draws a keyboard whose white and black keys stand apart", () => {
        expect(contrast(v.get("--color-key-white")!, v.get("--color-key-black")!)).toBeGreaterThanOrEqual(7);
        expect(contrast(v.get("--color-key-white")!, v.get("--color-key-soft")!)).toBeGreaterThanOrEqual(3);
      });

      if (t.id !== DEFAULT_THEME) {
        it("is applied before first paint by index.html", () => {
          expect(html).toContain(`"${THEME_KEY}"`);
          expect(html).toContain(`t === "${t.id}"`);
        });
      }
    });
  }
});

describe("focus ring", () => {
  it("is drawn once, in index.css, on :focus-visible (so a mouse click shows none)", () => {
    const rule = css.slice(css.indexOf(":focus-visible {"));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/outline:\s*2px solid var\(--color-focus\)/);
  });

  it("is never removed: only a programmatic focus target (tabIndex -1) may drop its outline", () => {
    const files = readdirSync(new URL("..", import.meta.url), { recursive: true, encoding: "utf8" }).filter((f) => /\.(tsx|css)$/.test(f));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(new URL(`../${f.split("\\").join("/")}`, import.meta.url), "utf8");
      for (const line of src.split("\n")) {
        if (/outline-none|outline:\s*(none|0)\b/.test(line) && !line.includes("tabIndex={-1}")) offenders.push(`${f}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
