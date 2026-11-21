// Clip 10: Practice. The trio plays the reharm, the HUD follows the changes, and a fake MIDI
// keyboard solos (an F blues line) so the improv heatmap fills: chord tones, tensions, outside.
// Demo build: the run saves only to this throwaway browser profile, never to the real database.
import { clip } from "./lib.mjs";

function installFakeMidi() {
  const input = { id: "fake-1", name: "Fake Keys", manufacturer: "video", type: "input", state: "connected", connection: "open", onmidimessage: null };
  const access = { inputs: new Map([[input.id, input]]), outputs: new Map(), sysexEnabled: false, onstatechange: null };
  Object.defineProperty(Navigator.prototype, "requestMIDIAccess", { configurable: true, value: () => Promise.resolve(access) });
  window.__send = (b) => input.onmidimessage?.({ data: new Uint8Array(b), timeStamp: performance.now() });
}

// F blues-ish line: pitch, length in eighths (at ♩=168 an eighth is ~179 ms)
const LINE = [
  [65, 1], [68, 1], [69, 1], [72, 2], [74, 1], [72, 1], [69, 2], [67, 1], [65, 1], [63, 2], [62, 1], [65, 3],
  [72, 1], [75, 1], [76, 1], [77, 2], [74, 1], [72, 1], [70, 2], [69, 1], [67, 1], [66, 1], [65, 3],
];

await clip("10-practice-heatmap", { url: "/?level=2", init: installFakeMidi, captionTop: true }, async (page, h) => {
  // MIDI connects from Study; the connection carries into Practice
  await page.getByRole("button", { name: /Connect MIDI/ }).first().click();
  await page.getByRole("button", { name: /MIDI: Fake Keys/ }).waitFor();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("heading", { name: /Improv heatmap/i }).waitFor();
  await page.waitForTimeout(600);
  await h.caption("Practice: the band plays the reharm, the HUD calls the next chord", 0);
  await h.click(page.getByRole("button", { name: /^▶?\s*Play$/ }).first());
  await h.wait(3500); // count-in
  await h.caption("Solo on a MIDI keyboard: every note lands on the heatmap, coloured by the chord under it");
  const eighth = 60000 / 168 / 2;
  for (let pass = 0; pass < 3; pass++) {
    for (const [p, len] of LINE) {
      await page.evaluate((x) => window.__send([0x90, x, 90]), p);
      await page.waitForTimeout(eighth * len * 0.85);
      await page.evaluate((x) => window.__send([0x80, x, 0]), p);
      await page.waitForTimeout(eighth * len * 0.15);
    }
    if (pass === 1) await h.caption("Blue: chord tone · gold: tension · red: avoid · outlined: a guide-tone landing");
  }
  await h.wait(1500);
  await h.click(page.getByRole("button", { name: /Stop|Pause/ }).first()).catch(() => {});
  await h.hover(page.getByRole("heading", { name: /Improv heatmap/i }));
  await h.wait(2500);
});
