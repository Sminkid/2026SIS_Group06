import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, DegreeDetailResponse, RequirementGroup, StudyPlan } from "../src/types/handbook";
import { usydEngineeringSpecialisations, usydFormalFocusId } from "../src/domain/usydEngineeringSpecialisations";

const formal = JSON.parse(readFileSync(new URL("../src/domain/fixtures/usyd-engineering-breadth-2026.json", import.meta.url), "utf8")) as {
  streamGroup: RequirementGroup; streams: ComponentDetailResponse[]; components: ComponentDetailResponse[]; plans: StudyPlan[];
};
const roadmap = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-2026.json", import.meta.url), "utf8")) as {
  detail: DegreeDetailResponse; plans: StudyPlan[];
};
const detail = structuredClone(roadmap.detail);
detail.degree.university = formal.streams[0]!.component.university;
detail.requirements = detail.requirements.filter(g => !g.items.some(i => i.component?.type === "STREAM"));
detail.requirements.push(formal.streamGroup);
const sources = [{ id: "breadth-ug", sourceKey: "ug", type: "SUBJECT_FILTER" as const, title: "Engineering undergraduate units", authoritative: true, candidateCount: 271, tableName: null },
  { id: "breadth-s", sourceKey: "s", type: "TABLE_SUBJECT_POOL" as const, title: "Table S units", authoritative: true, candidateCount: 1472, tableName: "Table S" }];
detail.requirements.push({ ...formal.streamGroup, id: "breadth-free", title: "Free Electives", items: [], logic: "ANY", maximumCreditPoints: 24, candidateSources: sources });
// Formal identities/availability are captured API data. A small existing schedule fixture keeps UI tests focused on selection and ownership.
const plans = formal.plans.map(p => {
  const years = structuredClone(roadmap.plans[0]!.years);
  years[0]!.periods[0]!.items.push({ id: "breadth-free-slot", itemType: "CHOICE", subject: null, rawCode: null,
    title: "Free Electives", creditPoints: 6, numberOfPeriods: null, sortOrder: 99 });
  return { ...p, years };
});
const errors = new WeakMap<Page, string[]>();
const candidateRequests = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const failures: string[] = []; errors.set(page, failures); candidateRequests.set(page, []);
  page.on("pageerror", e => failures.push(e.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); const path = url.pathname; let body: unknown;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    if (path === "/api/universities") body = [detail.degree.university];
    else if (path.includes("handbooks/latest")) body = { year: 2026 };
    else if (/universities\/.*\/degrees$/.test(path)) body = [detail.degree];
    else if (path.endsWith("/study-plans")) body = plans;
    else if (path.includes("/degrees/")) body = detail;
    else if (path.includes("/components/")) body = [...formal.streams, ...formal.components].find(c =>
      [c.component.id, c.component.code].includes(decodeURIComponent(path.split("/").at(-1)!)));
    else if (path.includes("requirement-candidate-sources")) {
      candidateRequests.get(page)!.push(path);
      const source = sources.find(s => s.id === path.split("/").at(-2))!;
      const subject = formal.components.find(c => c.component.name === "Humanitarian Engineering (Breadth)")!.requirements[0]!.items[0]!.subject!;
      body = { candidateSource: source, subjects: [subject], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } };
    } else if (path.endsWith("access-conditions/batch")) body = {};
    else if (path.includes("/subjects/")) { const code = path.split("/").at(-1)!; body = { id: code, code, name: code, creditPoints: 6,
      prerequisiteStatus: "NO_CONDITIONS", offerings: null, accessConditions: null, sourceUrl: null, description: null }; }
    if (body === undefined) throw Error(`Unhandled formal fixture API: ${path}`);
    await route.fulfill({ json: body });
  });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function open(page: Page) {
  await page.goto("/"); await page.locator(".university-card").filter({ hasText: "USYD" }).click();
  await page.locator(".degree-row").filter({ hasText: "BHENGINE-04" }).click();
}
const focus = (page: Page) => page.getByRole("combobox", { name: "Study plan focus", exact: true });
const academicStorage = (page: Page) => page.evaluate(() => localStorage.getItem("degree-planner:components:USYD:2026:BHENGINE-04"));

for (const name of ["Software Engineering", "Civil Engineering", "Electrical Engineering", "Chemical and Biomolecular Engineering",
  "Mechanical Engineering", "Mechatronic Engineering with Space"]) {
  test(`${name}: formal Breadth availability, Base and standard/mid-year roadmap identity`, async ({ page }) => {
    const stream = formal.streams.find(s => s.component.name === name)!;
    const options = usydEngineeringSpecialisations(stream);
    const breadth = options.filter(o => o.kind === "BREADTH_SPECIALISATION");
    await open(page);
    await page.getByRole("combobox", { name: "Engineering Stream", exact: true }).selectOption(plans.find(p => p.pathway?.replace(/&/g, "and") === name)!.pathway!);
    await expect(focus(page)).toHaveValue("BASE");
    await expect(focus(page).locator('optgroup[label="Breadth specialisations"] option')).toHaveText(breadth
      .sort((a, b) => a.component.name.localeCompare(b.component.name)).map(o => `${o.component.name} · 24 CP`));
    await expect(focus(page).locator('optgroup[label="Stream specialisations"] option')).toHaveCount(options.length - breadth.length);
    const before = await academicStorage(page);
    await focus(page).selectOption(usydFormalFocusId(breadth[0]!));
    await expect(page.locator("#usyd-focus-help")).toContainText("A 24 CP specialisation outside your Engineering stream");
    await expect(page.locator("#usyd-preview-help")).toContainText("does not change your Course Structure selections");
    const standard = await page.getByRole("combobox", { name: "Study plan variant", exact: true }).inputValue();
    await page.getByRole("combobox", { name: "Commencement", exact: true }).selectOption("MID_YEAR");
    await expect(focus(page)).toHaveValue(usydFormalFocusId(breadth[0]!));
    const mid = await page.getByRole("combobox", { name: "Study plan variant", exact: true }).inputValue();
    expect(mid).not.toBe(standard); expect(plans.find(p => p.id === mid)?.totalCreditPoints).toBe(192);
    expect(await academicStorage(page)).toBe(before);
    expect(candidateRequests.get(page)).toEqual([]);
  });
}

