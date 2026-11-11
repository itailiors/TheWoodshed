import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";

// Load apps/api/.env (Node 22 built-in; no dotenv needed). Must run before explain.ts reads env.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // no .env file: fine if the key comes from the shell or an `ant auth login` profile
}

const { createApp } = await import("./app");
const { MODEL } = await import("./explain");

// DEMO_MODE=true (hosting) or --demo (local, works in every shell)
const demo = process.env.DEMO_MODE === "true" || process.argv.includes("--demo");
const { app, dbFile } = await createApp({ demo });

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () =>
  console.log(
    demo
      ? `api listening on http://localhost:${port}/api · READ-ONLY DEMO (no database, no Anthropic calls)`
      : `api listening on http://localhost:${port}/api · db ${dbFile} · model ${MODEL} · key ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"}`,
  ),
);
