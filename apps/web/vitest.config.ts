import { defineConfig } from "vitest/config";

// Plain-TypeScript tests only (no DOM, no React plugin): kept apart from vite.config.ts so
// the Tailwind and React plugins don't load for them.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
