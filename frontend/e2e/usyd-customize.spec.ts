import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { DegreeDetailResponse } from "../src/types/handbook";
import type { ComponentDetailResponse, RequirementGroup, RequirementSubject, StudyPlan } from "../src/types/handbook";
import type { SubjectAccessConditions } from "../src/types/subject";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-2026.json", import.meta.url), "utf8")) as { detail: DegreeDetailResponse; plans: StudyPlan[] };

const group = (id: string, title: string): RequirementGroup => ({ id, title, description: null, logic: "ANY", requiredCreditPoints: null,
  maximumCreditPoints: null, sortOrder: 0, items: [], children: [], pathways: [], candidateSources: [] });
const subject = (code: string, name = code, creditPoints = 6): RequirementSubject => ({ id: code.toLowerCase(), code, name, creditPoints });
const units = [subject("INFO1111", "Computing 1A Professionalism"), subject("COMP2022", "Models of Computation"),
  subject("ACCT1006", "Accounting and Financial Management"), subject("DATA1002", "Informatics: Data and Computation"), subject("ENGG2112", "Engineering Project 2", 12)];
const ug = { id: "ug", sourceKey: "ug", type: "SUBJECT_FILTER" as const, title: "Engineering undergraduate units", authoritative: true, candidateCount: 271, tableName: null };
const tableS = { id: "s", sourceKey: "s", type: "TABLE_SUBJECT_POOL" as const, title: "Table S units", authoritative: true, candidateCount: 1472, tableName: "Table S" };
const tableD = { id: "d", sourceKey: "d", type: "TABLE_SUBJECT_POOL" as const, title: "Table D units", authoritative: true, candidateCount: 17, tableName: "Table D" };
const detail = structuredClone(fixture.detail);
const free = group("free", "Free Electives"); free.candidateSources = [ug, tableS]; free.maximumCreditPoints = 24;
const dalyell = group("dalyell", "Dalyell"); dalyell.description = "For enrolled students, a minimum of 12 credit points"; dalyell.candidateSources = [tableD];
detail.requirements.push(free, dalyell);
const streamRefs = detail.requirements.flatMap(g => g.items).flatMap(i => i.component ? [i.component] : []);
const components: ComponentDetailResponse[] = streamRefs.map(ref => {
  const pool = group(`${ref.id}:options`, ref.name.startsWith("Software") ? "1000/2000 Level Stream Elective units" : "Stream Elective units");
  pool.items = units.slice(0, 2).map(s => ({ id: s.id, subject: s, component: null, itemType: "SUBJECT", rawCode: s.code, rawName: s.name, creditPoints: s.creditPoints, sortOrder: 0 }));
  return { component: { ...ref, originalType: "STREAM", handbookYear: 2026, sourceUrl: null, university: detail.degree.university }, requirements: [pool] };
});
// Formal references accompany CUSP preview aliases; scheduling titles alone are insufficient.
const computerRef = { id: "computer", code: "USYD:ENGINEERING:SPECIALISATION:COMPUTER", name: "Computer", type: "SPECIALISATION",
  displayCode: null, creditPoints: 30, creditPointsAvailability: "EXPLICIT_COMPONENT" as const };
components.find(c => c.component.id === "software-stream")!.requirements.push({ ...group("software-specialisations", "Specialisation"), logic: "ONE_OF",
  items: [{ id: "computer-ref", itemType: "COMPONENT", component: computerRef, subject: null, rawCode: computerRef.code,
    rawName: computerRef.name, creditPoints: 30, sortOrder: 0 }] });
