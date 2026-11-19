/*
 * Colour schemes. A theme is only a set of CSS variable values: `index.css` holds one
 * `:root[data-theme="…"]` block per theme, and everything that draws (Tailwind classes,
 * inline styles, Rough.js sketches via `tokens.ts`) reads those variables. So switching
 * is one attribute on <html>: no re-render, and new components are themed for free as
 * long as they use the tokens instead of raw hex. `themes.test.ts` checks every theme
 * defines every colour and keeps text readable.
 */
import { useSyncExternalStore } from "react";

export type ThemeId = "ink" | "northgate" | "panam";

export interface Theme {
  id: ThemeId;
  label: string;
  title: string;
  /** Swatch for the switch: page and ink, as raw hex (the switch shows every theme at once). */
  swatch: { ground: string; ink: string };
  /** Browser chrome colour (`<meta name="theme-color">`). */
  chrome: string;
}

export const THEMES: readonly Theme[] = [
  {
    id: "ink",
    label: "Ink & Parchment",
    title: "Ink & Parchment: blue ink on old manuscript paper (the default)",
    swatch: { ground: "#f6e9c9", ink: "#1e2a78" },
    chrome: "#f6e9c9",
  },
  {
    id: "northgate",
    label: "Northgate",
    title: "Northgate: the club at night, parchment on warm charcoal with a poster-red pen",
    swatch: { ground: "#1c1916", ink: "#e2d5bb" },
    chrome: "#1c1916",
  },
  {
    id: "panam",
    label: "Panam",
    title: "Panam: deep red ink on cream, with teal and gold shards",
    swatch: { ground: "#f5e6d3", ink: "#6b1016" },
    chrome: "#f5e6d3",
  },
];

export const DEFAULT_THEME: ThemeId = "ink";
/** Also read by the inline script in index.html (before first paint); keep the two in step. */
export const THEME_KEY = "reharm.theme";

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

function read(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

let current: ThemeId = typeof window === "undefined" ? DEFAULT_THEME : read();
const listeners = new Set<() => void>();

/** Stamp the theme on <html>. The default theme has no attribute, so the base tokens apply untouched. */
function apply(id: ThemeId) {
  const root = document.documentElement;
  if (id === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", THEMES.find((t) => t.id === id)!.chrome);
}

export function setTheme(id: ThemeId) {
  current = id;
  apply(id);
  try {
    if (id === DEFAULT_THEME) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, id);
  } catch {
    /* storage unavailable: the theme still applies for this visit */
  }
  listeners.forEach((l) => l());
}

/** Call once at startup (index.html already stamped it; this syncs the meta colour and drops unknown ids). */
export function installTheme() {
  apply(current);
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => DEFAULT_THEME,
  );
}
