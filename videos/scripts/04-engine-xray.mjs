// Clip 4: the Engine X-ray. Step the per-bar decision pipeline, then run the live proofs.
import { clip } from "./lib.mjs";

await clip("04-engine-xray", { url: "/?level=3" }, async (page, h) => {
  await h.caption("Under ⋯ More: the Engine X-ray", 0);
  await h.click(page.getByRole("button", { name: /More$/ }));
  await h.wait(700);
  await h.click(page.getByRole("button", { name: /Engine X-ray/ }));
  const xray = page.getByRole("dialog").filter({ has: page.locator("#xray-h") });
  await xray.waitFor();
  await h.wait(1500);
  await h.caption("Bar by bar: every rule tried, scored, kept or rejected with a reason");
  const next = xray.getByRole("button", { name: "Next bar" });
  for (let i = 0; i < 4; i++) {
    await h.click(next, { pause: 200 });
    await h.wait(1500);
  }
  await h.hover(xray.locator("ol, ul").first());
  await h.scroll(300, 1000);
  await h.wait(1500);
  const tabs = xray.getByRole("tablist", { name: "X-ray views" }).getByRole("tab");
  const proof = tabs.filter({ hasText: /Proof/i }).first();
  await h.caption("The Proof tab runs the engine's claims live: property tests in a Worker");
  await h.click(proof);
  await h.wait(1200);
  const run = xray.getByRole("button", { name: /Run|Prove/i }).first();
  if (await run.count()) await h.click(run);
  await h.wait(7000);
  await h.caption("Same proofs as CI, in your browser");
  await h.wait(2500);
});
