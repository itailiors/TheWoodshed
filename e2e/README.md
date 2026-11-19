# End-to-end golden paths (Playwright)

```bash
npx playwright install chromium   # once per machine
npm run e2e                       # builds the demo, then runs the suite
npm run e2e:nobuild               # reuse the last apps/web/dist-demo
npx playwright test --ui          # debug interactively
```

- Runs against the **static demo build** only (`apps/web/dist-demo`), served by `vite preview` on **:4175**, so it can't clash with the dev server (5173), the API (8787) or the `web-demo-build` preview (4174), and it never touches the real database.
- `fixtures.ts`: every test fails if the page requests `/api` (rule 11). `installFakeMidi` is the CLAUDE.md fake-MIDI recipe as an init script; it leaves `window.__fakeMidi.send(bytes)` and `.unplug()`.
- Nothing asserts on sound: headless Chromium has no audio output. The Changes game's prompt has a timeout fallback, so it doesn't need audio either.
- Output (traces of failed tests) goes to `e2e/.results/`, which is gitignored.
