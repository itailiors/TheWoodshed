import AxeBuilder from "@axe-core/playwright";
import { generateMoves, hasRuleLesson, lessonForMove, prettyNote, chroma, referenceTune, type Lesson } from "@reharm/theory-core";
import type { Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

/*
 * Lessons in Study (3g), on a desktop and (the `mobile` project) a Pixel 5. "Why it works" on a
 * move whose rule has a lesson steps through it inline; a rule without one keeps the old body.
 * "Solo over it" stays CLOSED throughout: its heatmap saves what it hears, and the stepper's asks
 * are switched off while it's open (heatmapGuard.test.ts). Study never grades.
 */

const tricks = (page: Page) => page.getByRole("complementary").filter({ has: page.getByRole("heading", { name: /Reharm & tricks/i }) });
const { accepted } = generateMoves(referenceTune);

/** The open (first) card on first load, and its lesson, computed by theory-core the same way the app does. */
async function firstCard(page: Page): Promise<{ card: Locator; lesson: Lesson }> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  const card = tricks(page).locator("[data-move-id]").first();
  const id = await card.getAttribute("data-move-id");
  const move = accepted.find((m) => m.id === id)!;
  const lesson = lessonForMove(move);
  expect(lesson, `the first card (${id}) should have a lesson`).not.toBeNull();
  return { card, lesson: lesson! };
}

const askIndex = (l: Lesson) => l.steps.findIndex((s) => s.ask);
/** The QWERTY key for a pitch class (A = C … J = B, M switches it on). */
const QWERTY = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j"];
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

test("Study loads cleanly, on a desktop and a phone", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await expect(page.locator("[data-move-id]").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("the move cards pass an axe scan (WCAG A/AA)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-move-id]").first()).toBeVisible();
  const scan = await new AxeBuilder({ page }).include("[data-move-id]").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("Why it works steps through the lesson: one step at a time, the ask waits, the last step goes deeper", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const { card, lesson } = await firstCard(page);
  const n = lesson.steps.length;
  const ask = askIndex(lesson);
  expect(ask).toBeGreaterThan(0);

  const why = card.getByRole("button", { name: /Why it works/ });
  await expect(why).toHaveAccessibleName(new RegExp(`Why it works \\(${n} steps\\)`));
  await why.click();
  const stepper = card.locator("[data-lesson-stepper]");
  const heading = stepper.locator("[data-step-heading]");
  const text = stepper.locator("[data-step-text]");
  const next = stepper.getByRole("button", { name: "Next ›" });
  await expect(heading).toHaveText(`Step 1 of ${n}`);
  await expect(text).toContainText(lesson.steps[0].text);
  await expect(stepper.getByRole("button", { name: "Step 1" })).toHaveAttribute("aria-current", "step");
  // the rule and Go deeper wait for the last step
  await expect(card.getByText("Recreate it")).toHaveCount(0);
  await expect(stepper.locator("[data-go-deeper]")).toHaveCount(0);

  for (let i = 1; i <= ask; i++) {
    await next.click();
    await expect(heading).toHaveText(`Step ${i + 1} of ${n}`);
  }

  // the ask: its prompt, no answer text, no lit labels
  const step = lesson.steps[ask];
  await expect(text).toContainText(step.ask!.prompt);
  await expect(text).not.toContainText(step.text);
  await expect(stepper.locator("[data-key-label]")).toHaveCount(0);
  // a wrong key is named and not counted
  const answerPcs = step.ask!.answer.map(chroma);
  const keys = stepper.locator("rect[data-midi]");
  const midis = (await keys.evaluateAll((rs) => rs.map((r) => Number(r.getAttribute("data-midi"))))) as number[];
  const wrongMidi = midis.find((m) => !answerPcs.includes(m % 12) && [0, 2, 4, 5, 7, 9, 11].includes(m % 12))!;
  await stepper.locator(`rect[data-midi="${wrongMidi}"]`).dispatchEvent("pointerdown", { pointerType: "mouse" });
  await expect(stepper.getByRole("status")).toContainText("Not ");
  await expect(stepper.locator("[data-wrong-key]")).toContainText("✗ Not ");
  await expect(text).not.toContainText(step.text);
  // Show me reveals it (no tick: nothing was answered)
  await stepper.getByRole("button", { name: "Show me" }).click();
  await expect(text).toContainText(step.text);
  await expect(stepper.getByRole("button", { name: "Show me" })).toHaveCount(0);

  for (let i = ask + 1; i < n; i++) {
    await next.click();
    await expect(heading).toHaveText(`Step ${i + 1} of ${n}`);
  }
  // the last step: the rule, kept under its old label, then Go deeper as a plain section (no fold)
  await expect(card.getByText("Recreate it")).toBeVisible();
  await expect(card.getByText(lesson.rule)).toBeVisible();
  const deeper = stepper.locator("[data-go-deeper]");
  await expect(deeper.getByRole("heading", { name: "Go deeper" })).toBeVisible();
  if (lesson.deeper) await expect(deeper).toContainText(lesson.deeper);
  await expect(deeper.getByRole("region", { name: "Melody check" })).toBeVisible();
  await expect(deeper.locator("[aria-expanded]")).toHaveCount(0);
  await expect(stepper.getByRole("button", { name: "Done" })).toBeVisible();

  // Back walks one step
  await stepper.getByRole("button", { name: "‹ Back" }).click();
  await expect(heading).toHaveText(`Step ${n - 1} of ${n}`);
  expect(errors).toEqual([]);
});

