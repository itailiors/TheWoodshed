import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end golden paths, run against the STATIC DEMO BUILD only (`apps/web/dist-demo`).
 * The demo build makes no `/api` requests and never writes, so these tests can't touch the
 * real practice database. `npm run e2e` builds the demo first; see e2e/README.md.
 *
 * Port 4175: clear of the dev server (5173), the API (8787) and the `web-demo-build` preview (4174).
 */
const PORT = 4175;

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run preview -w @reharm/web -- --outDir dist-demo --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // never reuse: a server already on this port could be serving a stale or non-demo build
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
