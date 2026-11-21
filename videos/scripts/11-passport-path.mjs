// Clip 11: the Concept Passport. Today's practice (the demo's SAMPLE notebook, labelled as such),
// a few concepts' 12-key pages, the Path tab, then "Practise →" straight into the Coach.
// Nothing is played in the Coach, so nothing is graded.
import { clip } from "./lib.mjs";

await clip("11-passport-path", {}, async (page, h) => {
  await h.caption("The Concept Passport: what's due, and how far each concept has come", 0);
  await h.click(page.getByRole("button", { name: /^(My progress \(concept passport\)|📒 Progress|Progress)$/ }).locator("visible=true").first());
  const dialog = page.getByRole("dialog", { name: /Concept passport/i });
  await dialog.waitFor();
  await h.wait(1800);
  await h.caption("Spaced repetition per move and key (the demo shows a labelled sample notebook)");
  await h.hover(dialog.getByText("Today's practice").last());
  await h.wait(1500);
  await h.scroll(260, 1200);
  await h.wait(1000);
  const pages = dialog.getByRole("tab").filter({ hasText: /\d+\/12/ });
  for (let i = 0; i < 3 && i < (await pages.count()); i++) {
    const name = ((await pages.nth(i + 1).textContent()) ?? "").trim();
    await h.caption(`A passport page: ${name.replace(/(\d+)\/12/, "$1 of 12 keys clean")}`);
    await h.click(pages.nth(i + 1));
    await h.wait(2200);
  }
  await h.caption("The Path: five tiers, from 7th chords to the Coltrane changes");
  await h.click(dialog.getByRole("tab", { name: "Path" }));
  await h.wait(1800);
  const tier = dialog.locator("[data-path] section[data-tier]").nth(2).getByRole("button").first();
  await h.click(tier);
  await h.wait(2600);
  await h.caption("Practise → opens the Coach on that exact move and key");
  await h.click(dialog.getByRole("tab", { name: "Today's practice" }));
  await h.wait(900);
  await h.click(dialog.getByRole("button", { name: /Practise/ }).nth(1));
  await h.wait(3500);
});
