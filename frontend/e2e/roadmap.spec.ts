import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, DegreeDetailResponse, StudyPlan } from "../src/types/handbook";

const fixture = JSON.parse(readFileSync(new URL("../src/domain/fixtures/handbook-2026.json", import.meta.url), "utf8")) as {
  engineering: DegreeDetailResponse; accounting: DegreeDetailResponse; usyd: DegreeDetailResponse;
  engineeringPlans: StudyPlan[]; accountingPlans: StudyPlan[]; details: Record<string, ComponentDetailResponse>; usydComponent: ComponentDetailResponse;
};
const failures = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  failures.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /unique.*key|maximum update depth/i.test(message.text())) errors.push(message.text()); });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    let body: unknown = {};
    if (path === "/api/universities") body = [fixture.accounting.degree.university, fixture.usyd.degree.university];
    else if (path.includes("/handbooks/latest")) body = { year: 2026 };
    else if (/\/universities\/.*\/degrees$/.test(path)) body = path.includes("USYD") ? [fixture.usyd.degree] : [fixture.engineering.degree, fixture.accounting.degree];
    else if (path.includes("/study-plans")) body = path.includes("C09066") ? fixture.engineeringPlans : path.includes("C10235") ? fixture.accountingPlans : [];
    else if (path.includes("/degrees/")) body = path.includes("C09066") ? fixture.engineering : path.includes("C10235") ? fixture.accounting : fixture.usyd;
    else if (path.includes("/components/")) body = [...Object.values(fixture.details), fixture.usydComponent].find((detail) => [detail.component.code, detail.component.id].includes(decodeURIComponent(path.split("/").at(-1)!))) ?? { error: "Component not captured" };
    else if (path.endsWith("/subjects/search")) body = [{ id: "test-elective", code: "TEST100", name: "Test elective", creditPoints: 6, prerequisiteStatus: "UNKNOWN", recommendation: "UNVERIFIED" }];
    await route.fulfill({ json: body });
  });
});
test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });
const openDegree = async (page: Page, code: string, university = "UTS") => {
  await page.goto("/");
  await page.locator(".university-card").filter({ hasText: university }).click();
  await page.locator(".degree-row").filter({ hasText: code }).click();
  await expect(page.locator(".degree-hero")).toContainText(code);
};

