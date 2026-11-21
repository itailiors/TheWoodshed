// Clip 14: adjusting the band while it plays. ▾ Band opens the trio mixer (mute or bring in
// piano, bass, drums, click); tempo; then Advanced: channel faders, band style, piano voicings
// and the swing slider (even → 2:1 triplet → hard). Silent: the captions say what changes.
import { clip } from "./lib.mjs";

/** Drag a range input's thumb from one fraction of its width to another. */
async function drag(page, slider, from, to, ms = 1200) {
  await slider.scrollIntoViewIfNeeded();
  const b = await slider.boundingBox();
  const y = b.y + b.height / 2;
  await page.mouse.move(b.x + b.width * from, y, { steps: 18 });
  await page.waitForTimeout(250);
  await page.mouse.down();
  const n = Math.max(8, Math.round(ms / 40));
  for (let i = 1; i <= n; i++) {
    await page.mouse.move(b.x + b.width * (from + ((to - from) * i) / n), y);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
}

await clip("14-band", { url: "/?level=2", captionTop: true }, async (page, h) => {
  await h.caption("The trio plays the reharm: piano, bass and drums", 0);
  await h.click(page.getByRole("button", { name: "Play", exact: true }).first());
  await h.wait(2200);
  await h.caption("▾ Band: bring each player in or out, live");
  await h.click(page.getByRole("button", { name: /Band$/ }).first());
  await h.wait(1000);
  const mixer = page.getByRole("group", { name: "Band mixer" }).first();
  for (const inst of ["Drums", "Bass"]) {
    await h.click(mixer.getByRole("button", { name: new RegExp(`^${inst}:`) }));
    await h.wait(1100);
  }
  await h.caption("Piano alone, then the rhythm section back in");
  await h.wait(1200);
  for (const inst of ["Bass", "Drums"]) {
    await h.click(mixer.getByRole("button", { name: new RegExp(`^${inst}:`) }));
    await h.wait(900);
  }
  await h.caption("Tempo: slow it down to woodshed, push it to gig speed");
  const tempo = page.getByRole("slider", { name: "Tempo" }).first();
  await drag(page, tempo, 0.6, 0.3);
  await h.wait(1200);
  await drag(page, tempo, 0.3, 0.6, 800);
  await h.wait(800);

  await h.caption("Advanced: a fader per channel");
  // bring the transport to the top so the whole popover, swing slider included, is in frame
  await page.mouse.move(700, 500, { steps: 10 });
  await h.scroll(330, 700);
  await h.wait(300);
  await h.click(page.getByRole("button", { name: /Advanced/ }).first());
  const adv = page.getByRole("group", { name: "Advanced instrument mixer" }).or(page.getByLabel("Advanced instrument mixer")).first();
  await adv.waitFor();
  await h.wait(900);
  const bassFader = adv.getByRole("slider", { name: /^Bass volume/ }).first();
  if (await bassFader.count()) {
    await drag(page, bassFader, 0.75, 0.95, 900);
    await h.wait(700);
  }
  await h.caption("Band style: walking, bass in 2, ballad, bossa, straight 8ths");
  const style = adv.getByRole("combobox", { name: "Band style" });
  await h.hover(style);
  const options = await style.locator("option").evaluateAll((os) => os.map((o) => o.value));
  for (const v of options.slice(1, 5)) {
    await style.selectOption(v);
    await h.wait(1500);
  }
  await style.selectOption(options[0]);
  await h.caption("Piano voicings: how the comping hand voices each chord");
  const voicing = adv.getByRole("combobox", { name: "Piano voicing style" });
  await h.hover(voicing);
  const vopts = await voicing.locator("option").evaluateAll((os) => os.map((o) => o.value));
  if (vopts.length > 1) {
    await voicing.selectOption(vopts[1]);
    await h.wait(1500);
    await voicing.selectOption(vopts[0]);
  }
  await h.caption("Swing: from even eighths through the 2:1 triplet to a hard swing");
  const swing = adv.getByRole("slider", { name: /^Swing ratio/ });
  await drag(page, swing, 0.67, 0.02, 1200);
  await h.wait(1000);
  await drag(page, swing, 0.02, 0.98, 1800);
  await h.wait(1000);
  await h.click(adv.getByRole("button", { name: /triplet|·/ }).first()).catch(() => {});
  await h.wait(1500);
});
