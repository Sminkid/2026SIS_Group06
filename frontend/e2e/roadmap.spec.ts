import { test, expect, type Page, type Locator } from "@playwright/test";
import type { SubjectAccessConditions } from "../src/types/subject";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, DegreeDetailResponse, StudyPlan } from "../src/types/handbook";
import { requiredBranch } from "../src/domain/studyPathDependencies";

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
  const slot = page.locator(".plan-item--choice").filter({ hasText: "Counts toward: Marketing" }).first();
  await slot.locator(".plan-item__main-action").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".subject-pool")).toHaveCount(2);
  await expect(dialog.locator(".subject-result")).toHaveCount(11);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await dialog.locator(".subject-pool--selectable").getByRole("button", { name: "Select", exact: true }).first().click();
  await expect(dialog).not.toBeVisible();
  await slot.locator(".plan-item__main-action").click();
  await dialog.getByRole("button", { name: "Replace current option", exact: true }).last().click();
  await expect(slot).toContainText("Selected subject");
  let releaseDetails!: () => void;
  const detailsPending = new Promise<void>(resolve => { releaseDetails = resolve; });
  await page.route("**/api/components/*", async route => { await detailsPending; await route.fallback(); });
  try {
    await openDegree(page, "C10235");
    // Restored allocations must survive even when roadmap templates arrive before component details.
    await expect(page.locator(".plan-item--filled")).toHaveCount(1);
  } finally { releaseDetails(); }
  await expect(path.locator(".selected-path-preview")).toHaveCount(2);
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
    const majorGroup = fixture.engineering.requirements.find(group => group.items.some(item => item.component?.type === "MAJOR"))!;
    const rule = fixture.engineering.requirements.find(group => group.description?.includes("aligned 24cp"))!;
    const required = requiredBranch(rule, { [majorGroup.id]: component.code }, fixture.engineering.requirements)!;
    await expect(page.locator(".required-pathway")).toContainText(required.title!);
    for (const branch of rule.children) await expect(page.locator(`.study-path option[value="GROUP:${branch.id}"]`)).toHaveCount(0);
    await expect(page.locator(".path-decision__detail").last()).toContainText(required.title!);
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

test("Accounting Core starts outstanding; equivalent positions expose the same pools and preserve quotas", async ({ page }) => {
  await openDegree(page, "C10235");
  const path = page.locator(".study-path");
  await path.locator("select").first().selectOption({ label: "Sub-major + electives" });
  await path.locator(".pathway-selection select").selectOption("SMJ08109");
  await expect(path).toContainText("Required Core remaining: 3");
  await expect(path.locator(".missing-subject")).toContainText("21228");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await expect(page.locator(".plan-item--filled")).toHaveCount(0);
  const slots = page.locator(".plan-item--choice").filter({ hasText: "Counts toward: Management Consulting" });
  await expect(slots).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    await slots.nth(index).locator(".plan-item__main-action").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".subject-pool")).toHaveCount(2);
    await expect(dialog.locator(".subject-result").filter({ hasText: "21510" })).toContainText("Required Core");
    await expect(dialog.locator(".subject-result").filter({ hasText: "21228" })).toHaveCount(0);
    await expect(dialog.getByLabel("Search by subject code or name")).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  for (const code of ["21510", "21511"]) {
    await slots.filter({ hasText: "Choose a required Core" }).first().locator(".plan-item__main-action").click();
    await page.getByRole("dialog").locator(".subject-result").filter({ hasText: code }).getByRole("button", { name: "Select", exact: true }).click();
  }
  await expect(path).toContainText("Required Core remaining: 1");
  await slots.filter({ hasText: "Choose a required Core" }).first().locator(".plan-item__main-action").click();
  await page.getByRole("dialog").locator(".subject-pool--selectable").getByRole("button", { name: "Select", exact: true }).first().click();
  await slots.filter({ hasText: "Choose a required Core" }).first().locator(".plan-item__main-action").click();
  const optionButtons = page.getByRole("dialog").locator(".subject-pool--selectable button");
  for (const button of await optionButtons.all()) await expect(button).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator(".plan-item--filled").filter({ hasText: "21510" }).getByRole("button", { name: "Remove subject & restore choice" }).click();
  await expect(path).toContainText("Required Core remaining: 2");
});

