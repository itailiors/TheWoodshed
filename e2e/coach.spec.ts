import AxeBuilder from "@axe-core/playwright";
import {
  canonicalLesson,
  chroma,
  conceptStates,
  hasRuleLesson,
  learnName,
  nextUp,
  prereqSummary,
  anyLesson,
  basicsLesson,
  referenceTune,
  RULES,
  type Lesson,
} from "@reharm/theory-core";
import type { Page } from "@playwright/test";
import { expect, installFakeMidi, test, type FakeMidi } from "./fixtures";

/*
 * Coach's stage ladder (3d): Learn → Study it → Self-check → Play it, on a desktop and (the
 * `mobile` project) a Pixel 5, in the static demo build. Learn renders the lesson INSTEAD of the
 * drill: the isolation test plays notes through every Learn step (computer keys, the on-screen
 * keys and a fake MIDI keyboard) and checks the browser's practice store is untouched and the
 * passport is still the sample notebook. Nothing here plays a drill, so nothing is ever saved.
 */

const KEY = referenceTune.key.tonic;
const TRITONE_SUB = "dominant.tritoneSub";
const FIRST = nextUp(conceptStates({ concepts: [], cleanKeys: {} }, {}, new Date()), 1)[0];
/** The QWERTY key for a pitch class (A = C … J = B, M switches it on). */
const QWERTY = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j"];

async function openCoach(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  await page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name: "Coach" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
}

const stages = (page: Page) => page.getByRole("navigation", { name: "Stages" });
const learnStage = (page: Page) => page.locator("[data-coach-learn]");
const stepHeading = (page: Page) => page.locator("[data-coach-learn] [data-step-heading]");
const prereqNote = (page: Page) => page.getByRole("note", { name: "Builds on" });

/** Click a concept under "All concepts" on the "Your path" rail (on a phone, in the "Your path ▾" sheet). */
async function pickConcept(page: Page, ruleId: string) {
  const sheet = page.getByRole("button", { name: /^Your path/ });
  if (await sheet.isVisible()) await sheet.click();
  const nav = page.getByRole("navigation", { name: "What to drill" });
  const all = nav.getByRole("button", { name: /^All concepts/ });
  if ((await all.getAttribute("aria-expanded")) === "false") await all.click();
  // the tier list's entry ("Tritone substitution L2 · …"), not a due review of it ("Tritone substitution in F")
  const name = learnName(ruleId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await nav.locator("#coach-all-concepts").getByRole("button", { name: new RegExp(`^${name}(\\s|$)`) }).click();
}

/** What the browser's practice store holds (IndexedDB `reharm-practice`), or "absent". */
async function practiceStore(page: Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "reharm-practice")) return "absent";
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("reharm-practice");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const count = (s: string) =>
      new Promise<number>((res) => {
        if (!db.objectStoreNames.contains(s)) return res(0);
        const q = db.transaction(s).objectStore(s).count();
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(-1);
      });
    const out = { reviews: await count("reviews"), attempts: await count("coachAttempts"), improv: await count("improvRuns"), changes: await count("changesSessions") };
    db.close();
    return JSON.stringify(out);
  });
}

const flagsOf = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem("reharm.lessons") ?? "null") as { flags: Record<string, Record<string, unknown>> } | null)?.flags ?? {});

