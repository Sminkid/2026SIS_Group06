import { test, expect, type Page } from "@playwright/test";
import { acceptLeavingDegreePages, confirmLeavingDegree } from "./degreeReset";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, DegreeDetailResponse, DegreeSummary, StudyPlan } from "../src/types/handbook";

const fixture = JSON.parse(readFileSync(new URL("../src/domain/fixtures/handbook-2026.json", import.meta.url), "utf8")) as {
  engineering: DegreeDetailResponse; accounting: DegreeDetailResponse; usyd: DegreeDetailResponse;
  engineeringPlans: StudyPlan[]; accountingPlans: StudyPlan[]; details: Record<string, ComponentDetailResponse>;
};

const uts = { ...fixture.engineering.degree.university, rankings: [] };
const usyd = { ...fixture.usyd.degree.university, rankings: [] };
const summary = ({ degree }: DegreeDetailResponse): DegreeSummary =>
  ({ id: degree.id, code: degree.code, name: degree.name, creditPoints: degree.creditPoints, handbookYear: degree.handbookYear });
// USYD's equivalent of UTS Engineering, so "Bachelor of Engineering (Honours)" is a course two universities offer.
// Only listed: the tests open UTS study plans, never this one.
const usydEngineering: DegreeSummary = { id: "usyd-engineering", code: "BHENGINE-04", name: "Bachelor of Engineering Honours", creditPoints: 192, handbookYear: 2026 };
const DEGREES: Record<string, DegreeSummary[]> = {
  UTS: [summary(fixture.engineering), summary(fixture.accounting)],
  USYD: [summary(fixture.usyd), usydEngineering],
};

// A quiz whose screening recommends UTS Engineering, so the quiz route reaches the same comparison and study plan.
const CATEGORY_IDS = ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"].map((name) => `riasec-${name}`);
const screeningQuestions = CATEGORY_IDS.flatMap((categoryId) =>
  [0, 1, 2].map((i) => ({ id: `${categoryId}-${i}`, categoryId, subcategoryId: null, text: `${categoryId} question ${i + 1}` })));
const closingQuestions = [1, 2].map((i) => ({ id: `closing-${i}`, categoryId: CATEGORY_IDS[0], subcategoryId: `closing-sub-${i}`, text: `Closing question ${i}` }));
const QUIZ_RESPONSES: Record<string, unknown> = {
  "/api/assessment/riasec-labels": {
    categories: CATEGORY_IDS.map((id) => ({ id, name: id.replace("riasec-", "").replace(/^\w/, (letter) => letter.toUpperCase()), description: null })),
    subcategories: [],
  },
  "/screening-responses": {
    rankedCategoryIds: CATEGORY_IDS,
    categoryScores: Object.fromEntries(CATEGORY_IDS.map((id, i) => [id, 0.85 - i * 0.1])),
    closingQuestions,
    recommendations: [{ degreeId: fixture.engineering.degree.id, code: "C09066", name: "Bachelor of Engineering (Honours)", description: null, universityCode: "UTS", year: 2026, matchScore: 0.9 }],
  },
  "/closing-responses": { ok: true },
  "/drill-down": { questions: [] },
};

/** Fake backend: handbook data from the 2026 fixture, empty fees, and the quiz above. */
const mockApi = (page: Page) => page.route("**/api/**", (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (!path.startsWith("/api/")) return route.continue();
  if (path === "/api/assessment/sessions" && route.request().method() === "POST") {
    return route.fulfill({ status: 201, json: { sessionId: "nav-session", questions: screeningQuestions } });
  }
  const quizKey = Object.keys(QUIZ_RESPONSES).find((key) => path === key || path.endsWith(key));
  let body: unknown = [];
  if (quizKey) body = QUIZ_RESPONSES[quizKey];
  else if (path === "/api/universities") body = [uts, usyd];
  else if (path.endsWith("/handbooks/latest")) body = { year: 2026 };
  else if (/\/universities\/[^/]+\/degrees$/.test(path)) body = DEGREES[path.split("/")[3]!] ?? [];
  else if (path.includes("/study-plans")) body = path.includes("C09066") ? fixture.engineeringPlans : path.includes("C10235") ? fixture.accountingPlans : [];
  else if (path.startsWith("/api/degrees/")) body = path.includes("C09066") ? fixture.engineering : path.includes("C10235") ? fixture.accounting : fixture.usyd;
  else if (path.includes("/components/")) {
    const identifier = decodeURIComponent(path.split("/").at(-1)!);
    body = Object.values(fixture.details).find((detail) => [detail.component.code, detail.component.id].includes(identifier)) ?? {};
  }
  return route.fulfill({ json: body });
});

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const breadcrumb = (page: Page) => page.getByRole("navigation", { name: "Breadcrumb" });
const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name, exact: true });
const expectTrail = async (page: Page, labels: string[]) =>
  expect(breadcrumb(page).getByRole("listitem")).toHaveText(labels);