test("Accounting cross-requirement swap, cancellation, empty move and reload retain Core allocation", async ({ page }) => {
  await openDegree(page, "C10235");
  const path = page.locator(".study-path");
  await path.locator("select").first().selectOption({ label: "Sub-major + electives" });
  await path.locator(".pathway-selection select").selectOption("SMJ08138");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await page.locator(".plan-item--choice").filter({ hasText: "Counts toward: Marketing" }).first().locator(".plan-item__main-action").click();
  const core = page.getByRole("dialog").locator(".subject-result").filter({ hasText: "Required Core" }).first();
  const code = await core.locator(".subject-result__code").innerText();
  await core.getByRole("button", { name: "Select", exact: true }).click();
  await page.locator(".plan-item--choice").filter({ has: page.getByRole("heading", { name: "Electives · 6 CP choice" }) }).first().locator(".plan-item__main-action").click();
  await page.getByLabel("Search by subject code or name").fill("Test");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Select", exact: true }).click();
  const source = page.locator(".plan-item--filled").filter({ hasText: code });
  const target = page.locator(".plan-item--filled").filter({ hasText: "TEST100" });
  const beforeSource = await source.locator(".plan-item__note").filter({ hasText: "Scheduled:" }).innerText();
  const beforeTarget = await target.locator(".plan-item__note").filter({ hasText: "Scheduled:" }).innerText();
  await source.getByRole("button", { name: "Swap position" }).click();
  await expect(page.locator(".swap-target").first()).toBeVisible();
  await expect(page.locator(".swap-target:disabled")).toHaveCount(0);
  await expect(page.locator(".swap-targets")).not.toContainText("Locked official position");
  await page.getByRole("button", { name: "Cancel swap" }).click();
  await expect(source).toContainText(beforeSource);
  await source.getByRole("button", { name: "Swap position" }).click();
  await page.locator(".swap-target").filter({ hasText: "Test elective" }).click();
  await page.getByRole("button", { name: "Confirm swap" }).click();
  await expect(source).toContainText(beforeTarget);
  await expect(source).toContainText("Counts toward: Marketing Core");
  await expect(target).toContainText(beforeSource);
  await openDegree(page, "C10235");
  await expect(source).toContainText(beforeTarget);
  await expect(path).toContainText("Required Core remaining: 2");
  await source.getByRole("button", { name: "Swap position" }).click();
  await page.locator(".swap-target").filter({ hasText: "Electives · 6 CP choice" }).first().click();
  await page.getByRole("button", { name: "Confirm swap" }).click();
  await expect(source).toContainText("Counts toward: Marketing Core");
  await source.getByRole("button", { name: "Remove subject & restore choice" }).click();
  await expect(path).toContainText("Required Core remaining: 3");
  await expect(page.locator(".plan-item--filled")).toHaveCount(1);
});

test("Engineering option swaps with a Free Elective and preserves its formal group", async ({ page }) => {
  await openDegree(page, "C09066");
  await page.locator(".study-path").getByRole("combobox", { name: "Major", exact: true }).selectOption("MAJ03518");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await page.locator(".plan-item--choice").filter({ hasText: "CBK92152" }).first().locator(".plan-item__main-action").click();
  await page.getByRole("dialog").getByRole("button", { name: "Select", exact: true }).first().click();
  const option = page.locator(".plan-item--filled").first();
  const ownership = await option.locator(".plan-item__note").filter({ hasText: "Counts toward:" }).innerText();
  await option.getByRole("button", { name: "Swap position" }).click();
  await page.locator(".swap-target").filter({ hasText: "Free Elective" }).first().click();
  await page.getByRole("button", { name: "Confirm swap" }).click();
  await expect(option).toContainText(ownership);
  await openDegree(page, "C09066");
  await expect(page.locator(".plan-item--filled")).toHaveCount(1);
  await expect(page.locator(".plan-item--filled")).toContainText(ownership);
});

