// Clip 7: the stage ladder and the 12-key ribbon. Finish the tritone sub's lesson, land on
// "Study it" (ungraded), then show the ladder and the ribbon of keys. No notes are played.
import { clip, modeTab } from "./lib.mjs";

await clip("07-coach-ladder", {}, async (page, h) => {
  await h.click(modeTab(page, "Coach"));
  const learn = page.locator("[data-coach-learn]");
  await learn.waitFor();
  await h.caption("The tritone sub, from its lesson to the drill", 0);
  const nav = page.getByRole("navigation", { name: "What to drill" });
  await h.click(nav.getByRole("button", { name: /^All concepts/ }));
  await h.wait(400);
  await h.click(nav.locator("#coach-all-concepts").getByRole("button", { name: /^Tritone substitution/ }).first());
  await h.wait(1200);
  await h.click(page.getByRole("note", { name: "Builds on" }).getByRole("button", { name: "Continue anyway" }));
  await h.wait(1000);
  for (let i = 0; i < 6; i++) {
    const show = learn.getByRole("button", { name: "Show me" });
    if (await show.count()) await h.click(show, { pause: 150 });
    const next = learn.getByRole("button", { name: "Next ›" });
    if (!(await next.count())) break;
    await h.click(next, { pause: 150 });
    await h.wait(900);
  }
  await h.caption("The ladder: Learn → Study it → Self-check → Play it");
  await h.click(learn.getByRole("button", { name: "Study it ›" }));
  await h.wait(1800);
  const stages = page.getByRole("navigation", { name: "Stages" });
  await h.hover(stages);
  await h.wait(1800);
  await h.caption("The drill: the move's voicings on the keys, one key at a time");
  await h.hover(page.locator("#coach-drill"));
  await h.wait(2500);
  await h.caption("The 12-key ribbon: a key turns clean only after a clean graded run");
  const ribbon = page.locator("[data-coach-ribbon]");
  await h.hover(ribbon);
  await h.wait(2500);
  const keyBtn = ribbon.getByRole("button").nth(3);
  if (await keyBtn.count()) {
    await h.click(keyBtn);
    await h.wait(2200);
  }
  await h.caption("Why? keeps the lesson one tap away inside the drill");
  const why = page.locator("[data-why-card]");
  await h.hover(why);
  await h.wait(2500);
});
