// Clip 6: the Coach's Learn stage. The pen keyboard on 7th chords, then the secondary ii–V lesson
// with its two-line guide-tone labels ("ii / 7th" → "V / 3rd"). Learn mounts no grader.
import { clip, modeTab } from "./lib.mjs";

/** Pick a concept from "All concepts" on the Your path rail. */
async function pickConcept(page, h, name) {
  const nav = page.getByRole("navigation", { name: "What to drill" });
  const all = nav.getByRole("button", { name: /^All concepts/ });
  if ((await all.getAttribute("aria-expanded")) === "false") await h.click(all);
  await page.waitForTimeout(500);
  await h.click(nav.locator("#coach-all-concepts").getByRole("button", { name }).first());
}

await clip("06-coach-learn", {}, async (page, h) => {
  await h.caption("The Coach: every concept starts with a short lesson", 0);
  await h.click(modeTab(page, "Coach"));
  const learn = page.locator("[data-coach-learn]");
  await learn.waitFor();
  await h.wait(1500);
  await h.caption("The pen keyboard marks each tone and says what it is");
  for (let i = 0; i < 2; i++) {
    await h.click(learn.getByRole("button", { name: "Next ›" }));
    await h.wait(1800);
  }
  await h.caption("Jump to any concept: here, the secondary ii–V");
  await pickConcept(page, h, /^Secondary ii/);
  await h.wait(1500);
  await h.caption("Prerequisites recommend, never lock");
  const note = page.getByRole("note", { name: "Builds on" });
  await h.hover(note);
  await h.wait(1500);
  await h.click(note.getByRole("button", { name: "Continue anyway" }));
  await h.wait(1500);
  for (let i = 0; i < 5; i++) {
    const show = learn.getByRole("button", { name: "Show me" });
    if (await show.count()) {
      await h.caption("Predict first, then Show me");
      await h.click(show);
      await h.wait(1800);
    }
    const heading = (await learn.locator("[data-step-heading]").textContent()) ?? "";
    if (/Step 3/.test(heading)) {
      await h.caption("Two-line labels: which chord, which role. The 7th of ii falls to the 3rd of V");
      await h.wait(3200);
    } else if (/Step 4/.test(heading)) await h.caption("Then the arrival, and the rule to take away");
    const next = learn.getByRole("button", { name: "Next ›" });
    if (!(await next.count())) break;
    await h.click(next);
    await h.wait(2000);
  }
  await h.wait(1500);
});
