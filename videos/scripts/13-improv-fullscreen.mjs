// Clip 13: full-screen Improv mode. In Practice the band plays, ⛶ Improv clears everything but
// the chord and the piano, and a fake MIDI keyboard solos: the keys light up with each note's verdict
// against the sounding chord. The lens (what the keys show) is switched while it plays, then Esc.
// Demo build: nothing reaches the real database.
import { clip } from "./lib.mjs";

function installFakeMidi() {
  const input = { id: "fake-1", name: "Fake Keys", manufacturer: "video", type: "input", state: "connected", connection: "open", onmidimessage: null };
  const access = { inputs: new Map([[input.id, input]]), outputs: new Map(), sysexEnabled: false, onstatechange: null };
  Object.defineProperty(Navigator.prototype, "requestMIDIAccess", { configurable: true, value: () => Promise.resolve(access) });
  window.__send = (b) => input.onmidimessage?.({ data: new Uint8Array(b), timeStamp: performance.now() });
  // real fullscreen resizes the headless window past the recorded frame; the overlay fills the window anyway
  Element.prototype.requestFullscreen = () => Promise.resolve();
}

// an F blues phrase: [pitch, eighths] at ♩ = 168
const LINE = [
  [65, 1], [68, 1], [69, 1], [72, 2], [74, 1], [72, 1], [69, 2], [67, 1], [65, 1], [63, 2], [62, 1], [65, 3],
  [72, 1], [75, 1], [76, 1], [77, 2], [74, 1], [72, 1], [70, 2], [69, 1], [67, 1], [66, 1], [65, 3],
];
const EIGHTH = 60000 / 168 / 2;

async function solo(page, times = 1) {
  for (let t = 0; t < times; t++) {
    for (const [p, len] of LINE) {
      await page.evaluate((x) => window.__send([0x90, x, 90]), p);
      await page.waitForTimeout(EIGHTH * len * 0.85);
      await page.evaluate((x) => window.__send([0x80, x, 0]), p);
      await page.waitForTimeout(EIGHTH * len * 0.15);
    }
  }
}

await clip("13-improv-fullscreen", { url: "/?level=2", init: installFakeMidi, captionTop: true }, async (page, h) => {
  // MIDI connects from Study; the connection carries into Practice
  await page.getByRole("button", { name: /Connect MIDI/ }).first().click();
  await page.getByRole("button", { name: /MIDI: Fake Keys/ }).waitFor();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("heading", { name: /Improv heatmap/i }).waitFor();
  await page.waitForTimeout(600);

  await h.caption("Practice, then ⛶ Improv: just the chord and the piano, full screen", 0);
  await h.click(page.getByRole("button", { name: /^▶?\s*Play$/ }).first());
  await h.wait(800);
  await h.click(page.getByRole("button", { name: /Improv$/ }).first());
  const improv = page.getByRole("dialog", { name: "Improv mode" });
  await improv.waitFor();
  await h.wait(2600); // count-in
  await h.caption("Play along: each key lights up with how it sits on the chord under it");
  await solo(page);
  const lenses = improv.getByRole("radiogroup", { name: "What the keys show" }).getByRole("radio");
  const n = await lenses.count();
  for (let i = 1; i < Math.min(n, 4); i++) {
    const name = ((await lenses.nth(i).textContent()) ?? "").trim();
    await h.caption(`Lens: ${name} (V cycles them)`);
    await h.click(lenses.nth(i), { pause: 200 });
    await solo(page);
  }
  await h.caption("Esc (or F) drops back to Practice");
  await h.wait(800);
  await page.keyboard.press("Escape");
  await h.wait(1800);
});