const LANDING = "Build your university path";
const ENGINEERING = "Bachelor of Engineering (Honours)";

const openEngineeringComparison = async (page: Page) => {
  await nav(page).getByRole("button", { name: "View All Courses", exact: true }).click();
  await page.getByRole("heading", { name: ENGINEERING }).locator("..").getByRole("button", { name: "2 universities offer this" }).click();
  await expect(page.getByRole("heading", { name: `Compare universities for ${ENGINEERING}` })).toBeVisible();
};

const openStudyPlanFromComparison = async (page: Page) => {
  await page.getByRole("button", { name: "View Study Plan" }).first().click();
  await expect(heading(page, ENGINEERING)).toBeVisible();
};

const answerScreening = async (page: Page) => {
  for (let i = 0; i < screeningQuestions.length + closingQuestions.length; i++) {
    await page.getByRole("radio", { name: /^4 / }).click();
    await page.getByRole("button", { name: /^(Next|Continue to a closer look|See my initial results)$/ }).click();
  }
};

test.beforeEach(async ({ page }) => {
  acceptLeavingDegreePages(page);
  await mockApi(page);
  await page.goto("/");
  await expect(heading(page, LANDING)).toBeVisible();
});

test("nav links and the logo work from a page deep in the app", async ({ page }) => {
  await openEngineeringComparison(page);
  await openStudyPlanFromComparison(page);

  await nav(page).getByRole("button", { name: "Interest Quiz", exact: true }).click();
  await confirmLeavingDegree(page);
  await expect(heading(page, "Interest quiz")).toBeVisible();
  await nav(page).getByRole("button", { name: "View All Courses", exact: true }).click();
  await expect(heading(page, "Courses")).toBeVisible();
  await nav(page).getByRole("button", { name: "University Handbooks", exact: true }).click();
  await expect(heading(page, "Choose a university")).toBeVisible();
  await page.getByRole("button", { name: "UniXPrep home" }).click();
  await expect(heading(page, LANDING)).toBeVisible();
});

test("handbook route: every breadcrumb goes back to its page", async ({ page }) => {
  await nav(page).getByRole("button", { name: "University Handbooks", exact: true }).click();
  await expectTrail(page, ["Home", "University Handbooks"]);
  await page.locator(".university-card").filter({ hasText: "UTS" }).click();
  await expect(heading(page, "Choose a degree")).toBeVisible();
  await expectTrail(page, ["Home", "University Handbooks", "UTS"]);
  await page.locator(".degree-row").filter({ hasText: "C09066" }).click();
  await expect(heading(page, ENGINEERING)).toBeVisible();
  await expectTrail(page, ["Home", "University Handbooks", "UTS", "Study Plan"]);

  await breadcrumb(page).getByRole("button", { name: "UTS" }).click();
  await confirmLeavingDegree(page);
  await expect(heading(page, "Choose a degree")).toBeVisible();
  await breadcrumb(page).getByRole("button", { name: "University Handbooks" }).click();
  await expect(heading(page, "Choose a university")).toBeVisible();
  await breadcrumb(page).getByRole("button", { name: "Home" }).click();
  await expect(heading(page, LANDING)).toBeVisible();
});

