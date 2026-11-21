// Record every clip in order: node videos/scripts/record-all.mjs [filter]
// Needs the static demo build served on :4174 (npm run build:demo, then the web-demo-build preview),
// or BASE=http://localhost:<port>.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const filter = process.argv[2] ?? "";
const clips = readdirSync("videos/scripts").filter((f) => /^\d\d-.*\.mjs$/.test(f) && f.includes(filter)).sort();
const failed = [];
for (const f of clips) {
  try {
    execFileSync(process.execPath, [`videos/scripts/${f}`], { stdio: "inherit" });
  } catch {
    failed.push(f);
  }
}
if (failed.length) {
  console.error(`failed: ${failed.join(", ")}`);
  process.exit(1);
}
