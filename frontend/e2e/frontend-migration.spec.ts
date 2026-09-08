import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ComponentDetailResponse, DegreeDetailResponse, StudyPlan } from "../src/types/handbook";

const fixture = JSON.parse(readFileSync(new URL("../src/domain/fixtures/handbook-2026.json", import.meta.url), "utf8")) as {
  accounting: DegreeDetailResponse; engineering: DegreeDetailResponse; usyd: DegreeDetailResponse;
  engineeringPlans: StudyPlan[]; accountingPlans: StudyPlan[]; details: Record<string, ComponentDetailResponse>; usydComponent: ComponentDetailResponse;
};
const baselineDir = join(tmpdir(), "uni-planner-tailwind-baseline");

/** Capture representative geometry and paint before/after the styling migration. */
async function capture(page: Page, name: string) {
  await page.mouse.move(0, 0);
  const metrics = await page.locator("main").last().evaluate(root => Array.from(root.querySelectorAll("h1,h2,button,input,select,summary,fieldset,article"))
    .filter(el => el.getBoundingClientRect().width > 0).slice(0, 100).map(el => {
      const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
      return { tag: el.tagName, width: Math.round(rect.width), height: Math.round(rect.height), color: css.color, background: css.backgroundColor, font: css.fontSize, padding: css.padding, border: css.borderWidth };
    }));
  mkdirSync(baselineDir, { recursive: true });
  const path = join(baselineDir, `${name}.json`);
  if (process.env.CAPTURE_TAILWIND_BASELINE) {
    writeFileSync(path, JSON.stringify(metrics, null, 2));
    await page.screenshot({ path: join(baselineDir, `${name}.png`), fullPage: true });
  } else if (existsSync(path)) {
    const baseline = JSON.parse(readFileSync(path, "utf8"));
    // The original variant select overflowed the 390px viewport; constrain only that width.
    if (name === "engineering-390") baseline.forEach((entry: typeof metrics[number]) => {
      if (entry.tag === "SELECT" && entry.width > 390) entry.width = 358;
    });
    expect(metrics, `Preserve baseline geometry and paint for ${name}`).toEqual(baseline);
  }
  if (!process.env.CAPTURE_TAILWIND_BASELINE) {
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll("main *")).filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 60), width: el.getBoundingClientRect().width })).slice(0, 12));
    expect(overflow, `No horizontal overflow: ${name}`).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
  }
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    let body: unknown = {};
    if (path === "/api/universities") body = [fixture.accounting.degree.university, fixture.usyd.degree.university];
    else if (path.includes("/handbooks/latest")) body = { year: 2026 };
    else if (/\/universities\/.*\/degrees$/.test(path)) body = path.includes("USYD") ? [fixture.usyd.degree] : [fixture.engineering.degree, fixture.accounting.degree];
    else if (path.includes("/study-plans")) body = path.includes("C09066") ? fixture.engineeringPlans : path.includes("C10235") ? fixture.accountingPlans : [];
    else if (path.includes("/degrees/")) body = path.includes("C09066") ? fixture.engineering : path.includes("C10235") ? fixture.accounting : fixture.usyd;
    else if (path.includes("/components/")) body = [...Object.values(fixture.details), fixture.usydComponent].find(detail => [detail.component.code, detail.component.id].includes(decodeURIComponent(path.split("/").at(-1)!))) ?? {};
    else if (path === "/api/chat/glossary") body = { answer: "A credit point measures study load." };
    await route.fulfill({ json: body });
  });
});

