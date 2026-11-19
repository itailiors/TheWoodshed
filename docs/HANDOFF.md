# Handoff (2026-11-19, session 2)

## Goal
Launch polish for the public demo (itailiors.github.io/TheWoodshed), working down `docs/STATE_OF_THE_UNION.md` §5 and Itai's Notion idea list. This session: the "Red Northgate theme" idea, as a colour-scheme slider.

## Done this session (pushed to origin/main)
- `b97392c` feat(web): colour schemes (Northgate, Panam) with a theme slider. Read the commit message for the design; key files `apps/web/src/design/themes.ts`, `components/ThemeSwitch.tsx`, `design/tokens.ts`, `index.css`.
- `948444d` feat(web): theme textures, heading styles and focus rings ("Tier 1": CSS variables only).
- Checks at last run: typecheck clean; tests 188 theory-core + 20 API + 33 web, all passing. CI and the Pages deploy for the push were not checked.

## In progress
Nothing. `docs/HANDOFF.md` is the only uncommitted file. The Notion "Red Northgate theme" idea is not ticked yet; Itai hasn't said yes or no (memory `notion-woodshed-page.md` has the page mapping).

## Next 3 steps (Itai picks)
1. Tick the theme idea in Notion (ask first), and add a README/STATE_OF_THE_UNION line about themes.
2. Theme Tier 2, only if Itai asks: per-theme sketch hand (roughness, bowing, hachure angle) applied centrally in `useRough` (`design/rough.tsx`), with the theme as a dependency and the ImprovHeatmap node cache cleared on switch. Itai chose Tier 1 only for now.
3. From the earlier list: Changes Level 4 (minor ii–V, memory `changes-game-decisions.md`), silence Tone's banner, colour-blind heatmap shapes, or the Notion ideas (prev/next chord in Study, two-hand voicings, Standard of the Day).

## Decisions + why
- `tokens.ts` exports `var(--color-…)` strings, not hex: SVG attributes resolve `var()`, so Rough.js sketches and inline styles follow the theme with no re-render. Translucent colours use `tint()` (color-mix), never hex-alpha concatenation.
- A theme is one `:root[data-theme=…]` block in `index.css`; the default (Ink & Parchment) has no attribute and is visually unchanged apart from a themed focus ring.
- Keyboards use separate `keys.*` tokens, since dark themes swap paper and ink and the piano must still read as ivories and ebonies.
- Comfort rules, enforced by `themes.test.ts`: body ink 7–13:1 on page and cards (strain below, halation above); pen a different hue from coloured ink; headings and focus ring at least 3:1; key contrast; every theme sets every value; named filters and textures exist.
- Panam became red ink on the cover's cream (with a slate-blue pen), not a red page: Itai found the red ground hard on the eyes. Northgate is parchment on warm charcoal, not cream on black.
- The slider lives inside `ModeSwitch`, so every page with mode tabs gets it. The choice persists in `reharm.theme` and is stamped before first paint by an inline script in `apps/web/index.html` (ids are listed there too; the test checks).
- Fonts per theme (Tier 3) were rejected: the lead sheet, HUD and headings are sized for the current hand fonts.

## Gotchas
- Vitest returns CSS imports (even `?raw`) as an empty string; the theme test reads files with `node:fs`.
- `@theme static` is required so every colour variable is emitted even when no utility uses it.
- `.wash` (multiply/screen blend) is shared with the Original stamp; the lead-sheet wash filter lives on a separate `.wash-shapes` class so the stamp doesn't get watercoloured.
- `.ink-wobble` takes `var(--wobble-filter)`, but many icons use `filter="url(#ink-wobble)"` attributes and stay unthemed on purpose.
- Strong brush displacement garbles small headings ("THE I" read as "THE !"); keep `#ink-brush` gentle.
- Panam's corner shards can sit behind unfilled move cards; keep their opacity low.
- Verify in the static demo (`npm run build:demo`, launch config `web-demo-build` :4174); rebuild after each change. Old console errors from earlier bundles persist in the pane: check the bundle hash.

## Suggested skills
- `ship` when Itai says "commit and push".
- `run` or the built-in browser to check theme work in the demo build.
- `mattpocock-skills:grilling` before scoping Theme Tier 2 or the Notion ideas.
- `mattpocock-skills:tdd` for Changes Level 4.
