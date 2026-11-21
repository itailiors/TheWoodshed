// Clip 12: on a phone (Pixel 5, recorded at 2x). Study's dial and a move card, then a Coach
// lesson with its pen keyboard and a glossary chip's bottom sheet.
import { clip, PHONE, dial, tricks } from "./lib.mjs";

await clip("12-phone", { device: PHONE }, async (page, h) => {
  await h.caption("Reharm Lab on a phone", 1200);
  await h.caption("The dial: L1 to L4");
  for (const n of [1, 3, 4]) {
    await h.click(dial(page).getByRole("radio", { name: new RegExp(`^L${n}\\b`) }));
    await h.wait(1300);
  }
  await h.caption("The moves, one card each");
  await h.scroll(900, 2200);
  await h.wait(1200);
  const card = tricks(page).locator("[data-move-id]").first();
  await h.click(card.getByRole("button", { name: /Why it works/ }));
  await h.wait(1500);
  await h.scroll(350, 1000);
  await h.wait(1800);
  await h.caption("The Coach opens on that move's lesson");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await h.wait(900);
  await h.click(page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Coach" }));
  const learn = page.locator("[data-coach-learn]");
  await learn.waitFor();
  await h.wait(1200);
  for (let i = 0; i < 2; i++) {
    await h.click(learn.getByRole("button", { name: "Next ›" }));
    await h.wait(1600);
  }
  const chip = learn.locator('[data-step-text] button[aria-haspopup="dialog"]').first();
  if (await chip.count()) {
    await h.caption("Tap a term: a bottom sheet explains it");
    await h.click(chip);
    await h.wait(2600);
    await page.keyboard.press("Escape");
    await h.wait(800);
  }
});