components.push({ component: { ...computerRef, originalType: "SPECIALISATION", sourceUrl: null, handbookYear: 2026, university: detail.degree.university }, requirements: [] });
const plans: StudyPlan[] = fixture.plans.map(p => ({ ...p, years: structuredClone(fixture.plans[0].years) } as StudyPlan));
for (const plan of plans) {
  const first = plan.years[0].periods[0]; first.items[1].creditPoints = 12;
  first.items.push({ ...first.items[1], id: "free-choice", title: "Free Electives", creditPoints: 6 },
    { ...first.items[0], id: "pep", title: "Professional Engagement Program 1A", subject: subject("ENGP1001", "Professional Engagement Program 1A", 0), creditPoints: 0 });
  plan.years[1].periods[0].items.push({ ...first.items[0], id: "info1113", title: "Object-Oriented Programming", subject: subject("INFO1113", "Object-Oriented Programming") });
}
const access = (code: string): SubjectAccessConditions => ({ subject: { id: code.toLowerCase(), code, name: code }, hasConditions: code === "INFO1113", antiRequisiteGroups: [],
  requisiteGroups: code === "INFO1113" ? [{ id: "info-rule", groupType: "PREREQUISITE", rule: "INFO1110 or INFO1910 or ENGG1810", sortOrder: 0,
    items: ["INFO1110", "INFO1910", "ENGG1810"].map((ref, index) => ({ id: ref, itemKey: `INFO1113:PREREQUISITE:0:${index}`, requisiteType: "PREREQUISITE", details: "Source prerequisite",
      referencedSubject: subject(ref), referencedComponent: null, referencedDegree: null, rawReferencedCodes: [ref], sortOrder: index })) }] : [] });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const failures: string[] = []; errors.set(page, failures);
  page.on("pageerror", e => failures.push(e.message));
  page.on("console", msg => { if (["warning", "error"].includes(msg.type())) failures.push(msg.text()); });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); const path = url.pathname; let body: unknown;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    if (path === "/api/universities") body = [detail.degree.university];
    else if (path.includes("handbooks/latest")) body = { year: 2026 };
    else if (/universities\/.*\/degrees$/.test(path)) body = [detail.degree];
    else if (path.endsWith("/study-plans")) body = plans;
    else if (path.includes("/degrees/")) body = detail;
    else if (path.includes("/components/")) body = components.find(c => c.component.id === decodeURIComponent(path.split("/").at(-1)!));
    else if (path.includes("requirement-candidate-sources")) {
      const source = [ug, tableS, tableD].find(s => s.id === path.split("/").at(-2))!;
      const q = (url.searchParams.get("q") ?? "").toLowerCase(); const pageNo = Number(url.searchParams.get("page") ?? 1);
      const all = source.id === "d" ? [subject("ENGL3993", "Dalyell Scholar")]
        : source.id === "ug" ? [units[0], units[1], units[4]] : [units[1], units[2], units[3]];
      const filtered = all.filter(s => `${s.code} ${s.name}`.toLowerCase().includes(q));
      body = { candidateSource: source, subjects: filtered.slice((pageNo - 1) * 2, pageNo * 2), pagination: { page: pageNo, limit: 2, total: filtered.length, totalPages: Math.ceil(filtered.length / 2) } };
    } else if (path.endsWith("access-conditions/batch")) {
      const request = route.request().postDataJSON() as { subjectCodes: string[] };
      body = Object.fromEntries(request.subjectCodes.map(code => [code, access(code)]));
    } else if (path.endsWith("access-conditions")) body = access(path.split("/").at(-2)!);
    else if (path.includes("/subjects/")) { const code = path.split("/").at(-1)!; body = { ...subject(code), prerequisiteStatus: "NO_CONDITIONS", offerings: null, accessConditions: null, sourceUrl: null, description: null }; }
    if (body === undefined) throw Error(`Unhandled fixture API: ${path}`);
    await route.fulfill({ json: body });
  });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function open(page: Page) {
  await page.goto("/"); await page.locator(".university-card").filter({ hasText: "USYD" }).click();
  await page.locator(".degree-row").filter({ hasText: "BHENGINE-04" }).click();
}
const stream = (page: Page) => page.getByRole("combobox", { name: "Engineering Stream", exact: true });
async function customize(page: Page) { await stream(page).selectOption("Software Engineering"); await page.getByRole("button", { name: "Customize Plan", exact: true }).click(); }
const choice = (page: Page) => page.getByRole("dialog", { name: "Choose a subject", exact: true });
async function fill(page: Page, index = 0, code = "INFO1111") {
  await page.locator(".plan-item--choice").nth(index).getByRole("button", { name: "Choose", exact: true }).click();
  await choice(page).locator(`[data-candidate-code="${code}"]`).getByRole("button", { name: "Select", exact: true }).click();
}