test("formal Breadth Course Structure requirements seed a reversible preview without being overwritten", async ({ page }) => {
  await open(page);
  const stream = formal.streams.find(s => s.component.name === "Software Engineering")!;
  const option = usydEngineeringSpecialisations(stream).find(o => o.kind === "BREADTH_SPECIALISATION" && /Humanitarian/.test(o.component.name))!;
  const streamSection = page.getByRole("button", { name: /Engineering Stream.*120 credit points.*Choose one/i }).locator("..");
  await streamSection.getByRole("radio", { name: /Software Engineering/ }).check();
  const breadthSection = streamSection.getByRole("button", { name: /Optional Breadth specialisation/ }).locator("..");
  await breadthSection.getByRole("button", { name: /Optional Breadth specialisation/ }).click();
  await breadthSection.getByRole("radio", { name: /Humanitarian Engineering \(Breadth\)/ }).check();
  await expect(breadthSection.getByRole("region", { name: "Selected specialisation" })).toContainText("24 CP");
  await expect(breadthSection.getByText("12 CP required", { exact: true })).toBeVisible();
  await breadthSection.getByRole("button", { name: /Requirement 1: 12 CP/ }).click();
  await expect(breadthSection.getByRole("button", { name: /View CIVL3310/ })).toBeVisible();
  await expect(breadthSection.getByRole("button", { name: /View CIVL5320/ })).toBeVisible();
  await expect(focus(page)).toHaveValue(usydFormalFocusId(option));
  const before = await academicStorage(page);
  await focus(page).selectOption("BASE");
  await page.getByRole("combobox", { name: "Commencement", exact: true }).selectOption("MID_YEAR");
  expect(await academicStorage(page)).toBe(before);
  await expect(breadthSection.getByRole("radio", { name: /Humanitarian Engineering \(Breadth\)/ })).toBeChecked();
});

test("Chemical's sole optional Breadth requires an explicit choice and can be cleared", async ({ page }) => {
  await open(page);
  const section = page.getByRole("button", { name: /Engineering Stream.*120 credit points.*Choose one/i }).locator("..");
  await section.getByRole("radio", { name: /Chemical and Biomolecular Engineering/ }).check();
  const breadth = section.getByRole("button", { name: /Optional Breadth specialisation/ }).locator("..");
  await breadth.getByRole("button", { name: /Optional Breadth specialisation/ }).click();
  const radio = breadth.getByRole("radio", { name: /Engineering Data Science \(Breadth\)/ });
  await expect(radio).not.toBeChecked();
  await expect(breadth.getByRole("radio", { name: /No optional component/ })).toBeChecked();
  await radio.check(); await expect(breadth.getByRole("region", { name: "Selected specialisation" })).toContainText("24 CP");
  await breadth.getByRole("radio", { name: /No optional component/ }).check();
  await expect(radio).not.toBeChecked();
  await expect(breadth.getByRole("region", { name: "Selected specialisation" })).toHaveCount(0);
});

test("Breadth Customize Plan offers authoritative subjects with lazy free pools and persists formal ownership", async ({ page }) => {
  await open(page);
  const stream = formal.streams.find(s => s.component.name === "Software Engineering")!;
  const option = usydEngineeringSpecialisations(stream).find(o => o.kind === "BREADTH_SPECIALISATION" && /Humanitarian/.test(o.component.name))!;
  const component = formal.components.find(c => c.component.id === option.component.id)!;
  await page.getByRole("combobox", { name: "Engineering Stream", exact: true }).selectOption("Software Engineering");
  await expect(focus(page)).toHaveValue("BASE");
  await focus(page).selectOption(usydFormalFocusId(option));
  await page.getByRole("button", { name: "Customize Plan", exact: true }).click();
  expect(candidateRequests.get(page)).toEqual([]);
  await page.locator(".plan-item--choice").filter({ has: page.getByText("Free Electives", { exact: true }) }).getByRole("button", { name: "Choose", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a subject", exact: true });
  await expect(dialog.getByLabel("Eligible pool", { exact: true })).toHaveValue(`focus:${option.component.code}`);
  await expect(dialog.locator('[data-candidate-code="CIVL3310"]')).toHaveCount(1);
  await expect(dialog).not.toContainText("Eligible for:");
  await dialog.locator('[data-candidate-code="CIVL3310"]').getByRole("button", { name: "Select", exact: true }).click();
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith("planner:USYD")).map(([, value]) => JSON.parse(value)));
  const chosen = saved[0].years.flatMap((y: { periods: unknown[] }) => y.periods).flatMap((p: { items: unknown[] }) => p.items)
    .find((i: { subject?: { code: string } }) => i.subject?.code === "CIVL3310");
  expect(chosen.choiceOrigin.formalComponentCode).toBeUndefined();
  expect(chosen.choiceOrigin.formalRequirementGroupId).toBe("breadth-free");
  expect(JSON.parse((await academicStorage(page))!)).toEqual({});
});
