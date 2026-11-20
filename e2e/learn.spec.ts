import AxeBuilder from "@axe-core/playwright";
import { referenceTune } from "@reharm/theory-core";
import { expect, test } from "./fixtures";

/*
 * Lessons, on a desktop and (the `mobile` project) a Pixel 5. The stepper isn't mounted on a
 * screen until 3g, so for now this holds the ground it will stand on: the Study page loads with
 * a clean console and zero /api, and the move list has no WCAG A/AA violations axe can see.
 * 3g adds the stepper walk-through, the keyboard-only run and the axe scan of an open lesson.
 */

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
