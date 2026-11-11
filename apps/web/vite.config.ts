import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
