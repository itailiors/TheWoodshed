import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { GOATCOUNTER_URL } from "./src/components/credits";

/** GoatCounter visit counts, in the static demo build only (`--mode demo`); see credits.ts. */
const goatCounter = (mode: string): Plugin => ({
  name: "reharm-goatcounter",
  apply: "build",
  transformIndexHtml: () =>
    mode === "demo"
      ? [{ tag: "script", attrs: { "data-goatcounter": GOATCOUNTER_URL, async: true, src: "https://gc.zgo.at/count.js" }, injectTo: "body" }]
      : [],
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), goatCounter(mode)],
  build: {
    rollupOptions: {
      output: {
        // React changes far less often than the app: its own chunk stays cached across deploys.
        // (Tone.js, Rough.js and the lazy screens split themselves via dynamic import().)
        manualChunks(id) {
          if (/[\/]node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return "react";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
}));