test("a fresh visitor's first Coach view is the path's first lesson, step 1, with no prerequisite note", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await openCoach(page);
  expect(FIRST).toMatch(/^basics:/);
  await expect(learnStage(page)).toHaveAttribute("data-coach-learn", FIRST);
  const lesson = basicsLesson(FIRST, KEY)!;
  await expect(stepHeading(page)).toHaveText(`Step 1 of ${lesson.steps.length}`);
  await expect(prereqNote(page)).toHaveCount(0);
  // a basic has no drill: its ladder is Learn alone, the current stage
  await expect(stages(page).getByRole("button", { name: "Learn" })).toHaveAttribute("aria-current", "step");
  await expect(stages(page).getByRole("button", { name: "Play it" })).toHaveCount(0);
  await expect(page.locator("#coach-h")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("RULE 11: a fresh demo's Coach shows no unlabelled sample due list or clean counts", async ({ page }) => {
  await openCoach(page);
  await expect(learnStage(page)).toBeVisible();
  // the sample notebook's due reviews are someone else's: no "Due for review" box, no "n due" on the phone's button
  await expect(page.getByRole("heading", { name: /Due for review/i, includeHidden: true })).toHaveCount(0);
  await expect(page.getByText(/\boverdue\b/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /\d+ due/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /\d+ due/ })).toHaveCount(0);
  // a basic has no drill: no 12-key ribbon
  await expect(page.locator("[data-coach-ribbon]")).toBeHidden();

  // the tritone sub is clean in several keys of the sample: the ribbon counts only your own (none yet)
  await pickConcept(page, TRITONE_SUB);
  await expect(page.locator("[data-coach-ribbon]")).toContainText("0/12 clean");
  // the passport aside still shows the sample's stamps, labelled where they're seen
  await expect(page.locator("[data-coach-sample]")).toContainText("Sample notebook");
  // anything else reading "n/12 clean" in the rail or the drill would be the sample's, unlabelled
  const counts = await page.locator("#coach-moves, #coach-drill").evaluateAll((els) => els.map((e) => e.textContent ?? "").join(" ").match(/[1-9]\d*\/12 clean/gi) ?? []);
  expect(counts).toEqual([]);
});

test("the tritone sub shows its prerequisite note; Continue anyway opens step 1, Next walks one step at a time, and the last step lands on Study it", async ({ page }) => {
  await openCoach(page);
  await pickConcept(page, TRITONE_SUB);
  const lesson = canonicalLesson(TRITONE_SUB, KEY)!;
  const n = lesson.steps.length;
  const summary = prereqSummary(TRITONE_SUB, KEY, { lessonFor: anyLesson })!;
  // one routing line: the note, with the lesson's headline; no stepper yet
  await expect(prereqNote(page)).toContainText(summary.sentence);
  await expect(learnStage(page).locator("[data-lesson-headline]")).toHaveText(lesson.headline);
  await expect(stepHeading(page)).toHaveCount(0);
  await expect(stages(page).getByRole("button", { name: "Learn" })).toHaveAttribute("aria-current", "step");

  await prereqNote(page).getByRole("button", { name: "Continue anyway" }).click();
  await expect(prereqNote(page)).toHaveCount(0);
  await expect(stepHeading(page)).toHaveText(`Step 1 of ${n}`);
  await expect(stepHeading(page)).toBeFocused();
  expect((await flagsOf(page))[TRITONE_SUB]).toMatchObject({ continuedAnyway: true });

  const next = learnStage(page).getByRole("button", { name: "Next ›" });
  for (let i = 1; i < n; i++) {
    await next.click();
    await expect(stepHeading(page)).toHaveText(`Step ${i + 1} of ${n}`);
  }
  await learnStage(page).getByRole("button", { name: "Study it ›" }).click();
  // finished (Familiar for the path) and handed to Study it: the drill, ungraded, with the Why card collapsed
  await expect(learnStage(page)).toHaveCount(0);
  await expect(stages(page).getByRole("button", { name: "Study it" })).toHaveAttribute("aria-current", "step");
  await expect(stages(page).getByRole("button", { name: /^Learn/ })).toContainText("Learn");
  await expect(page.locator("#coach-h")).toBeFocused();
  const why = page.locator("[data-why-card]");
  await expect(why).toContainText(lesson.headline);
  await expect(why).toContainText(lesson.rule);
  // (on a phone the card folds under the drill, as before: present, not yet shown)
  await expect(why.getByRole("button", { name: `Why? (${n} steps)`, includeHidden: true })).toHaveCount(1);
  expect((await flagsOf(page))[TRITONE_SUB]).toMatchObject({ finishedAt: expect.any(String), lastStage: "study" });

  // the note is gone for good, and Learn opens on step 1 again from the ladder
  await stages(page).getByRole("button", { name: /^Learn/ }).click();
  await expect(prereqNote(page)).toHaveCount(0);
  await expect(stepHeading(page)).toHaveText(`Step 1 of ${n}`);
});

test("Learn that first opens the prerequisite with the return banner, and its last step goes back", async ({ page }) => {
  await openCoach(page);
  await pickConcept(page, TRITONE_SUB);
  const first = prereqSummary(TRITONE_SUB, KEY, { lessonFor: anyLesson })!.prereqs[0].id;
  const pre = anyLesson(first, KEY)!;
  const from = learnName(TRITONE_SUB);
  await prereqNote(page).getByRole("button", { name: "Learn that first" }).click();
  await expect(learnStage(page)).toHaveAttribute("data-coach-learn", first);
  await expect(stepHeading(page)).toHaveText(`Step 1 of ${pre.steps.length}`);
  // the return banner lives in the stepper header, and it's the only routing line
  await expect(learnStage(page).getByText(`from ${from}`)).toBeVisible();
  await expect(prereqNote(page)).toHaveCount(0);
  for (let i = 1; i < pre.steps.length; i++) await learnStage(page).getByRole("button", { name: "Next ›" }).click();
  await learnStage(page).getByRole("button", { name: `Back to ${from} ›` }).click();
  await expect(learnStage(page)).toHaveAttribute("data-coach-learn", TRITONE_SUB);
  // what's still unmet is still recommended; the finished one isn't
  await expect(prereqNote(page)).toBeVisible();
  await expect(prereqNote(page)).not.toContainText(learnName(first).toLowerCase());
  await expect(learnStage(page).getByText(`from ${from}`)).toHaveCount(0);
});

test("every rule has a lesson, so every concept opens with a Learn stage on its ladder", async () => {
  // "a rule without a lesson has no Learn stage" lived here until 5d left no lessonless rule;
  // that fallback is unit-tested in apps/web/src/components/coach/gradingMode.test.ts
  expect(RULES.filter((r) => !hasRuleLesson(r.id)).map((r) => r.id)).toEqual([]);
});

test("Esc on an open glossary chip closes it and stays on Coach; Learn and the chip pass axe", async ({ page }) => {
  await openCoach(page);
  await pickConcept(page, TRITONE_SUB);
  await prereqNote(page).getByRole("button", { name: "Continue anyway" }).click();
  const lesson: Lesson = canonicalLesson(TRITONE_SUB, KEY)!;
  const scan = async () => (await new AxeBuilder({ page }).include("[data-coach-learn]").withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.length}`);
  await expect(stepHeading(page)).toHaveText(`Step 1 of ${lesson.steps.length}`);
  expect(await scan()).toEqual([]);

  // walk to the first step with a chip on its text
  const chip = learnStage(page).locator('[data-step-text] button[aria-haspopup="dialog"]');
  for (let i = 0; i < lesson.steps.length && (await chip.count()) === 0; i++) {
    await learnStage(page).getByRole("button", { name: `Step ${i + 1}`, exact: true }).click();
    await expect(stepHeading(page)).toHaveText(`Step ${i + 1} of ${lesson.steps.length}`);
    // an ask hides the text (and its chip) until it's answered
    if (await learnStage(page).getByRole("button", { name: "Show me" }).count()) await learnStage(page).getByRole("button", { name: "Show me" }).click();
  }
  await expect(chip.first()).toBeVisible();
  await chip.first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  expect(await scan()).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: /Comping coach/i })).toBeVisible();
  await expect(learnStage(page)).toBeVisible();
});

test("ISOLATION: notes through every Learn step (computer keys, on-screen keys, MIDI, the ask) save nothing", async ({ page }) => {
  await page.addInitScript(installFakeMidi);
  await openCoach(page);
  const send = (bytes: number[]) => page.evaluate((b) => (window as unknown as { __fakeMidi: FakeMidi }).__fakeMidi.send(b), bytes);
  await page.getByRole("button", { name: /Connect MIDI/ }).click();
  await expect(page.getByRole("button", { name: /MIDI connected/ })).toBeVisible();
  const before = await practiceStore(page);
  expect(before === "absent" || JSON.parse(before).reviews === 0).toBe(true);

  await pickConcept(page, TRITONE_SUB);
  await prereqNote(page).getByRole("button", { name: "Continue anyway" }).click();
  const lesson = canonicalLesson(TRITONE_SUB, KEY)!;
  const n = lesson.steps.length;
  await page.keyboard.press("m"); // the computer keys on
  for (let i = 0; i < n; i++) {
    await expect(stepHeading(page)).toHaveText(`Step ${i + 1} of ${n}`);
    const step = lesson.steps[i];
    // a chord on the MIDI keyboard (the ask's answer on the ask, else C E G B♭), struck and released
    const notes = step.ask ? step.ask.answer.map((a) => 60 + chroma(a)) : [60, 64, 67, 70];
    for (const m of notes) await send([0x90, m, 90]);
    for (const m of notes) await send([0x80, m, 0]);
    if (step.ask) await expect(learnStage(page).locator("[data-step-text]")).toContainText(step.text);
    // the computer keys and one on-screen key
    for (const k of ["a", "d", "g"]) await page.keyboard.press(k);
    const key = learnStage(page).locator("rect[data-midi]").first();
    if (await key.count()) await key.dispatchEvent("pointerdown", { pointerType: "mouse" });
    await page.waitForTimeout(250);
    await learnStage(page).getByRole("button", { name: i === n - 1 ? "Study it ›" : "Next ›" }).click();
  }
  await page.keyboard.press("m"); // off again, before the drill
  await expect(stages(page).getByRole("button", { name: "Study it" })).toHaveAttribute("aria-current", "step");
  await page.waitForTimeout(500);
  expect(await practiceStore(page)).toBe(before);

  // the passport is still the sample notebook (nothing of the player's own: progress().sample is true)
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 1, name: referenceTune.title })).toBeVisible();
  // the side rail's passport on a desktop, "📒 Progress" on a phone
  await page.getByRole("button", { name: /^(My progress \(concept passport\)|📒 Progress)$/ }).locator("visible=true").first().click();
  await expect(page.getByRole("dialog", { name: /Concept passport/i })).toContainText("Sample notebook");
  expect(await practiceStore(page)).toBe(before);
});
