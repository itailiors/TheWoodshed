// Scouting pass: a screenshot of every mode at 1280x720, to plan the shots. Run: node videos/scripts/explore.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4174";
const out = (n) => `videos/shots/${n}.png`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE);
await page.getByRole("heading", { level: 1 }).first().waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: out("study") });
await page.screenshot({ path: out("study-full"), fullPage: true });
for (const tab of ["Practice", "Coach", "Changes", "Voicings"]) {
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: tab }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out(tab.toLowerCase()) });
  await page.screenshot({ path: out(tab.toLowerCase() + "-full"), fullPage: true });
}
await browser.close();