test("Known offering restriction excludes incompatible swap targets", async ({ page }) => {
  await page.route("**/api/subjects/21510?*", route => route.fulfill({ json: {
    offerings: [{ teaching_period: "Autumn Session", offered: "true", publish: "true", year: "2026" }],
  } }));
  await openDegree(page, "C10235");
  const path = page.locator(".study-path");
  await path.locator("select").first().selectOption({ label: "Sub-major + electives" });
  await path.locator(".pathway-selection select").selectOption("SMJ08109");
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await page.locator(".plan-item--choice").filter({ hasText: "Counts toward: Management Consulting" }).first().locator(".plan-item__main-action").click();
  await page.getByRole("dialog").locator(".subject-result").filter({ hasText: "21510" }).getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Swap position", exact: true }).click();
  await expect(page.getByText("Checking compatible positions…")).toHaveCount(0);
  await expect(page.locator(".swap-target").filter({ hasText: "Spring" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm swap" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel swap" }).click();
  await expect(page.locator(".plan-item--filled")).toHaveCount(1);
});

test("USYD degree requirements remain available", async ({ page }) => {
  await openDegree(page, fixture.usyd.degree.code, "USYD");
  await expect(page.locator(".requirements-section")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("undefined");
  await expect(page.locator(".roadmap-aggregate")).toHaveCount(0);
  const component = fixture.usydComponent.component;
  await page.getByRole("combobox", { name: "Would you like an additional component?" }).selectOption("MINOR");
  await page.locator(`input[type="radio"][value="${component.code}"]`).first().check();
  await expect(page.locator(".selected-component").first()).toContainText(component.name);
  await expect(page.locator(".selected-component").first()).toContainText("CP");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

const accessFixture = (missing = false): SubjectAccessConditions => ({
  subject: { id: "fixture-subject", code: "41052", name: "Software option" }, hasConditions: true, antiRequisiteGroups: [],
  requisiteGroups: [{ id: "fixture-rule", groupType: "REQUISITE", rule: "A", sortOrder: 0, items: [{ id: "fixture-item", itemKey: "A", requisiteType: "Prerequisite",
    details: "Complete 31250 Introduction to Data Analytics first. " + "Additional handbook detail remains available here. ".repeat(8),
    referencedSubject: missing ? null : { id: "fixture-prerequisite", code: "31250", name: "Introduction to Data Analytics" },
    referencedComponent: null, referencedDegree: null, rawReferencedCodes: ["31250"], sortOrder: 0 }] }],
});

const mockAccess = async (page: Page, access: SubjectAccessConditions) => {
  await page.route("**/api/subjects/access-conditions/batch?*", route => route.fulfill({ json: { "41052": access } }));
  await page.route("**/api/subjects/41052/access-conditions?*", route => route.fulfill({ json: access }));
  await page.route("**/api/subjects/41052?*", route => route.fulfill({ json: { id: "fixture-subject", code: "41052", name: "Software option", creditPoints: 6,
    prerequisiteStatus: "HAS_CONDITIONS", description: "Subject description preserved.", offerings: null, accessConditions: null,
    sourceUrl: "https://handbook.uts.edu.au/subjects/41052.html",
  } }));
};

const selectSoftwareOption = async (page: Page) => {
  await openDegree(page, "C09066");
  await page.locator(".study-path").getByRole("combobox", { name: "Major", exact: true }).selectOption("MAJ03523");
  await page.getByRole("combobox", { name: "Major options", exact: true }).selectOption({ label: "Technical Subjects" });
  await page.getByRole("button", { name: "Customize plan", exact: true }).click();
  await page.locator(".plan-item--choice").filter({ hasText: "Software Engineering Option" }).first().locator(".plan-item__main-action").click();
  await page.getByRole("dialog").locator(".subject-result").filter({ hasText: "41052" }).getByRole("button", { name: "Select", exact: true }).click();
  return page.locator(".plan-item--filled").filter({ hasText: "41052" });
};

const cardSize = async (card: Locator) => {
  const box = await card.boundingBox(); expect(box).not.toBeNull();
  return { width: box!.width, height: box!.height };
};

test("Software Engineering shows compact amber status and keeps complete requirement details accessible", async ({ page }) => {
  await mockAccess(page, accessFixture());
  const card = await selectSoftwareOption(page);
  await expect(card.locator(".prerequisite-summary")).toHaveText("Prerequisite not completed");
  await expect(card).not.toContainText("Additional handbook detail");
  expect((await cardSize(card)).height).toBeLessThan(390);
  await card.getByRole("button", { name: "View requirements", exact: true }).click();
  const detail = page.locator(".subject-detail-dialog[open]");
  await expect(detail.locator(".requirement-unmet")).toContainText("Prerequisite not completed");
  await expect(detail.locator(".requirement-warning")).toHaveCount(0);
  await expect(detail).toContainText("Additional handbook detail remains available here");
  await expect(detail).toContainText("Subject description preserved");
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button", { name: "View requirements", exact: true })).toBeFocused();
});

test("Unresolved prerequisite record produces a red warning inside details, not a large card block", async ({ page }) => {
  await mockAccess(page, accessFixture(true));
  const card = await selectSoftwareOption(page);
  await expect(card.locator(".prerequisite-summary")).toHaveText("Prerequisite information unavailable");
  await expect(card.locator(".requirement-warning")).toHaveCount(0);
  await card.getByRole("button", { name: "View requirements", exact: true }).click();
  const detail = page.locator(".subject-detail-dialog[open]");
  await expect(detail.locator(".requirement-warning")).toContainText("31250");
  await expect(detail.locator(".requirement-warning")).toContainText("2026");
  await expect(detail.getByRole("link", { name: "Official subject source" })).toHaveAttribute("href", "https://handbook.uts.edu.au/subjects/41052.html");
  await expect(detail.locator(".condition-groups")).toContainText("Additional handbook detail");
  await expect(detail.locator(".requirement-unmet")).toHaveCount(0);
});

test("Nested subject dialogs trap focus and retain the page scroll lock until both close", async ({ page }) => {
  await mockAccess(page, accessFixture());
  const card = await selectSoftwareOption(page);
  await card.getByRole("button", { name: "Change", exact: true }).click();
  const choice = page.getByRole("dialog", { name: "Choose a subject" });
  await choice.locator(".subject-result").filter({ hasText: "41052" }).getByRole("button", { name: "View requirements" }).click();
  const detail = page.getByRole("dialog", { name: "Software option" });
  await expect(detail).toBeVisible();
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press("Tab");
    expect(await detail.evaluate(dialog => dialog.contains(document.activeElement))).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  await expect(choice).toBeVisible();
  expect(await page.locator("body").evaluate(body => getComputedStyle(body).overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(choice).not.toBeVisible();
  await expect(card.getByRole("button", { name: "Change", exact: true })).toBeFocused();
  expect(await page.locator("body").evaluate(body => getComputedStyle(body).overflow)).not.toBe("hidden");
});

test("A known prerequisite scheduled later stays amber, while an unparsed expression is a data warning", async ({ page }) => {
  const late = accessFixture();
  late.requisiteGroups[0].items[0].referencedSubject = { id: "later-capstone", code: "41030", name: "Engineering Capstone" };
  await mockAccess(page, late);
  const card = await selectSoftwareOption(page);
  await expect(card.locator(".prerequisite-summary")).toHaveText("Prerequisite is scheduled too late");
  await card.getByRole("button", { name: "View requirements" }).click();
  await expect(page.locator(".subject-detail-dialog[open] .requirement-warning")).toHaveCount(0);
  await expect(page.locator(".subject-detail-dialog[open] .requirement-unmet")).toContainText("scheduled too late");
  await page.keyboard.press("Escape");
  const unresolved = accessFixture(); unresolved.requisiteGroups[0].rule = "A AND unresolved handbook expression";
  await mockAccess(page, unresolved);
  await card.getByRole("button", { name: "View requirements" }).click();
  await expect(page.locator(".subject-detail-dialog[open] .requirement-warning")).toContainText("unresolved handbook expression");
});

test("Repeated Software Engineering swaps and cancellation preserve compact card dimensions and allocation", async ({ page }) => {
  const card = await selectSoftwareOption(page);
  await expect(card.locator(".prerequisite-summary")).toHaveText("Prerequisite information unavailable");
  const original = await cardSize(card);
  const ownership = await card.locator(".plan-item__note").filter({ hasText: "Counts toward:" }).innerText();
  for (let index = 0; index < 3; index++) {
    await card.getByRole("button", { name: "Swap position" }).click();
    await expect(page.locator(".swap-target").first()).toBeVisible();
    await expect(page.locator(".swap-target:disabled")).toHaveCount(0);
    await expect(page.locator(".swap-target").filter({ hasText: "41052" })).toHaveCount(0);
    const groups = await page.locator(".swap-target-session").evaluateAll(groups => groups.map(group => group.querySelectorAll(".swap-target").length));
    expect(groups.every(count => count > 0)).toBeTruthy();
    await page.locator(".swap-target").filter({ hasText: "Free Elective or Sub-major" }).first().click();
    await page.getByRole("button", { name: "Confirm swap" }).click();
    expect(await cardSize(card)).toEqual(original);
    await expect(card.getByRole("button", { name: "Swap position" })).toBeFocused();
    await expect(card).toContainText(ownership);
  }
  await card.getByRole("button", { name: "Swap position" }).click();
  await page.keyboard.press("Escape");
  expect(await cardSize(card)).toEqual(original);
  await expect(card.getByRole("button", { name: "Swap position" })).toBeFocused();
  const scheduled = await card.locator(".plan-item__note").filter({ hasText: "Scheduled:" }).innerText();
  await openDegree(page, "C09066");
  await expect(card).toContainText(scheduled);
  await expect(card).toContainText(ownership);
});

for (const width of [1440, 1280, 768, 390]) {
  test(`Accounting cards and swap dialog stay within a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDegree(page, "C10235");
    await page.locator(".study-path select").first().selectOption({ label: "Sub-major + electives" });
    await page.locator(".pathway-selection select").selectOption("SMJ08138");
    await page.getByRole("button", { name: "Customize plan", exact: true }).click();
    await page.locator(".plan-item--choice").filter({ hasText: "Counts toward: Marketing" }).first().locator(".plan-item__main-action").click();
    await page.getByRole("dialog").locator(".subject-result").filter({ hasText: "Required Core" }).first().getByRole("button", { name: "Select", exact: true }).click();
    const card = page.locator(".plan-item--filled");
    await expect(card.locator(".prerequisite-summary")).toBeVisible();
    const sizes = await page.locator(".plan-item").evaluateAll(cards => cards.map(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height, overflow: card.scrollWidth > card.clientWidth + 1 })));
    expect(Math.max(...sizes.map(size => size.width)) - Math.min(...sizes.map(size => size.width))).toBeLessThan(2);
    expect(Math.max(...sizes.map(size => size.height))).toBeLessThan(390);
    expect(sizes.some(size => size.overflow)).toBeFalsy();
    const size = await cardSize(card);
    await card.getByRole("button", { name: "Swap position" }).click();
    const dialog = page.locator(".swap-dialog[open]");
    await expect(dialog.locator(".swap-target").first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel swap" })).toBeInViewport();
    const box = await dialog.boundingBox(); expect(box!.width).toBeLessThan(width); expect(box!.height).toBeLessThan(850);
    if (width === 1440 || width === 390) await dialog.screenshot({ path: test.info().outputPath("swap-dialog.png") });
    await dialog.locator(".swap-target").filter({ hasText: "Electives · 6 CP choice" }).first().click();
    await dialog.getByRole("button", { name: "Confirm swap" }).click();
    expect(await cardSize(card)).toEqual(size);
    await card.getByRole("button", { name: "Swap position" }).click();
    await dialog.locator(".swap-target").filter({ hasText: "Electives · 6 CP choice" }).first().click();
    await dialog.getByRole("button", { name: "Confirm swap" }).click();
    expect(await cardSize(card)).toEqual(size);
    if (width === 1440 || width === 390) await page.locator(".plan-year").filter({ has: card }).screenshot({ path: test.info().outputPath("roadmap-cards.png"), style: ".site-header, .skip-link, .glossary-chat__toggle { visibility: hidden; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await expect(page.locator("body")).not.toContainText("undefined");
  });
}