test("Accounting empty state, sub-major options, replacement/removal and persisted reload", async ({ page }) => {
  await openDegree(page, "C10235");
  const path = page.locator(".study-path");
  await expect(path.locator("select").first()).toHaveValue("");
  await expect(page.locator(".roadmap-aggregate")).toHaveCount(3);
  await path.locator("select").first().selectOption({ label: "Two sub-majors" });
  await expect(path.locator(".pathway-selection select").nth(0)).toHaveValue("");
  await expect(path.locator(".pathway-selection select").nth(1)).toHaveValue("");
  await path.locator(".pathway-selection select").nth(0).selectOption("SMJ08109");
  await path.locator(".pathway-selection select").nth(1).selectOption("SMJ08138");
  await expect(path.locator(".selected-path-preview")).toHaveCount(2);
  await expect(path.locator(".pathway-selection select").nth(1).locator('option[value="SMJ08109"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  const slot = page.locator(".plan-item--choice").filter({ hasText: "Marketing · Options" }).first();
  await slot.locator(".plan-item__main-action").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".subject-pool")).toHaveCount(1);
  await expect(dialog.locator(".subject-result")).toHaveCount(8);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await dialog.getByRole("button", { name: "Select", exact: true }).first().click();
  await expect(dialog).not.toBeVisible();
  await slot.locator(".plan-item__main-action").click();
  await dialog.getByRole("button", { name: "Replace current option", exact: true }).last().click();
  await expect(slot).toContainText("Selected subject");
  await openDegree(page, "C10235");
  await expect(page.locator(".plan-item--filled")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove subject & restore choice" }).click();
  await expect(page.locator(".plan-item--filled")).toHaveCount(0);
  await slot.locator(".plan-item__main-action").click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(slot.locator(".plan-item__main-action")).toBeFocused();
});

test("Accounting broad electives and confirmed pathway change preserve compulsory subjects", async ({ page }) => {
  await openDegree(page, "C10235");
  const path = page.locator(".study-path");
  await path.locator("select").first().selectOption({ label: "Sub-major + electives" });
  await path.locator(".pathway-selection select").selectOption("SMJ08138");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  const electives = page.locator(".plan-item--choice").filter({ has: page.getByRole("heading", { name: "Electives · 6 CP choice" }) });
  await expect(electives).toHaveCount(4);
  await electives.first().locator(".plan-item__main-action").click();
  await page.getByLabel("Search by subject code or name").fill("Test");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Select", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await path.locator("select").first().selectOption({ label: "Second major" });
  await expect(path.locator("select").first()).toHaveValue(/sub-major-and-electives$/);
  page.once("dialog", (dialog) => dialog.accept());
  await path.locator("select").first().selectOption({ label: "Second major" });
  await expect(path.locator(".pathway-selection select")).toHaveValue("");
  await expect(page.locator(".plan-item--filled")).toHaveCount(0);
  await path.locator(".pathway-selection select").selectOption("MAJ08441");
  await expect(page.locator(".roadmap-aggregate .plan-item")).toHaveCount(8);
  await expect(page.locator(".plan-years")).toContainText("Accounting and Accountability");
});

test("Engineering Data Science major/variant synchronization and exact candidates", async ({ page }) => {
  await openDegree(page, "C09066");
  const major = page.locator(".study-path").getByRole("combobox", { name: "Major", exact: true });
  await major.selectOption("MAJ03518");
  await expect(page.locator(".plan-intro h3")).toHaveText("Data Science Engineering major, Autumn commencing, full time");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await expect(page.locator(".plan-item--choice").filter({ hasText: "CBK92152" })).toHaveCount(3);
  await page.locator(".plan-item--choice").filter({ hasText: "CBK92152" }).first().locator(".plan-item__main-action").click();
  await expect(page.getByRole("dialog").locator(".subject-result")).toHaveCount(11);
  await page.keyboard.press("Escape");
  const variant = fixture.engineeringPlans.find((plan) => plan.major?.code === "MAJ03537")!;
  await page.locator(".plan-selector select").selectOption(variant.id);
  await expect(major).toHaveValue("MAJ03537");
  await major.selectOption("MAJ03518");
  await expect(page.locator(".plan-intro h3")).toContainText("Data Science");
  await openDegree(page, "C09066");
  await expect(major).toHaveValue("MAJ03518");
  await expect(page.locator(".plan-intro h3")).toContainText("Data Science");
});

test("Narrow layout and compact empty dialog retain a visible close control", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDegree(page, "C10235");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await page.locator(".plan-item--choice .plan-item__main-action").first().click();
  await expect(page.getByRole("button", { name: "Close subject selector" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("Every imported Engineering major and every mapped variant reconcile in the browser", async ({ page }) => {
  await openDegree(page, "C09066");
  const major = page.locator(".study-path").getByRole("combobox", { name: "Major", exact: true });
  const majors = fixture.engineering.requirements.flatMap((group) => group.items.flatMap((item) => item.component?.type === "MAJOR" ? [item.component] : []));
  for (const component of majors) {
    await major.selectOption(component.code);
    await expect(major).toHaveValue(component.code);
    const variants = fixture.engineeringPlans.filter((plan) => plan.major?.id === component.id);
    if (variants.length === 1) await expect(page.locator(".plan-intro h3")).toHaveText(variants[0].title);
    else if (!variants.length) await expect(page.locator(".selection-notice").last()).toContainText("No mapped official study plan");
  }
  for (const variant of fixture.engineeringPlans) {
    await page.locator(".plan-selector select").selectOption(variant.id);
    await expect(major).toHaveValue(variant.major!.code);
    await expect(page.locator(".plan-intro h3")).toHaveText(variant.title);
  }
});

test("USYD degree requirements remain available", async ({ page }) => {
  await openDegree(page, fixture.usyd.degree.code, "USYD");
  await expect(page.locator(".requirements-section")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("undefined");
  await expect(page.locator(".roadmap-aggregate")).toHaveCount(0);
});