test("degree and course lists remind users that only Engineering study plans are complete", async ({ page }) => {
  await nav(page).getByRole("button", { name: "View All Courses", exact: true }).click();
  await expect(heading(page, "Courses")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Study plans for others are still under development.");
});

test("the degree list offers the interest quiz, like All Courses", async ({ page }) => {
  await nav(page).getByRole("button", { name: "University Handbooks", exact: true }).click();
  await page.locator(".university-card").filter({ hasText: "UTS" }).click();
  await expect(heading(page, "Choose a degree")).toBeVisible();
  await expect(page.getByText("Not sure what to study?", { exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("only the study plans for Engineering degrees are complete");
  await page.getByRole("button", { name: "Take the interest quiz", exact: true }).click();
  await expect(heading(page, "Interest quiz")).toBeVisible();
});

test("browsing route: All Courses → Comparison → Study Plan breadcrumbs go back to each page", async ({ page }) => {
  await openEngineeringComparison(page);
  await expectTrail(page, ["Home", "All Courses", "Comparison"]);
  await openStudyPlanFromComparison(page);
  await expectTrail(page, ["Home", "All Courses", "Comparison", "Study Plan"]);

  await breadcrumb(page).getByRole("button", { name: "Comparison" }).click();
  await confirmLeavingDegree(page);
  await expect(page.getByRole("heading", { name: `Compare universities for ${ENGINEERING}` })).toBeVisible();
  await breadcrumb(page).getByRole("button", { name: "All Courses" }).click();
  await expect(heading(page, "Courses")).toBeVisible();
  await expectTrail(page, ["Home", "All Courses"]);
  await breadcrumb(page).getByRole("button", { name: "Home" }).click();
  await expect(heading(page, LANDING)).toBeVisible();
});

test("quiz route: the result, recommendations, comparison and study plan keep the quiz in their breadcrumbs", async ({ page }) => {
  await page.getByRole("button", { name: "Take the interest quiz" }).first().click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await answerScreening(page);
  await expect(page.getByRole("heading", { name: "Your Holland Code Profile is" })).toBeVisible();
  await expectTrail(page, ["Home", "Quiz Result"]);

  await page.getByRole("button", { name: "View course recommendations" }).click();
  await expectTrail(page, ["Home", "Quiz Result", "Recommendations"]);
  await page.getByRole("heading", { name: ENGINEERING }).locator("..").getByRole("button", { name: "2 universities offer this" }).click();
  await expectTrail(page, ["Home", "Quiz Result", "Recommendations", "Comparison"]);
  await openStudyPlanFromComparison(page);
  await expectTrail(page, ["Home", "Quiz Result", "Recommendations", "Comparison", "Study Plan"]);

  await breadcrumb(page).getByRole("button", { name: "Recommendations" }).click();
  await confirmLeavingDegree(page);
  await expect(page.getByRole("heading", { name: "Recommended courses" })).toBeVisible();
  await breadcrumb(page).getByRole("button", { name: "Quiz Result" }).click();
  await expect(page.getByRole("heading", { name: "Your Holland Code Profile is" })).toBeVisible();
});

test("a quiz started from a study plan links back to that study plan", async ({ page }) => {
  await openEngineeringComparison(page);
  await openStudyPlanFromComparison(page);
  await page.getByRole("button", { name: "Not sure this is right for you? Take the interest quiz" }).click();
  await confirmLeavingDegree(page);
  await expect(heading(page, "Interest quiz")).toBeVisible();
  await expectTrail(page, ["Home", "Study Plan", "Quiz"]);
  await breadcrumb(page).getByRole("button", { name: "Study Plan" }).click();
  await expect(heading(page, ENGINEERING)).toBeVisible();
  await expectTrail(page, ["Home", "All Courses", "Comparison", "Study Plan"]);
});

test("Back and Forward step through a deep route, and a reload keeps the comparison", async ({ page }) => {
  await openEngineeringComparison(page);
  await openStudyPlanFromComparison(page);

  await page.goBack();
  await confirmLeavingDegree(page);
  await expect(page.getByRole("heading", { name: `Compare universities for ${ENGINEERING}` })).toBeVisible();
  await page.goBack();
  await expect(heading(page, "Courses")).toBeVisible();
  await page.goBack();
  await expect(heading(page, LANDING)).toBeVisible();
  await page.goForward();
  await page.goForward();
  await expect(page.getByRole("heading", { name: `Compare universities for ${ENGINEERING}` })).toBeVisible();

  // The comparison is saved in the history entry, so a reload reopens the same course.
  await page.reload();
  await expect(page.getByRole("heading", { name: `Compare universities for ${ENGINEERING}` })).toBeVisible();
  await expectTrail(page, ["Home", "All Courses", "Comparison"]);
});

test("Browser back and forward buttons move between screens, and a reload keeps the screen", async ({ page }) => {
  const landing = heading(page, LANDING);
  const courses = heading(page, "Courses");
  await page.getByRole("button", { name: "Plan it out" }).click();
  await expect(courses).toBeVisible();
  await page.goBack();
  await expect(landing).toBeVisible();
  await page.goForward();
  await expect(courses).toBeVisible();
  await page.reload();
  await expect(courses).toBeVisible();
  await page.getByRole("button", { name: "UniXPrep home" }).click();
  await page.getByRole("link", { name: "See how it works" }).click();
  await page.goBack();
  await expect(landing).toBeVisible();
  await page.goBack();
  await expect(courses).toBeVisible();
});

test("a saved screen the app no longer recognises falls back to the landing page", async ({ page }) => {
  await page.evaluate(() => history.replaceState({ name: "fees" }, ""));
  await page.reload();
  await expect(heading(page, LANDING)).toBeVisible();
});

test("each page opens at the top", async ({ page }) => {
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await nav(page).getByRole("button", { name: "View All Courses", exact: true }).click();
  await expect(heading(page, "Courses")).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("the skip link moves keyboard focus past the nav bar to the page content", async ({ page }) => {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await page.keyboard.press("Tab");
  // The next stop is inside the page, not one of the nav links.
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#main-content")))).toBeTruthy();
});

const leaveDialog = (page: Page) => page.getByRole("dialog", { name: "Leaving resets this page" });
const majorSelect = (page: Page) => page.getByRole("combobox", { name: "Major", exact: true });

test("leaving a study plan asks first: Stay keeps the plan, Leave leaves and resets it", async ({ page }) => {
  await openEngineeringComparison(page);
  await openStudyPlanFromComparison(page);
  const major = await majorSelect(page).locator("option").nth(1).getAttribute("value");
  await majorSelect(page).selectOption(major!);

  await nav(page).getByRole("button", { name: "View All Courses", exact: true }).click();
  await expect(leaveDialog(page)).toContainText("If you leave or refresh, this degree page starts again from the official handbook.");
  await leaveDialog(page).getByRole("button", { name: "Stay on this page" }).click();
  await expect(leaveDialog(page)).toBeHidden();
  await expect(heading(page, ENGINEERING)).toBeVisible();
  await expect(majorSelect(page)).toHaveValue(major!);

  // Escape is the same as Stay.
  await breadcrumb(page).getByRole("button", { name: "Comparison" }).click();
  await page.keyboard.press("Escape");
  await expect(heading(page, ENGINEERING)).toBeVisible();

  await nav(page).getByRole("button", { name: "View All Courses", exact: true }).click();
  await confirmLeavingDegree(page);
  await expect(heading(page, "Courses")).toBeVisible();
  await page.getByRole("heading", { name: ENGINEERING }).locator("..").getByRole("button", { name: "2 universities offer this" }).click();
  await openStudyPlanFromComparison(page);
  await expect(majorSelect(page)).toHaveValue("");
});

test("Back from a study plan asks first: Stay keeps the page, Leave goes back without an extra history entry", async ({ page }) => {
  await openEngineeringComparison(page);
  await openStudyPlanFromComparison(page);

  await page.goBack();
  await expect(leaveDialog(page)).toBeVisible();
  await leaveDialog(page).getByRole("button", { name: "Stay on this page" }).click();
  await expect(heading(page, ENGINEERING)).toBeVisible();

  await page.goBack();
  await confirmLeavingDegree(page);
  await expect(page.getByRole("heading", { name: `Compare universities for ${ENGINEERING}` })).toBeVisible();
  await page.goBack();
  await expect(heading(page, "Courses")).toBeVisible();
});

test("refreshing a study plan shows the browser's leave warning and reloads it reset", async ({ page }) => {
  const warnings: string[] = [];
  page.on("dialog", (dialog) => warnings.push(dialog.type()));
  await openEngineeringComparison(page);
  await openStudyPlanFromComparison(page);
  const major = await majorSelect(page).locator("option").nth(1).getAttribute("value");
  await majorSelect(page).selectOption(major!);

  await page.reload();
  expect(warnings).toContain("beforeunload");
  await expect(heading(page, ENGINEERING)).toBeVisible();
  await expect(majorSelect(page)).toHaveValue("");
});