test("selector identity, official immutability and deterministic 12 CP children", async ({ page }) => {
  await open(page); await expect(stream(page)).toHaveValue(""); await expect(page.locator(".plan-years")).toHaveCount(0);
  await customize(page); await expect(page.locator("[data-usyd-plan-id]")).toHaveAttribute("data-usyd-plan-id", "software-base");
  await expect(page.locator(".roadmap-aggregate .plan-item")).toHaveCount(2); await fill(page); await fill(page, 1, "COMP2022");
  await expect(page.locator(".roadmap-aggregate .plan-item--filled")).toHaveCount(2);
  await expect(page.locator(".roadmap-aggregate")).toContainText("12 CP scheduled here");
  await page.getByRole("button", { name: "View official roadmap" }).click();
  await expect(page.locator(".plan-item--filled")).toHaveCount(0); await expect(page.getByRole("button", { name: "Choose", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View personal plan" }).click(); await expect(page.locator(".plan-item--filled").first()).toContainText("INFO1111");
  await page.getByRole("button", { name: "Reset to official plan" }).click();
  await expect(page.locator(".roadmap-aggregate .plan-item")).toHaveCount(2); await expect(page.locator(".plan-item--filled")).toHaveCount(0);
});

test("drafts survive reload and remain isolated by base, commencement and specialisation", async ({ page }) => {
  await open(page); await customize(page); await fill(page);
  await page.getByRole("combobox", { name: "Commencement", exact: true }).selectOption("MID_YEAR");
  await page.getByRole("button", { name: "Customize Plan", exact: true }).click(); await fill(page, 0, "COMP2022");
  await open(page); await expect(page.locator("[data-usyd-plan-id]")).toHaveAttribute("data-usyd-plan-id", "software-midyear");
  await expect(page.locator(".plan-item--filled")).toContainText("COMP2022");
  await page.getByRole("combobox", { name: "Commencement", exact: true }).selectOption("STANDARD");
  await expect(page.locator(".plan-item--filled")).toContainText("INFO1111");
  await page.getByRole("combobox", { name: "Study plan focus", exact: true }).selectOption({ label: "Computer · 30 CP" });
  await page.getByRole("button", { name: "Customize Plan", exact: true }).click(); await fill(page, 0, "COMP2022");
  await page.getByRole("combobox", { name: "Study plan focus", exact: true }).selectOption("BASE");
  await expect(page.locator(".plan-item--filled")).toContainText("INFO1111");
  await page.getByRole("button", { name: "Remove personal draft" }).click(); await expect(page.getByRole("button", { name: "Customize Plan", exact: true })).toBeVisible();
  await open(page); await expect(page.locator(".plan-item--filled")).toHaveCount(0);
});

test("mixed embedded/source union is deduplicated and persists explicit requirement ownership", async ({ page }) => {
  await open(page); await customize(page); await fill(page);
  await page.locator(".plan-item--filled").getByRole("button", { name: "Change", exact: true }).click();
  await choice(page).getByLabel("Eligible pool", { exact: true }).selectOption("");
  await expect(choice(page).getByLabel("Eligible candidate sources")).toContainText("271 subjects");
  await expect(choice(page).getByLabel("Eligible candidate sources")).toContainText("1,472 subjects");
  await expect(choice(page).locator('[data-candidate-code="COMP2022"]')).toHaveCount(1);
  await choice(page).getByLabel("Credit COMP2022 to").selectOption("free");
  await choice(page).locator('[data-candidate-code="COMP2022"]').getByRole("button", { name: "Select", exact: true }).click();
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith("planner:USYD")).map(([, value]) => JSON.parse(value)));
  expect(saved[0].years[0].periods[0].items.find((i: {subject?: {code: string}}) => i.subject?.code === "COMP2022").choiceOrigin.formalRequirementGroupId).toBe("free");
  expect(saved[0].years[0].periods[0].items.find((i: {subject?: {code: string}}) => i.subject?.code === "COMP2022").choiceOrigin.formalComponentCode).toBeUndefined();
  await page.locator(".plan-item--choice").nth(1).getByRole("button", { name: "Choose", exact: true }).click();
  await expect(choice(page).locator('[data-candidate-code="COMP2022"]').getByRole("button", { name: "Select", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Remove subject & restore choice" }).click();
  await expect(page.locator(".plan-item--filled")).toHaveCount(0);
});

test("contextual low-level pool groups results once; filters reconcile overlapping ownership and search", async ({ page }) => {
  await open(page); await customize(page);
  await page.locator(".plan-item--choice").first().getByRole("button", { name: "Choose", exact: true }).click();
  const dialog = choice(page); const filter = dialog.getByLabel("Eligible pool", { exact: true });
  await expect(filter).toHaveValue("software-stream:options");
  await expect(filter.getByRole("option", { name: "All eligible pools", exact: true })).toHaveCount(1);
  await expect(dialog.locator("[data-eligible-pool]")).toHaveCount(1);
  await expect(dialog.getByRole("heading", { name: "1000/2000 Level Stream Elective units", exact: true })).toHaveCount(1);
  await expect(dialog.locator("[data-candidate-code]")).toHaveCount(2);
  await expect(dialog).not.toContainText("Eligible for:");
  await filter.selectOption("");
  await expect(dialog.locator('[data-candidate-code="ACCT1006"]')).toBeVisible();
  await expect(dialog.locator("[data-eligible-pool]")).toHaveCount(2);
  await expect(dialog.locator('[data-candidate-code="COMP2022"]')).toHaveCount(1);
  await expect(dialog.getByLabel("COMP2022 candidate sources")).toContainText("Engineering undergraduate units");
  await expect(dialog.getByLabel("COMP2022 candidate sources")).toContainText("Table S units");
  await dialog.getByLabel("Credit COMP2022 to").selectOption("free");
  await filter.selectOption("software-stream:options");
  await expect(dialog.getByLabel("Credit COMP2022 to")).toHaveValue("software-stream:options");
  await expect(dialog.getByRole("heading", { name: "Free Electives", exact: true })).toHaveCount(0);
  await filter.selectOption("free");
  await expect(dialog.locator("[data-eligible-pool]")).toHaveAttribute("data-eligible-pool", "free");
  await expect(dialog.getByLabel("Credit COMP2022 to")).toHaveValue("free");
  await dialog.getByRole("button", { name: /Load more from Table S/ }).click();
  await expect(dialog.locator('[data-candidate-code="DATA1002"]')).toBeVisible();
  await expect(dialog.locator('[data-candidate-code="COMP2022"]')).toHaveCount(1);
  for (const [query, count] of [["COMP2022", 1], ["Financial Management", 1], ["no-such-unit", 0], ["", 3]] as const) {
    await dialog.getByLabel("Search eligible subjects by code or name").fill(query);
    await dialog.getByRole("button", { name: "Search eligible subjects", exact: true }).click();
    await expect(dialog.locator("[data-candidate-code]")).toHaveCount(count);
  }
  await expect(dialog.locator('[data-candidate-code="DATA1002"]')).toHaveCount(0);
  await dialog.getByRole("button", { name: /Load more from Table S/ }).click();
  await expect(dialog.locator('[data-candidate-code="DATA1002"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await filter.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.locator('[data-candidate-code="COMP2022"]').getByRole("button", { name: "Select", exact: true }).click();
  await open(page);
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith("planner:USYD")).map(([, value]) => JSON.parse(value)));
  const allocation = saved[0].years[0].periods[0].items.find((item: { subject?: { code: string } }) => item.subject?.code === "COMP2022");
  expect(allocation.choiceOrigin.formalRequirementGroupId).toBe("free");
  expect(allocation.choiceOrigin.formalComponentCode).toBeUndefined();
});

test("high-level primary defaults correctly and an ambiguous primary keeps All eligible pools", async ({ page }) => {
  const high = group("software-high", "3000+ Level Stream Elective Units");
  high.items = [{ id: "comp3608", itemType: "SUBJECT", subject: subject("COMP3608", "Introduction to Artificial Intelligence"), component: null,
    rawCode: "COMP3608", rawName: null, creditPoints: 6, sortOrder: 0 }];
  const changedPlans = structuredClone(plans);
  changedPlans[0].years[0].periods[0].items[1].title = "Software Stream 3000+ Level Elective Units or Free Electives";
  let ambiguous = false;
  await page.route("**/api/degrees/BHENGINE-04/study-plans?**", route => route.fulfill({ json: changedPlans }));
  await page.route("**/api/components/software-stream?**", route => {
    const component = structuredClone(components.find(component => component.component.id === "software-stream")!);
    component.requirements.push(high);
    if (ambiguous) component.requirements.push({ ...high, id: "ambiguous-high" });
    return route.fulfill({ json: component });
  });
  await open(page); await customize(page);
  await page.locator(".plan-item--choice").first().getByRole("button", { name: "Choose", exact: true }).click();
  await expect(choice(page).getByLabel("Eligible pool", { exact: true })).toHaveValue(high.id);
  await expect(choice(page).getByRole("heading", { name: high.title!, exact: true })).toHaveCount(1);
  await expect(choice(page).locator('[data-candidate-code="COMP3608"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  ambiguous = true; await open(page);
  await page.locator(".plan-item--choice").first().getByRole("button", { name: "Choose", exact: true }).click();
  await expect(choice(page).getByLabel("Eligible pool", { exact: true })).toHaveValue("");
  await expect(choice(page)).toContainText("Some CUSP alternatives could not be mapped.");
  await expect(choice(page).locator('[data-candidate-code="COMP3608"]')).toHaveCount(0);
  await expect(choice(page).getByRole("heading", { name: "Free Electives", exact: true })).toBeVisible();
});

test("Free Electives page/search, capacity checks and explicit Table D applicability", async ({ page }) => {
  await open(page); await customize(page);
  await page.locator(".plan-item--choice").last().getByRole("button", { name: "Choose", exact: true }).click();
  await expect(choice(page).locator('[data-candidate-code="ACCT1006"]')).toBeVisible();
  await choice(page).getByRole("button", { name: /Load more from Table S/ }).click();
  await expect(choice(page).locator('[data-candidate-code="DATA1002"]')).toBeVisible();
  await expect(choice(page).locator('[data-candidate-code="COMP2022"]')).toHaveCount(1);
  await choice(page).getByRole("button", { name: /Load more from Engineering/ }).click();
  await expect(choice(page).locator('[data-candidate-code="ENGG2112"]').getByRole("button", { name: "Select", exact: true })).toBeDisabled();
  await choice(page).getByLabel("Search eligible subjects by code or name").fill("Financial Management");
  await choice(page).getByRole("button", { name: "Search eligible subjects", exact: true }).click();
  await expect(choice(page).locator("[data-candidate-code]")).toHaveCount(1);
  await choice(page).locator('[data-candidate-code="ACCT1006"]').getByRole("button", { name: "Select", exact: true }).click();
  await page.getByLabel("I am enrolled in the Dalyell Stream").check();
  await page.locator(".plan-item--filled").getByRole("button", { name: "Change", exact: true }).click();
  await choice(page).getByLabel("Eligible pool").selectOption("dalyell");
  await expect(choice(page).locator("[data-candidate-code]")).toHaveCount(1); await expect(choice(page)).toContainText("ENGL3993");
  await choice(page).locator('[data-candidate-code="ENGL3993"]').getByRole("button", { name: "Select", exact: true }).click();
  await page.getByLabel("I am enrolled in the Dalyell Stream").uncheck();
  await expect(page.getByRole("alert")).toContainText("Your draft contains Table D allocations.");
  await page.locator(".plan-item--filled").getByRole("button", { name: "Change", exact: true }).click();
  await expect(choice(page)).not.toContainText("Table D units");
});

test("move validation blocks a late INFO1110 prerequisite; clear and restore preserve locked PEP", async ({ page }) => {
  await open(page); await customize(page);
  const programming = page.locator('.plan-item').filter({ hasText: "INFO1110" });
  await programming.getByRole("button", { name: "Move subject" }).click();
  await page.getByLabel("Destination period").selectOption("official:y3s1");
  await expect(page.getByRole("dialog", { name: "Move subject" })).toContainText("Prerequisite scheduled after this subject");
  await expect(page.getByRole("button", { name: "Confirm move" })).toBeDisabled(); await page.getByRole("button", { name: "Cancel move" }).click();
  await expect(page.locator('.plan-item').filter({ hasText: "ENGP1001" }).getByRole("button", { name: "Move subject" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear movable subjects from period" }).first().click();
  await expect(page.getByRole("heading", { name: "Unscheduled subjects" })).toBeVisible();
  await page.getByText("Review plan warnings", { exact: false }).click();
  await expect(page.locator("[data-usyd-plan-id]")).toContainText("INFO1113: Prerequisite scheduled too late");
  await page.getByRole("button", { name: "Reset to official plan" }).click();
  await expect(page.getByRole("heading", { name: "Unscheduled subjects" })).toHaveCount(0);
  await expect(page.locator('.plan-item').filter({ hasText: "INFO1113" })).not.toContainText("Prerequisite needs review");
});

test("source failure retries, empty search, rapid queries and narrow accessible dialog", async ({ page }) => {
  await open(page); await customize(page);
  let fail = true;
  await page.route("**/api/requirement-candidate-sources/**", async route => {
    if (fail) { fail = false; await route.fulfill({ status: 503, json: { error: "Temporary source outage" } }); }
    else await route.fallback();
  });
  // The expected transport error is verified through the retry UI.
  await page.locator(".plan-item--choice").last().getByRole("button", { name: "Choose", exact: true }).click();
  await expect(choice(page)).toContainText("Couldn't load eligible subjects."); await choice(page).getByRole("button", { name: "Try again" }).click();
  await expect(choice(page).locator('[data-candidate-code="ACCT1006"]')).toBeVisible();
  for (const query of ["ACCT", "COMP", "no-such-unit"]) {
    await choice(page).getByLabel("Search eligible subjects by code or name").fill(query);
    await choice(page).getByRole("button", { name: "Search eligible subjects", exact: true }).click();
  }
  await expect(choice(page)).toContainText("No eligible subjects match this search.");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape"); await expect(choice(page)).not.toBeVisible();
  errors.set(page, (errors.get(page) ?? []).filter(message => /503/.test(message) === false));
});

test("swap, holding-area restore and reload preserve the allocation rather than recreating official positions", async ({ page }) => {
  await open(page); await customize(page); await fill(page);
  await page.locator('.plan-item--filled').getByRole('button', { name: 'Swap position', exact: true }).click();
  const swap = page.getByRole('dialog', { name: 'Swap position', exact: true });
  await expect(swap.locator('.swap-target')).toHaveCount(2);
  await swap.locator('.swap-target').last().click(); await swap.getByRole('button', { name: 'Confirm swap', exact: true }).click();
  const savedOrigin = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('planner:USYD')).map(([, value]) => JSON.parse(value))[0]
    .years[0].periods[0].items.find((item: { subject?: { code: string } }) => item.subject?.code === 'INFO1111').choiceOrigin.formalRequirementGroupId);
  expect(savedOrigin).toBe('software-stream:options');
  await page.locator('.plan-item--filled').getByRole('button', { name: 'Move subject', exact: true }).click();
  await page.getByLabel('Destination period').selectOption('HOLDING'); await page.getByRole('button', { name: 'Confirm move', exact: true }).click();
  const holding = page.locator('section[aria-labelledby="usyd-unscheduled-heading"]');
  await expect(holding).toContainText('INFO1111'); await open(page); await expect(holding).toContainText('INFO1111');
  await holding.getByRole('button', { name: 'Move subject', exact: true }).click();
  await page.getByLabel('Destination period').selectOption('official:y3s1'); await page.getByRole('button', { name: 'Confirm move', exact: true }).click();
  await expect(page.locator('[data-period-id="official:y3s1"]')).toContainText('INFO1111');
  await open(page); await expect(page.locator('[data-period-id="official:y3s1"]')).toContainText('INFO1111');
  await page.getByRole('button', { name: 'Remove subject & restore choice', exact: true }).click();
  await expect(page.locator('.plan-item--filled')).toHaveCount(0);
});

test("loading/failure retry and an unresolved CUSP choice expose no fabricated candidates", async ({ page }) => {
  const unresolved = structuredClone(plans); unresolved[0].years[0].periods[0].items[1].title = 'Unmapped official choice';
  let failPlans = true;
  await page.route('**/api/degrees/BHENGINE-04/study-plans?**', async route => {
    if (failPlans) { await route.fulfill({ status: 503, json: { error: 'Plan service temporarily unavailable' } }); }
    else await route.fulfill({ json: unresolved });
  });
  await open(page); const section = page.getByRole('region', { name: 'Study plan', exact: true });
  await expect(section).toContainText("We couldn't load the official study plans.");
  failPlans = false;
  await section.getByRole('button', { name: 'Try again', exact: true }).click(); await customize(page);
  await page.locator('.plan-item--choice').first().getByRole('button', { name: 'Choose', exact: true }).click();
  await expect(choice(page)).toContainText('This CUSP choice does not identify an available eligible pool.');
  await expect(choice(page).getByRole('button', { name: 'Select', exact: true })).toHaveCount(0);
  await expect(choice(page).locator('[data-candidate-code]')).toHaveCount(0);
  errors.set(page, (errors.get(page) ?? []).filter(message => !/503/.test(message)));
});
