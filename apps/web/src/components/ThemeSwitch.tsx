import { setTheme, THEMES, useTheme } from "../design/themes";

/**
 * The colour-scheme slider: three swatches in a pill, an ink ring slides to the chosen one.
 * Equal columns with no gap, so the ring moves by exactly its own width (translateX(n×100%))
 * whatever size the buttons grow to on touch screens.
 */
export function ThemeSwitch() {
  const theme = useTheme();
  const idx = Math.max(0, THEMES.findIndex((t) => t.id === theme));
  return (
    <div role="radiogroup" aria-label="Colour scheme" className="relative grid shrink-0 grid-cols-3 rounded-full border-2 border-ink p-0.5">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full border-2 border-ink motion-safe:transition-transform motion-safe:duration-200"
        style={{ width: "calc((100% - 0.25rem) / 3)", transform: `translateX(${idx * 100}%)` }}
      />
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={t.id === theme}
          aria-label={t.label}
          title={t.title}
          onClick={() => setTheme(t.id)}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full"
        >
          <span
            aria-hidden
            className="block h-4 w-4 -rotate-12 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${t.swatch.ground} 0 50%, ${t.swatch.ink} 50% 100%)`,
              boxShadow: `0 0 0 1.5px currentColor`,
            }}
          />
        </button>
      ))}
    </div>
  );
}
