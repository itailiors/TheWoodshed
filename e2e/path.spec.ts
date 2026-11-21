import AxeBuilder from "@axe-core/playwright";
import { basicsLesson, CONCEPTS, conceptStates, learnName, nextUp, referenceTune } from "@reharm/theory-core";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * The passport's Path tab and the Coach's "Your path" rail (3e), on a desktop and (the `mobile`
 * project) a Pixel 5, in the static demo build. The demo's seeded sample notebook has the tritone
 * sub clean in many keys, but path states come only from this browser's own runs and lessons
 * (rule 11): the sub stays "Recommended first", and Next up is the foundations.
 */

const TRITONE_SUB = "dominant.tritoneSub";
const KEY = referenceTune.key.tonic;
const FRESH_NEXT = nextUp(conceptStates({ concepts: [], cleanKeys: {} }, {}, new Date()), 4);

async function openPath(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  // the side rail's passport on a desktop, "📒 Progress" on a phone
  await page.getByRole("button", { name: /^(My progress \(concept passport\)|📒 Progress)$/ }).locator("visible=true").first().click();
  const dialog = page.getByRole("dialog", { name: /Concept passport/i });
  // it still opens on Today's practice
  await expect(dialog.getByRole("tab", { name: "Today's practice" })).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("tab", { name: "Path" }).click();
  await expect(dialog.locator("[data-path] [data-concept]").first()).toBeAttached();
  return dialog;
}

/** A Path card; its tier band may be folded (at every width), so unfold it first. */
async function card(page: Page, id: string) {
  const c = page.locator(`[data-path] [data-concept="${id}"]`);
  const toggle = page.locator(`[data-path] section[data-tier="${CONCEPTS.find((n) => n.id === id)!.tier}"]`).getByRole("button").first();
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(c).toBeVisible();
  return c;
}

test("Path: the foundations are next up, and the tritone sub is Recommended first despite the sample; axe clean", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const dialog = await openPath(page);
  await expect(dialog.locator("[data-path-sample]")).toHaveText(/The sample notebook isn't counted\./);
  // the passport header still says the stamps are a sample
  await expect(dialog).toContainText("Sample notebook");

  expect(FRESH_NEXT.every((id) => id.startsWith("basics:"))).toBe(true);
  const marked = await dialog.locator("[data-path] [data-next]").evaluateAll((els) => els.map((e) => e.getAttribute("data-concept")));
  expect(marked).toEqual(FRESH_NEXT);
  await expect(await card(page, FRESH_NEXT[0])).toContainText("→ next");

  const sub = await card(page, TRITONE_SUB);
  await expect(sub).toHaveAttribute("data-state", "recommendedFirst");
  await expect(sub).toContainText("Recommended first: The tritone +1 →");
  await expect(sub).not.toContainText("/12");
  await expect(sub).not.toContainText("CLEAN");
  // every concept is there, and nothing reads above Recommended first
  await expect(dialog.locator("[data-path] [data-concept]")).toHaveCount(CONCEPTS.length);
  const states = await dialog.locator("[data-path] [data-concept]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-state")))]);
  expect(states.every((s) => s === "new" || s === "recommendedFirst")).toBe(true);

  // its prerequisites on focus (a phone has no hover)
  await sub.focus();
  await expect(sub).toContainText("Builds on: The tritone, Dominant resolution");

  const axe = await new AxeBuilder({ page }).include("[data-path]").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  // the tab open is counted (this browser only)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("reharm.panelOpens") ?? "{}")["passport.path"]?.opens)).toBe(1);
  expect(errors).toEqual([]);
});

