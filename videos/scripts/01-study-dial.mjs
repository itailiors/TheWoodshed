// Clip 1: the reharm dial. L0 → L4 on Co-op Blues; the lead sheet repaints and the move list grows.
import { clip, dial, tricks } from "./lib.mjs";

await clip("01-study-dial", {}, async (page, h) => {
  const lvl = (n) => dial(page).getByRole("radio", { name: new RegExp(`^L${n}\\b`) });
  await h.caption("Co-op Blues as written: the reharm dial at L0", 0);
  await h.click(lvl(0));
  await h.wait(1600);
  for (const [n, words] of [
    [1, "L1 Inside: one safe move per 8 bars"],
    [2, "L2 Colour: a ii–V, a tritone sub"],
    [3, "L3 Bold: two moves per 4 bars"],
    [4, "L4 Out: every move the melody allows"],
  ]) {
    await h.caption(words);
    await h.click(lvl(n));
    await h.wait(2000);
  }
  await h.caption("Every move is checked against the melody, and spelled right");
  await h.hover(tricks(page).getByText(/^\d+ moves? · /));
  await h.scroll(320, 1200);
  await h.wait(1800);
  await h.scroll(-320, 900);
  await h.caption("Original ↔ Reharm flips the chart back and forth");
  const orig = page.getByRole("button", { name: "Original", exact: true });
  const re = page.getByRole("button", { name: "Reharm", exact: true });
  await h.click(orig);
  await h.wait(1300);
  await h.click(re);
  await h.wait(1500);
});
