// Clip 9: Voicings. One chord through its shapes (Shells → rootless → Drop 2), then a ii–V–I.
import { clip, modeTab } from "./lib.mjs";

await clip("09-voicings", {}, async (page, h) => {
  await h.caption("Voicings: pick a chord, pick a shape, see where the fingers go", 0);
  await h.click(modeTab(page, "Voicings"));
  await page.getByRole("heading", { level: 1, name: /Voicings/i }).waitFor();
  await h.wait(1800);
  await h.caption("Shells: root, 3rd and 7th, left and right hand coloured");
  await h.wait(1600);
  for (const [name, cap] of [
    [/^\s*Close/, "Rootless: guide tones and colours packed inside an octave"],
    [/^\s*Drop 2/, "Drop 2: the second voice from the top drops an octave"],
  ]) {
    await h.caption(cap);
    await h.click(page.locator("button").filter({ hasText: name }).first());
    await h.wait(2400);
  }
  await h.caption("Any chord quality, any key");
  const selects = page.locator("select");
  await h.hover(selects.first());
  await selects.first().selectOption({ index: 3 });
  await h.wait(1800);
  await h.hover(selects.nth(1));
  await selects.nth(1).selectOption({ index: 5 });
  await h.wait(2000);
  await h.caption("ii–V–I: how each shape moves to the next, by the smallest steps");
  await h.click(page.locator("button").filter({ hasText: /ii–V–I major/ }).first());
  await h.wait(2600);
  await h.wait(1400);
  await h.caption("Step through the progression: the hands barely move");
  for (const chord of [/^\s*C7/, /^\s*Fmaj7/]) {
    await h.click(page.locator("button").filter({ hasText: chord }).first());
    await h.wait(2200);
  }
  const hear = page.getByRole("button", { name: /Hear the ii–V–I/ }).first();
  if (await hear.count()) {
    await h.caption("▶ Hear the ii–V–I plays it, the keys lighting in time");
    await h.click(hear);
    await h.wait(4500);
  }
});