for (const width of [1440, 1280, 768, 390]) {
  test(`Frontend pages retain their appearance at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /UTS/ })).toBeVisible();
    await capture(page, `home-${width}`);
    await page.getByRole("button", { name: /UTS/ }).click();
    await expect(page.getByRole("button", { name: /C09066/ })).toBeVisible();
    expect(await page.getByRole("navigation", { name: "Breadcrumb" }).locator("li").first().evaluate(el => getComputedStyle(el, "::after").content)).toBe('"/"');
    await capture(page, `degrees-${width}`);
    await page.getByRole("button", { name: /C09066/ }).click();
    await expect(page.getByRole("heading", { name: "Study plan", exact: true })).toBeVisible();
    await expect(page.getByText("Loading study plans")).toHaveCount(0);
    await capture(page, `engineering-${width}`);
    await page.getByRole("button", { name: "Degree planner home" }).click();
    await page.getByRole("button", { name: /USYD/ }).click();
    await page.getByRole("button", { name: new RegExp(fixture.usyd.degree.code) }).click();
    await expect(page.getByRole("heading", { name: "Course structure" })).toBeVisible();
    await capture(page, `usyd-${width}`);
    await page.getByRole("button", { name: "Open assistant" }).click();
    await expect(page.getByRole("complementary", { name: "Assistant" })).toBeVisible();
    await page.getByRole("textbox", { name: "Ask a terminology question" }).fill("What is a credit point?");
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page.getByText("A credit point measures study load.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole("button", { name: "Close assistant" }).click();
  });
}

test("Loading, error, retry, empty search and keyboard focus remain accessible", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/universities", async route => { await pending; await route.fulfill({ status: 500, json: { error: "Unavailable" } }); });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Loading universities");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  release();
  await expect(page.getByRole("alert")).toContainText("couldn't load");
  await page.unroute("**/api/universities");
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: /UTS/ }).click();
  await page.getByRole("searchbox").fill("no matching degree");
  await expect(page.getByRole("status")).toContainText("No degrees match");
});

test("UTS Nursing program selection and fixed roadmap work at desktop, tablet and mobile widths", async ({ page }) => {
  const nursing = JSON.parse(readFileSync(new URL("./fixtures/nursing-2026.json", import.meta.url), "utf8")) as {
    degree: DegreeDetailResponse; plans: StudyPlan[];
  };
  await page.route("**/api/universities/UTS/degrees?*", route => route.fulfill({ json: [nursing.degree.degree] }));
  await page.route("**/api/degrees/C10122?*", route => route.fulfill({ json: nursing.degree }));
  await page.route("**/api/degrees/C10122/study-plans?*", route => route.fulfill({ json: nursing.plans }));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.getByRole("button", { name: /UTS/ }).click();
    await page.getByRole("button", { name: /C10122/ }).click();
    await expect(page.getByRole("heading", { name: "Bachelor of Nursing", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Program choice/ }).click();
    await expect(page.getByText("Standard Program", { exact: true })).toBeVisible();
    await expect(page.getByText("Enrolled Nurse", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Study plan variant" }).selectOption(nursing.plans[0].id);
    await expect(page.locator(".plan-item").first()).toBeVisible();
    await page.getByRole("button", { name: "Customize plan" }).click();
    await expect(page.getByRole("button", { name: "Reset to official plan" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath(`nursing-${width}.png`), fullPage: true });
  }
});

test("Mobile glossary supports pending, error, retry, reduced motion and keyboard close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/chat/glossary", async route => { await pending; await route.fulfill({ status: 503, json: { error: "Please try again shortly." } }); });
  await page.goto("/");
  await page.getByRole("button", { name: "Open assistant" }).click();
  const input = page.getByRole("textbox", { name: "Ask a terminology question" });
  await expect(input).toBeFocused();
  await input.fill("What is a credit point?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Thinking…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sending question" })).toBeDisabled();
  const spinner = page.getByRole("button", { name: "Sending question" }).locator("span");
  expect(await spinner.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  release();
  await expect(page.getByText("Please try again shortly.")).toBeVisible();
  await page.unroute("**/api/chat/glossary");
  await input.fill("What is a credit point?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("A credit point measures study load.")).toBeVisible();
  await page.getByRole("button", { name: "Close assistant" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open assistant" })).toBeFocused();
});