test("the ask takes the right key from the on-screen keyboard", async ({ page }) => {
  const { card, lesson } = await firstCard(page);
  const ask = askIndex(lesson);
  const step = lesson.steps[ask];
  await card.getByRole("button", { name: /Why it works/ }).click();
  const stepper = card.locator("[data-lesson-stepper]");
  await stepper.getByRole("button", { name: `Step ${ask + 1}`, exact: true }).click();
  await expect(stepper.locator("[data-step-text]")).toContainText(step.ask!.prompt);
  for (const pc of step.ask!.answer.map(chroma)) {
    const midi = (await stepper.locator("rect[data-midi]").evaluateAll((rs) => rs.map((r) => Number(r.getAttribute("data-midi"))))).find((m) => m % 12 === pc)!;
    await stepper.locator(`rect[data-midi="${midi}"]`).dispatchEvent("pointerdown", { pointerType: "mouse" });
  }
  await expect(stepper.locator("[data-step-text]")).toContainText(step.text);
  await expect(stepper.locator("[data-step-text]")).toContainText(`✓ ${listOf(step.ask!.answer.map(prettyNote))}`);
});

test("keyboard only: open the lesson, every step and the ask (answered on the computer keys), then Done", async ({ page }) => {
  const { card, lesson } = await firstCard(page);
  const n = lesson.steps.length;
  const ask = askIndex(lesson);
  const stepper = card.locator("[data-lesson-stepper]");
  const heading = stepper.locator("[data-step-heading]");
  const why = card.getByRole("button", { name: /Why it works/ });

  await why.focus();
  await page.keyboard.press("Enter");
  await expect(why).toHaveAttribute("aria-expanded", "true");
  await expect(heading).toHaveText(`Step 1 of ${n}`);
  // Tab into the lesson (the first stop is a step dot), then → for the next step
  await page.keyboard.press("Tab");
  await expect(stepper.getByRole("button", { name: "Step 1" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(heading).toHaveText(`Step 2 of ${n}`);
  await expect(heading).toBeFocused();
  // Enter walks on from the step heading
  for (let i = 2; i <= ask; i++) {
    await page.keyboard.press("Enter");
    await expect(heading).toHaveText(`Step ${i + 1} of ${n}`);
  }
  // on the ask, the first Enter goes to "Show me" instead of skipping it
  const step = lesson.steps[ask];
  await page.keyboard.press("Enter");
  await expect(heading).toHaveText(`Step ${ask + 1} of ${n}`);
  await expect(stepper.getByRole("button", { name: "Show me" })).toBeFocused();
  // M turns the computer keys on; play the answer on them
  await page.keyboard.press("m");
  for (const pc of step.ask!.answer.map(chroma)) await page.keyboard.press(QWERTY[pc]);
  await expect(stepper.locator("[data-step-text]")).toContainText(`✓ ${listOf(step.ask!.answer.map(prettyNote))}`);
  await expect(heading).toBeFocused();
  for (let i = ask + 1; i < n; i++) {
    await page.keyboard.press("Enter");
    await expect(heading).toHaveText(`Step ${i + 1} of ${n}`);
  }
  await expect(card.getByText("Recreate it")).toBeVisible();
  // the last Enter is Done: the lesson closes and focus goes back to "Why it works"
  await page.keyboard.press("Enter");
  await expect(stepper).toHaveCount(0);
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await expect(why).toBeFocused();
  await page.keyboard.press("m"); // computer keys off again
});

test("an open lesson passes an axe scan, on the ask and on the last step", async ({ page }) => {
  const { card, lesson } = await firstCard(page);
  await card.getByRole("button", { name: /Why it works/ }).click();
  const stepper = card.locator("[data-lesson-stepper]");
  await stepper.getByRole("button", { name: `Step ${askIndex(lesson) + 1}`, exact: true }).click();
  await expect(stepper.getByRole("button", { name: "Show me" })).toBeVisible();
  const scan = async () => (await new AxeBuilder({ page }).include("[data-move-id]").withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.length}`);
  expect(await scan()).toEqual([]);
  await stepper.getByRole("button", { name: `Step ${lesson.steps.length}`, exact: true }).click();
  await expect(card.getByText("Recreate it")).toBeVisible();
  expect(await scan()).toEqual([]);
});

test("a move without a lesson keeps the old Why it works body, with no stepper", async ({ page }) => {
  await page.goto("/?level=4");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await expect(tricks(page).locator("[data-move-id]").first()).toBeVisible();
  const ids = await tricks(page).locator("[data-move-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-move-id")!));
  const id = ids.find((i) => !hasRuleLesson(i.split("@")[0]));
  expect(id, "level 4 shows a rule without a lesson").toBeTruthy();
  const card = tricks(page).locator(`[data-move-id="${id}"]`);
  const head = card.locator("button[aria-expanded]").first();
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  await expect(head).toHaveAttribute("aria-expanded", "true");
  const why = card.getByRole("button", { name: /Why it works/ });
  await expect(why).toHaveAccessibleName(/^Why it works\s*▸?$/);
  await why.click();
  await expect(card.getByText("Recreate it")).toBeVisible();
  await expect(card.locator("[data-lesson-stepper]")).toHaveCount(0);
  await expect(card.getByText(/^Step \d+ of \d+$/)).toHaveCount(0);
  await expect(card.getByRole("heading", { name: "Voice leading" }).or(card.getByRole("region", { name: "Melody check" })).first()).toBeVisible();
});

/** Pick an Explanations setting in the ⚙ menu, then close the menu. */
async function setExplanations(page: Page, label: "Step by step" | "Just the rule") {
  const gear = page.getByRole("button", { name: "Settings" });
  await gear.click();
  const radio = page.getByRole("group", { name: "Settings" }).getByRole("radio", { name: label });
  await radio.check();
  await expect(radio).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(gear).toHaveAttribute("aria-expanded", "false");
}

test('⚙ "Just the rule" folds the Study lesson to headline + rule + "Step by step ›", and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const { card, lesson } = await firstCard(page);
  const why = card.getByRole("button", { name: /Why it works/ });
  await why.click();
  await expect(card.locator("[data-lesson-stepper]")).toBeVisible();

  // the setting overrides fading, live: the open lesson folds
  await setExplanations(page, "Just the rule");
  expect(await page.evaluate(() => localStorage.getItem("reharm.explain"))).toBe("rule");
  const folded = card.locator("[data-lesson-folded]");
  await expect(folded).toBeVisible();
  await expect(card.locator("[data-lesson-stepper]")).toHaveCount(0);
  await expect(folded.locator("[data-lesson-headline]")).toHaveText(lesson.headline);
  await expect(folded.getByText("Recreate it")).toBeVisible();
  await expect(folded.getByText(lesson.rule)).toBeVisible();
  // ▶ Before / After stay on the card face, right above
  await expect(card.getByRole("group", { name: "Hear it" }).getByRole("button", { name: /Before/ })).toBeVisible();

  // a reload keeps the choice: the lesson opens folded
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  const again = tricks(page).locator("[data-move-id]").first();
  await again.getByRole("button", { name: /Why it works/ }).click();
  await expect(again.locator("[data-lesson-folded]")).toBeVisible();
  await expect(again.locator("[data-lesson-stepper]")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("radio", { name: "Just the rule" })).toBeChecked();
  await page.keyboard.press("Escape");

  // "Step by step ›" opens the steps in place, focus on step 1
  await again.getByRole("button", { name: "Step by step ›" }).click();
  const heading = again.locator("[data-lesson-stepper] [data-step-heading]");
  await expect(heading).toHaveText(`Step 1 of ${lesson.steps.length}`);
  await expect(heading).toBeFocused();
  // still two disclosure levels at most
  expect((await deepestDisclosure(page)).depth).toBeLessThan(3);

  // back to Step by step: a new visitor's default
  await setExplanations(page, "Step by step");
  expect(errors).toEqual([]);
});

test("the demo's seeded sample never folds a lesson: the steps stay open (rule 11)", async ({ page }) => {
  const { card, lesson } = await firstCard(page);
  // the sample has clean keys of this concept, so only the guard keeps the steps open
  const sample = JSON.parse(readFileSync("apps/web/src/library/demoHistory.json", "utf8")) as { concepts: { ruleId: string; cleanRuns: number }[] };
  expect(sample.concepts.some((c) => c.ruleId === lesson.conceptId && c.cleanRuns > 0), `the sample has a clean key of ${lesson.conceptId}`).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("reharm.explain"))).toBeNull();
  await card.getByRole("button", { name: /Why it works/ }).click();
  await expect(card.locator("[data-lesson-stepper] [data-step-heading]")).toHaveText(`Step 1 of ${lesson.steps.length}`);
  await expect(card.locator("[data-lesson-folded]")).toHaveCount(0);
  await expect(card.locator("[data-explain-notice]")).toHaveCount(0);
});

/**
 * The disclosure cap: card → Why it works, and nothing folds deeper. For every element, count the
 * ancestors that are a disclosure: an element carrying aria-expanded, or the region an open
 * aria-expanded control names in aria-controls (popovers, aria-haspopup, aren't folds).
 */
async function deepestDisclosure(page: Page) {
  return page.evaluate(() => {
    const regions = new Set<Element>();
    for (const c of document.querySelectorAll('[aria-expanded="true"]:not([aria-haspopup])')) {
      for (const id of (c.getAttribute("aria-controls") ?? "").split(/\s+/).filter(Boolean)) {
        const r = document.getElementById(id);
        if (r) regions.add(r);
      }
    }
    let worst = { depth: 0, el: "" };
    for (const el of document.querySelectorAll("body *")) {
      let depth = 0;
      for (let a = el.parentElement; a; a = a.parentElement) if (a.hasAttribute("aria-expanded") || regions.has(a)) depth++;
      if (depth > worst.depth) worst = { depth, el: el.outerHTML.slice(0, 120) };
    }
    return worst;
  });
}

test("no element sits under 3 or more aria-expanded levels, with the lesson open on every step", async ({ page }) => {
  const { card, lesson } = await firstCard(page);
  await card.getByRole("button", { name: /Why it works/ }).click();
  const stepper = card.locator("[data-lesson-stepper]");
  for (let i = 0; i < lesson.steps.length; i++) {
    await stepper.getByRole("button", { name: `Step ${i + 1}`, exact: true }).click();
    await expect(stepper.locator("[data-step-heading]")).toHaveText(`Step ${i + 1} of ${lesson.steps.length}`);
    const worst = await deepestDisclosure(page);
    // the card's body (1) and the Why it works body (2) are the only levels
    expect(worst.depth, worst.el).toBeLessThan(3);
    expect(worst.depth).toBe(2);
  }
});
