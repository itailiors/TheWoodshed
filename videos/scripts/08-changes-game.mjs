// Clip 8: "Make the Changes", the ear game. A Guided round: where does this chord want to go?
// The prompt's sound has a timeout fallback, so the round opens in a silent headless browser.
import { clip, modeTab } from "./lib.mjs";

await clip("08-changes-game", {}, async (page, h) => {
  await h.caption("Make the Changes: hear a chord, find where it wants to go", 0);
  await h.click(modeTab(page, "Changes"));
  await page.getByRole("heading", { level: 1, name: /Make the Changes/ }).waitFor();
  await h.wait(1800);
  await h.caption("Three levels: the landing, the setup, the staircase");
  await h.hover(page.getByRole("button", { name: /The Setup/ }).first());
  await h.wait(1500);
  await h.click(page.getByRole("group", { name: "How much help" }).getByRole("button", { name: "Guided" }));
  await h.click(page.getByRole("button", { name: "Start", exact: true }));
  const cards = page.getByRole("list", { name: "Where does it go?" }).getByRole("button");
  for (let r = 0; r < 4; r++) {
    await cards.first().waitFor();
    await page.waitForFunction(() => {
      const l = document.querySelector('[aria-label="Where does it go?"]');
      return !!l && !l.querySelector("button:disabled");
    }, null, { timeout: 15000 });
    if (r === 0) await h.caption("Guided: pick the landing from the cards (or play its root on the keys)");
    await h.wait(1200);
    // the second card on round 2, so one answer shows a miss and its explanation
    await h.click(cards.nth(r === 1 ? 1 : 0));
    await h.wait(1500);
    const why = page.getByRole("button", { name: "why?" });
    if (r < 2 && (await why.count())) {
      await h.caption(r === 0 ? "why? says what you just heard" : "A miss explains itself, then the round goes on");
      await h.click(why);
      await h.wait(3200);
    }
    const next = page.getByRole("button", { name: /^Next/ }).first();
    if (await next.count()) await h.click(next);
    await h.wait(800);
  }
  await h.caption("Points, a streak, and the keys you've landed in");
  await h.hover(page.getByText(/\d+ pts · streak \d+/));
  await h.wait(2500);
});
