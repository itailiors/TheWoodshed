import { BUNDLED_TUNES, prettyNote, referenceTune } from "@reharm/theory-core";
import { expect, installFakeMidi, test, type FakeMidi } from "./fixtures";

/*
 * Golden paths through the static demo build. Every test also fails if the page made any
 * `/api` request (see fixtures.ts). No assertions on sound: headless Chromium has no output.
 */

const dial = (page: import("@playwright/test").Page) => page.getByRole("radiogroup", { name: "Reharm level" });
const tricks = (page: import("@playwright/test").Page) => page.getByRole("complementary").filter({ has: page.getByRole("heading", { name: /Reharm & tricks/i }) });
/** "5 moves · …" under Reharm & tricks, as a number. */
async function moveCount(page: import("@playwright/test").Page) {
  const line = tricks(page).getByText(/^\d+ moves? · /);
  return Number((await line.textContent())!.match(/^(\d+)/)![1]);
}

test("loads with a clean console and no /api requests", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await expect(page.getByText("Demo · saves in this browser")).toBeVisible();
  // let the idle prefetches (lazy screens, the audio engine) run, so their requests are counted too
  await page.waitForLoadState("networkidle");

  expect(errors).toEqual([]);
});

test("Study: the reference tune is on the stand and the dial changes the moves", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lead sheet" })).toBeVisible();

  await dial(page).getByRole("radio", { name: /^L0\b/ }).click();
  await expect(dial(page).getByRole("radio", { name: /^L0\b/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Level 0 shows the tune as written.")).toBeVisible();
  await expect(page.locator("[data-move-id]")).toHaveCount(0);

  await dial(page).getByRole("radio", { name: /^L1\b/ }).click();
  await expect(tricks(page).getByText(/^\d+ moves? · /)).toBeVisible();
  const l1 = await moveCount(page);
  expect(l1).toBeGreaterThan(0);
  await expect(page.locator("[data-move-id]")).toHaveCount(l1);

  await dial(page).getByRole("radio", { name: /^L4\b/ }).click();
  await expect(dial(page).getByRole("radio", { name: /^L4\b/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => moveCount(page)).toBeGreaterThan(l1);
  await expect(page.locator("[data-move-id]")).toHaveCount(await moveCount(page));
  // the address bar follows the dial (debounced), so copying it shares this reharm
  await expect(page).toHaveURL(/[?&]level=4\b/);
});

test("Fake MIDI: a chord is registered, released, and an unplug leaves no stuck notes", async ({ page }) => {
  await page.addInitScript(installFakeMidi);
  await page.goto("/");
  const send = (bytes: number[]) => page.evaluate((b) => (window as unknown as { __fakeMidi: FakeMidi }).__fakeMidi.send(b), bytes);

  const midiButton = page.getByRole("button", { name: /Connect MIDI/ });
  await midiButton.click();
  const connected = page.getByRole("button", { name: /MIDI: Fake Keys/ });
  await expect(connected).toBeVisible();
  await expect(page.getByRole("button", { name: /Hear it in the app|Keyboard speakers only/ })).toBeVisible();

  // F7 shell, rootless-ish: F3, E♭4, A4 (one packet per note, as most keyboards send them)
  await send([0x90, 53, 90]);
  await send([0x90, 63, 80]);
  await send([0x90, 69, 85]);
  await expect(connected).toContainText("F3 E♭4 A4");

  // a note-off (as note-on with velocity 0, running status) lets one key up
  await send([0x90, 63, 0]);
  await expect(connected).toContainText("F3 A4");
  await expect(connected).not.toContainText("E♭4");

  // pull the cable with two keys still down: both are released, and the app says so
  await page.evaluate(() => (window as unknown as { __fakeMidi: FakeMidi }).__fakeMidi.unplug());
  await expect(page.getByText("Fake Keys disconnected, so its 2 held notes were released.")).toBeVisible();
  await expect(page.getByRole("button", { name: /No MIDI devices found/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /No MIDI devices found/ })).not.toContainText(/F3|A4/);
});

test("Changes: a Guided round asks where the chord goes and answers a pick", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Make the Changes/ })).toBeVisible();

  await page.getByRole("group", { name: "How much help" }).getByRole("button", { name: "Guided" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  await expect(page.getByText(/round 1 of \d+/)).toBeVisible();
  await expect(page.getByText("Where does it want to go?")).toBeVisible();
  const cards = page.getByRole("list", { name: "Where does it go?" }).getByRole("button");
  await expect(cards.first()).toBeEnabled(); // the prompt has sounded (or timed out): answers are open
  expect(await cards.count()).toBeGreaterThanOrEqual(2);

  await cards.first().click();
  // whatever was picked, the verdict line names the chord and offers "why?"
  await expect(page.getByRole("button", { name: "why?" })).toBeVisible();
  await expect(page.getByText(/\d+ pts · streak \d+/)).toBeVisible();
});

test("Deep link: tune, key and level in the URL open that reharm", async ({ page }) => {
  // a bundled tune other than the reference one, in a key that isn't its own
  const tune = BUNDLED_TUNES.find((t) => t.id !== referenceTune.id)!;
  const key = tune.key.tonic === "Bb" ? "D" : "Bb";
  await page.goto(`/?tune=${encodeURIComponent(tune.id)}&key=${key}&level=3`);

  await expect(page.getByRole("heading", { level: 1, name: tune.title })).toBeVisible();
  await expect(dial(page).getByRole("radio", { name: /^L3\b/ })).toHaveAttribute("aria-checked", "true");
  // the key picker shows the link's key against the chart's own ("Key: B♭ (orig. C)")
  await expect(page.getByRole("button", { name: new RegExp(`^Key: ${prettyNote(key)}\\s*\\(orig\\. ${prettyNote(tune.key.tonic)}`) })).toBeVisible();
  await expect(page.getByText(`${prettyNote(key)} ${tune.key.mode}`, { exact: false }).first()).toBeVisible();
  // once applied, the address bar keeps the same reharm
  await expect(page).toHaveURL(new RegExp(`tune=${tune.id}.*key=${key}.*level=3`));
});

test("Deep link: an unknown tune falls back to the reference tune with a note", async ({ page }) => {
  await page.goto("/?tune=no-such-tune&level=2");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await expect(page.getByText(/That link is to a tune that isn't in the demo library/)).toBeVisible();
});
