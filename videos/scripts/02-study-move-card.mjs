// Clip 2: a move card. Select the tritone sub, decode a chord chip, then walk "Why it works".
import { clip, tricks } from "./lib.mjs";

await clip("02-study-move-card", {}, async (page, h) => {
  const cards = tricks(page).locator("[data-move-id]");
  const card = cards.filter({ hasText: /Tritone sub/i }).first();
  await h.caption("Each card is one move: what changed, and where", 0);
  await h.hover(cards.first().getByRole("heading", { level: 3 }));
  await h.wait(900);
  await h.click(card.getByRole("heading", { level: 3 }).getByRole("button"));
  await h.wait(1200);
  await h.caption("Every chord symbol is a decoder: tap it for the spelling");
  const chip = card.locator('button[data-chip="symbol"]').first();
  await h.click(chip);
  await h.wait(2600);
  await page.keyboard.press("Escape");
  await h.wait(500);
  await h.caption("▶ Before / ▶ After auditions the written changes, then the move");
  await h.click(card.getByRole("button", { name: /^▶?\s*Before$/ }));
  await h.wait(1500);
  await h.click(card.getByRole("button", { name: /^▶?\s*After$/ }));
  await h.wait(1500);
  await h.caption("“Why it works” is a short lesson with the keys lit and labelled");
  await h.click(card.getByRole("button", { name: /Why it works/ }));
  await h.wait(1600);
  const stepper = card.locator("[data-lesson-stepper]");
  for (let i = 0; i < 6; i++) {
    const show = stepper.getByRole("button", { name: "Show me" });
    if (await show.count()) {
      await h.caption("One step asks you to predict first; Show me reveals it");
      await h.click(show);
      await h.wait(2000);
    }
    const next = stepper.getByRole("button", { name: "Next ›" });
    if (!(await next.count())) break;
    await h.click(next);
    await h.wait(2200);
  }
  await h.caption("The last step leaves you a rule to recreate it in any tune");
  await h.hover(card.getByText("Recreate it"));
  await h.wait(2600);
});