test("Path: a card opens the Coach on its concept (a rule shows its note; a foundation its Learn)", async ({ page }) => {
  await openPath(page);
  await (await card(page, TRITONE_SUB)).click();
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  await expect(page.locator("[data-coach-learn]")).toHaveAttribute("data-coach-learn", TRITONE_SUB);
  await expect(page.getByRole("note", { name: "Builds on" })).toBeVisible();
  // the drawer that held the card is gone: focus lands on the note's first action, not <body>
  await expect(page.getByRole("note", { name: "Builds on" }).getByRole("button", { name: "Learn that first" })).toBeFocused();

  // Esc never leaves Coach from a lesson (P6): back to Study with the tab
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Study" }).click();
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await openPathAgain(page);
  const basic = FRESH_NEXT[1];
  await (await card(page, basic)).click();
  await expect(page.locator("[data-coach-learn]")).toHaveAttribute("data-coach-learn", basic);
  await expect(page.locator("[data-coach-learn] [data-step-heading]")).toHaveText(`Step 1 of ${basicsLesson(basic, KEY)!.steps.length}`);
  await expect(page.locator("[data-coach-learn] [data-step-heading]")).toBeFocused();
});

async function openPathAgain(page: Page) {
  await page.getByRole("button", { name: /^(My progress \(concept passport\)|📒 Progress)$/ }).locator("visible=true").first().click();
  await page.getByRole("dialog", { name: /Concept passport/i }).getByRole("tab", { name: "Path" }).click();
}

test("the passport's tabs move with the arrow keys (roving tabindex, Enter picks)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^(My progress \(concept passport\)|📒 Progress)$/ }).locator("visible=true").first().click();
  const dialog = page.getByRole("dialog", { name: /Concept passport/i });
  const today = dialog.getByRole("tab", { name: "Today's practice" });
  const path = dialog.getByRole("tab", { name: "Path" });
  await expect(path).toHaveAttribute("tabindex", "-1");
  await today.focus();
  await page.keyboard.press("ArrowRight");
  await expect(path).toBeFocused();
  await page.keyboard.press("Home");
  await expect(today).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(path).toHaveAttribute("aria-selected", "true");
  await expect(path).toHaveAttribute("tabindex", "0");
});

test("the deep link #coach/<conceptId> opens the Coach on that concept", async ({ page }) => {
  await page.goto(`/#coach/${TRITONE_SUB}`);
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  await expect(page.locator("[data-coach-learn]")).toHaveAttribute("data-coach-learn", TRITONE_SUB);
});

test("Coach's rail is Your path: Next up first, then All concepts by tier with the foundations included", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Coach" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();

  const sheetBtn = page.getByRole("button", { name: /^Your path/ });
  const phone = await sheetBtn.isVisible();
  if (phone) {
    // a phone: the Next up chips scroll above the drill, the whole rail is one tap away in a sheet
    await expect(page.getByRole("navigation", { name: "Next up" }).getByRole("button")).toHaveText(FRESH_NEXT.map(learnName));
    await sheetBtn.click();
    await expect(page.getByRole("dialog", { name: "Your path" })).toBeVisible();
  }
  const nav = page.getByRole("navigation", { name: "What to drill" });
  const next = nav.locator("[data-next-up] [data-rail-concept]");
  expect(await next.evaluateAll((els) => els.map((e) => e.getAttribute("data-rail-concept")))).toEqual(FRESH_NEXT);
  await expect(nav.locator("[data-next-up]")).toContainText("New · a foundation");
  await expect(nav).not.toContainText("Jazz Concepts");

  const all = nav.getByRole("button", { name: /^All concepts/ });
  await expect(all).toHaveAttribute("aria-expanded", "false");
  await all.click();
  const list = nav.locator("#coach-all-concepts");
  await expect(list.locator("[data-rail-concept]")).toHaveCount(CONCEPTS.length);
  await expect(list.getByRole("region", { name: "Foundations" })).toContainText(learnName("basics:guideTones"));
  // a Recommended-first chip opens the first unmet prerequisite's Learn, with the way back
  await list.locator(`[data-rail-concept="${TRITONE_SUB}"]`).getByRole("button", { name: /^Recommended first: The tritone \+1/ }).click();
  await expect(page.locator("[data-coach-learn]")).toHaveAttribute("data-coach-learn", "basics:tritone");
  await expect(page.locator("[data-coach-learn]").getByText(`from ${learnName(TRITONE_SUB)}`)).toBeVisible();

  if (phone) {
    // the sheet closed on the pick; Esc in a reopened sheet closes only the sheet
    await expect(page.getByRole("dialog", { name: "Your path" })).toHaveCount(0);
    await sheetBtn.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Your path" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  }
});
