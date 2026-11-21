// Clip 5: a lesson to its end: "Recreate it" and "Go deeper" (melody check, voice leading).
// The ✍ Deep dive (Claude's prose) is NOT in this clip: the demo build hides it while
// apps/api/demo/explanations.json is the template (source: "template"). See PLAN.md.
import { clip, tricks } from "./lib.mjs";

await clip("05-go-deeper", {}, async (page, h) => {
  const card = tricks(page).locator("[data-move-id]").first();
  await h.caption("The ii–V into the I: open its lesson", 0);
  await h.click(card.getByRole("button", { name: /Why it works/ }));
  await h.wait(1200);
  const stepper = card.locator("[data-lesson-stepper]");
  for (let i = 0; i < 6; i++) {
    const show = stepper.getByRole("button", { name: "Show me" });
    if (await show.count()) await h.click(show, { pause: 150 });
    const next = stepper.getByRole("button", { name: "Next ›" });
    if (!(await next.count())) break;
    if (i === 1) await h.caption("Each step names the notes on the keys: target, guide tones, the move");
    await h.click(next, { pause: 200 });
    await h.wait(1500);
  }
  await h.caption("Recreate it: the rule, written for any tune");
  await h.hover(card.getByText("Recreate it"));
  await h.wait(2400);
  await h.caption("Go deeper: every melody note checked against the new chords, and the voice leading");
  await h.hover(card.getByText("Go deeper"));
  await h.scroll(250, 1200);
  await h.wait(3500);
});
