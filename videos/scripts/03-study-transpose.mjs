// Clip 3: transposing. The circle-of-fifths key picker, then half steps; the sheet respells.
import { clip } from "./lib.mjs";

await clip("03-study-transpose", { url: "/?level=2" }, async (page, h) => {
  await h.caption("Co-op Blues in F, with its L2 reharm", 1400);
  await h.caption("Pick any key off the circle of fifths");
  await h.click(page.getByRole("button", { name: /^Key: / }));
  await h.wait(1200);
  const circle = page.getByRole("radiogroup", { name: "Circle of fifths" });
  await h.click(circle.getByRole("radio", { name: /^D♭/ }).first());
  await h.wait(2600);
  await h.caption("D♭: every chord and melody note respelled with flats, the moves kept");
  await h.scroll(260, 900);
  await h.wait(2200);
  await h.scroll(-260, 700);
  await h.caption("Half a step up: D, and the spelling switches to sharps");
  await h.click(page.getByRole("button", { name: "Up a half step" }));
  await h.wait(2600);
  await h.click(page.getByRole("button", { name: "Up a half step" }));
  await h.caption("E♭");
  await h.wait(2200);
  await h.caption("Back home to F");
  await h.click(page.getByRole("button", { name: /^Key: / }));
  await h.wait(800);
  await h.click(circle.getByRole("radio", { name: /original key/ }).first());
  await h.wait(2000);
});
