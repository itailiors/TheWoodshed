import AxeBuilder from "@axe-core/playwright";
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

test("Study: first load shows headlines; the rest is one click away", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  const open = tricks(page).locator("[data-move-id]").first();
  await expect(open.getByRole("button", { name: /Practice this move/ })).toBeVisible();
  // the card face carries the audition: the written changes, then the move
  await expect(open.getByRole("button", { name: /^▶?\s*Before$/ })).toBeVisible();
  await expect(open.getByRole("button", { name: /^▶?\s*After$/ })).toBeVisible();
  // the scale card waits behind "Solo over it"
  await expect(page.getByRole("region", { name: "Improvisation map" })).toHaveCount(0);
  // the open card is a headline: its explanation waits behind "Why it works"
  const why = open.getByRole("button", { name: /Why it works/ });
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await expect(open.getByText("Recreate it")).toHaveCount(0);
  await why.click();
  // the reference move has a lesson: it steps through, and "Recreate it" (the rule) closes the last step
  const heading = open.locator("[data-step-heading]");
  await expect(heading).toHaveText(/^Step 1 of \d+$/);
  const steps = Number((await heading.textContent())!.match(/of (\d+)/)![1]);
  for (let i = 1; i < steps; i++) await open.getByRole("button", { name: "Next ›" }).click();
  await expect(open.getByText("Recreate it")).toBeVisible();
  // secondary panels are folded, and a folded heatmap isn't mounted (so it can't grade)
  await expect(page.getByRole("button", { name: /Edit chord by chord/ })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Improv heatmap" })).toHaveCount(0);
  await expect(tricks(page).getByRole("button", { name: /^\d+ considered & rejected/ })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /Solo over it/ }).click();
  await expect(page.getByRole("heading", { name: "Improv heatmap" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Improvisation map" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Trade 2s/ })).toHaveCount(0);
});

test("Study: a card's heading holds its select button, and a click anywhere on the face still selects it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  const cards = tricks(page).locator("[data-move-id]");
  expect(await cards.count()).toBeGreaterThan(1);
  const second = cards.nth(1);
  // the h3 is a real heading (not swallowed by a button), and the button inside it names just the move
  const select = second.getByRole("heading", { level: 3 }).getByRole("button");
  await expect(select).toHaveAttribute("aria-expanded", "false");
  await expect(select).toHaveAccessibleName(/\(Bar \d+\)$/);
  await expect(select).toHaveAccessibleDescription((await second.locator("[data-move-summary]").textContent())!.trim());
  // the summary isn't inside the button, but the stretched button covers it: a real click there lands
  // on the button (a locator click would wait forever, since the button intercepts it, which is the point)
  const summary = second.locator("[data-move-summary]");
  await summary.scrollIntoViewIfNeeded();
  const box = (await summary.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(select).toHaveAttribute("aria-expanded", "true");
  await expect(second.getByRole("button", { name: /Practice this move/ })).toBeVisible();
  const scan = await new AxeBuilder({ page }).include("[data-move-id]").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("Study: the dial is named by how far it goes, with the density in each tooltip", async ({ page }) => {
  await page.goto("/");
  const words = ["Original", "Inside", "Colour", "Bold", "Out"];
  for (const [i, w] of words.entries()) {
    const radio = dial(page).getByRole("radio", { name: new RegExp(`^L${i}\\b`) });
    await expect(radio).toHaveAccessibleName(`L${i} ${w}`);
    await expect(radio).toHaveAttribute("title", new RegExp(`^L${i} ${w}: `));
  }
  await expect(dial(page).getByRole("radio", { name: /^L2\b/ })).toHaveAttribute("title", /^L2 Colour: .*1 move per 4 bars$/);
});

test("Pre-push: a move headline and a ▶ button are in the first viewport, console clean", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  const card = tricks(page).locator("[data-move-id]").first();
  await expect(card.getByRole("heading", { level: 3 })).toBeInViewport();
  await expect(card.getByRole("button", { name: /^▶?\s*Before$/ })).toBeInViewport();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
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
