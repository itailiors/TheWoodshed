import AxeBuilder from "@axe-core/playwright";
import { chroma, decodeSymbol, generateMoves, glossaryEntry, lessonForMove, referenceTune, transpose, type Lesson } from "@reharm/theory-core";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * Glossary chips, the chord-symbol decoder and first-run hints (3h), on a desktop and (the
 * `mobile` project) a Pixel 5, in the static demo build. A chip opens a note (a bottom sheet on a
 * phone) with its gloss and "Learn it →"; Esc closes it and stays on the page. The Changes
 * game's "real jazz move" line links to the lesson in Coach.
 */

const tricks = (page: Page) => page.getByRole("complementary").filter({ has: page.getByRole("heading", { name: /Reharm & tricks/i }) });
const { accepted } = generateMoves(referenceTune);

/** Study's first card with its lesson open, walked to the first step whose text has a chip of `kind`. */
async function lessonWithChip(page: Page, kind: "term" | "symbol"): Promise<{ card: Locator; chip: Locator; lesson: Lesson }> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  const card = tricks(page).locator("[data-move-id]").first();
  const id = await card.getAttribute("data-move-id");
  const lesson = lessonForMove(accepted.find((m) => m.id === id)!)!;
  await card.getByRole("button", { name: /Why it works/ }).click();
  const stepper = card.locator("[data-lesson-stepper]");
  const chip = stepper.locator(`[data-step-text] button[data-chip="${kind}"]`);
  for (let i = 0; i < lesson.steps.length && (await chip.count()) === 0; i++) {
    await stepper.getByRole("button", { name: `Step ${i + 1}`, exact: true }).click();
    await expect(stepper.locator("[data-step-heading]")).toHaveText(`Step ${i + 1} of ${lesson.steps.length}`);
    if (await stepper.getByRole("button", { name: "Show me" }).count()) await stepper.getByRole("button", { name: "Show me" }).click();
  }
  await expect(chip.first()).toBeVisible();
  return { card, chip: chip.first(), lesson };
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

test("a glossary chip in a lesson opens its gloss with Learn it (a bottom sheet on a phone); Esc closes it and stays on Study; axe clean", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const { card, chip } = await lessonWithChip(page, "term");
  const term = (await chip.textContent())!;
  const entry = glossaryEntry(term)!;
  expect(entry, `"${term}" is a glossary term`).toBeDefined();

  await chip.click();
  const note = page.getByRole("dialog", { name: entry.term });
  await expect(note).toBeVisible();
  await expect(note).toContainText(entry.gloss);
  if (entry.conceptId) await expect(note.getByRole("button", { name: /^Learn it/ })).toBeVisible();
  const box = (await note.boundingBox())!;
  const vp = page.viewportSize()!;
  if (isPhone(page)) expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(vp.height - 2); // docked to the bottom
  else expect(box.y + box.height).toBeLessThanOrEqual(vp.height);

  const scan = await new AxeBuilder({ page }).include("[data-move-id]").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  // Esc closes the note only: the lesson stays open, focus back on the chip
  await page.keyboard.press("Escape");
  await expect(note).toHaveCount(0);
  await expect(card.locator("[data-lesson-stepper]")).toBeVisible();
  await expect(chip).toBeFocused();
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Learn it on a Study chip opens that concept in Coach", async ({ page }) => {
  const { chip } = await lessonWithChip(page, "term");
  const entry = glossaryEntry((await chip.textContent())!)!;
  test.skip(!entry.conceptId, "this chip's term has no lesson");
  await chip.click();
  await page.getByRole("dialog", { name: entry.term }).getByRole("button", { name: /^Learn it/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  await expect(page.locator("[data-coach-learn]")).toHaveAttribute("data-coach-learn", entry.conceptId!);
});

test("the chord-symbol decoder: tapping a symbol in a lesson explains its parts from theory-core", async ({ page }) => {
  const { chip } = await lessonWithChip(page, "symbol");
  const sym = (await chip.textContent())!;
  const decoded = decodeSymbol(sym)!;
  expect(decoded, sym).not.toBeNull();
  await chip.click();
  const note = page.getByRole("dialog", { name: decoded.symbol });
  await expect(note).toBeVisible();
  for (const p of decoded.parts) await expect(note).toContainText(`${p.text} ${p.meaning}`);
  await page.keyboard.press("Escape");
  await expect(note).toHaveCount(0);
});

test("a first-run hint dismisses with ✕ Got it and stays dismissed after a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Voicings" }).click();
  const hint = page.locator('[data-first-run-hint="voicings"]');
  await expect(hint).toContainText("Start with Shells");
  await hint.getByRole("button", { name: /Got it/ }).click();
  await expect(hint).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("reharm.reveal.hint.voicings"))).toBe("1");
  await page.reload();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Voicings" }).click();
  await expect(page.getByRole("radiogroup", { name: "Voicing shape" })).toBeVisible();
  await expect(page.locator('[data-first-run-hint="voicings"]')).toHaveCount(0);
});

test("Voicings: a rootless shape points back at Shells, and its glossary chips open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Voicings" }).click();
  const shapes = page.getByRole("radiogroup", { name: "Voicing shape" });
  await shapes.getByRole("radio", { name: /Close \(rootless\)/ }).click();
  const chip = page.locator('button[data-chip="term"]', { hasText: "Close (rootless)" });
  await chip.click();
  await expect(page.getByRole("dialog", { name: "Close (rootless)" })).toContainText(glossaryEntry("Close (rootless)")!.gloss);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Recommended first: Shells →" }).click();
  await expect(shapes.getByRole("radio", { name: /Shells/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Recommended first: Shells →" })).toHaveCount(0);
});

test("Changes: a tritone-sub answer is a real jazz move, and Learn the tritone sub → opens it in Coach", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Changes" }).click();
  await expect(page.locator('[data-first-run-hint="changes"]')).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // Level 1 is the landing (V → I): from V, the ♭II root is the tritone sub
  const where = page.getByText(/^in .+ major$/).first();
  await expect(where).toBeVisible();
  const tonic = (await where.textContent())!.replace(/^in (.+) major$/, "$1").replace(/♭/g, "b").replace(/♯/g, "#");
  const sub = (chroma(transpose(tonic, "b2")) + 12) % 12;
  const keys = page.locator("rect[data-midi]");
  await expect(keys.first()).toBeAttached();
  const midis = (await keys.evaluateAll((rs) => rs.map((r) => Number(r.getAttribute("data-midi"))))) as number[];
  const key = page.locator(`rect[data-midi="${midis.find((m) => m % 12 === sub)}"]`).first();
  // the chord plays first; the keys listen once it's asked
  await expect(page.getByRole("list", { name: "Where does it go?" }).getByRole("button").first()).toBeEnabled({ timeout: 10_000 });
  await key.dispatchEvent("pointerdown", { pointerType: "mouse" });
  await key.dispatchEvent("pointerup", { pointerType: "mouse" });
  await expect(page.getByRole("status").filter({ hasText: /real jazz move/ })).toBeVisible();
  const link = page.getByRole("link", { name: "Learn the tritone sub →" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  await expect(page.locator("[data-coach-learn]")).toHaveAttribute("data-coach-learn", "dominant.tritoneSub");
});
