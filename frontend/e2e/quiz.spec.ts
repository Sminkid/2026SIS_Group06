import { test, expect, type Page } from "@playwright/test";

const CATEGORY_IDS = [
  "riasec-realistic",
  "riasec-investigative",
  "riasec-artistic",
  "riasec-social",
  "riasec-enterprising",
  "riasec-conventional",
];
const CATEGORY_NAMES: Record<string, string> = {
  "riasec-realistic": "Realistic",
  "riasec-investigative": "Investigative",
  "riasec-artistic": "Artistic",
  "riasec-social": "Social",
  "riasec-enterprising": "Enterprising",
  "riasec-conventional": "Conventional",
};

const screeningQuestions = CATEGORY_IDS.flatMap((categoryId) =>
  Array.from({ length: 3 }, (_, i) => ({
    id: `screening-${categoryId}-${i}`,
    categoryId,
    subcategoryId: null,
    text: `${CATEGORY_NAMES[categoryId]} screening question ${i + 1}`,
  })),
);

const closingQuestions = [
  { id: "closing-1", categoryId: "riasec-realistic", subcategoryId: "riasec-realistic-engineering", text: "Bonus question 1" },
  { id: "closing-2", categoryId: "riasec-realistic", subcategoryId: "riasec-realistic-mechanical", text: "Bonus question 2" },
];

const drillDownQuestions = Array.from({ length: 25 }, (_, i) => {
  const categoryId = CATEGORY_IDS[i % CATEGORY_IDS.length]!;
  return {
    id: `drilldown-${i}`,
    categoryId,
    subcategoryId: `${categoryId}-sample`,
    text: `Drill-down question ${i + 1}`,
  };
});

const riasecLabels = {
  categories: CATEGORY_IDS.map((id) => ({ id, name: CATEGORY_NAMES[id], description: `${CATEGORY_NAMES[id]} description.` })),
  subcategories: [],
};

// An engineering-leaning persona: screening ranks Realistic/Investigative top, and the
// screening-stage (category-only) recommendations surface a real Engineering degree.
const screeningResponseBody = {
  rankedCategoryIds: [...CATEGORY_IDS],
  closingQuestions,
  recommendations: [
    { degreeId: "deg-1", code: "C09066", name: "Bachelor of Engineering (Honours)", description: "<p>Study engineering, build real things, and solve practical problems.</p>", universityCode: "UTS", year: 2026, matchScore: 0.95 },
    { degreeId: "deg-2", code: "C10242", name: "Bachelor of Science", description: "<p>A broad science degree.</p>", universityCode: "UTS", year: 2026, matchScore: 0.9 },
    { degreeId: "deg-3", code: "C10457", name: "Bachelor of Mathematical Sciences", description: "<p>Mathematics and statistics.</p>", universityCode: "UTS", year: 2026, matchScore: 0.88 },
    { degreeId: "deg-4", code: "C10172", name: "Bachelor of Molecular Biotechnology", description: "<p>Biotechnology research.</p>", universityCode: "UTS", year: 2026, matchScore: 0.85 },
  ],
};

// The final, subcategory-informed result: a specific Engineering major, not just the course.
const finalResultBody = {
  rankedCategoryIds: [...CATEGORY_IDS],
  categoryScores: Object.fromEntries(CATEGORY_IDS.map((id, i) => [id, 0.9 - i * 0.1])),
  subcategoryScores: {},
  recommendation: {
    componentId: "comp-1",
    code: "MAJ03007",
    name: "Mechanical Engineering",
    type: "MAJOR",
    matchScore: 0.93,
    usedSubcategoryData: true,
  },
};

const CONTINUE_BUTTON = /^(Next|See my initial results|See my result)$/;

const mockQuizApi = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  void page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const method = route.request().method();
    if (path === "/api/assessment/riasec-labels") return route.fulfill({ json: riasecLabels });
    if (path === "/api/assessment/sessions" && method === "POST") {
      return route.fulfill({ status: 201, json: { sessionId: "test-session", questions: screeningQuestions } });
    }
    if (path.endsWith("/screening-responses")) return route.fulfill({ json: screeningResponseBody });
    if (path.endsWith("/closing-responses")) return route.fulfill({ json: { ok: true } });
    if (path.endsWith("/drill-down")) return route.fulfill({ json: { questions: drillDownQuestions } });
    if (path.endsWith("/drill-down-responses")) return route.fulfill({ json: finalResultBody });
    if (path === "/api/universities") return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return errors;
};

const startQuiz = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Interest quiz" }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
};

const answerQuestions = async (page: Page, count: number, value: string) => {
  for (let i = 0; i < count; i++) {
    await page.getByRole("radio", { name: value, exact: true }).click();
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
  }
};

test("engineering-leaning persona: completes the full quiz and is recommended an Engineering major", async ({ page }) => {
  const errors = mockQuizApi(page);
  await startQuiz(page);

  // Screening + the 2 merged bonus questions - no results screen in between (fix #1).
  await answerQuestions(page, 20, "5");

  await expect(page.getByRole("heading", { name: "Your top interest areas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip to personalise further" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View course recommendations" })).toBeVisible();

  await page.getByRole("button", { name: "View course recommendations" }).click();
  await expect(page.getByRole("heading", { name: "Bachelor of Engineering (Honours)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bachelor of Science", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Personalise further" }).click();
  await answerQuestions(page, 25, "4");

  await expect(page.getByRole("heading", { name: "Mechanical Engineering" })).toBeVisible();
  await expect(page.getByText("MAJ03007")).toBeVisible();
  // Fix #3: the subcategory breakdown should no longer be shown on the final result.
  await expect(page.getByText("Top specific interests")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("Likert buttons reflect selection and Next stays disabled until answered", async ({ page }) => {
  const errors = mockQuizApi(page);
  await startQuiz(page);

  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();

  const radioThree = page.getByRole("radio", { name: "3", exact: true });
  await radioThree.click();
  await expect(radioThree).toHaveAttribute("aria-checked", "true");
  await expect(nextButton).toBeEnabled();

  // Regression guard for the earlier bug where the selected button's number became
  // invisible (same text colour as its background) due to a Tailwind class conflict.
  const [color, background] = await radioThree.evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.color, style.backgroundColor];
  });
  expect(color).not.toBe(background);

  await nextButton.click();
  await expect(page.getByText("Question 2 of 18")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeEnabled();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Question 1 of 18")).toBeVisible();
  await expect(page.getByRole("radio", { name: "3", exact: true })).toHaveAttribute("aria-checked", "true");

  expect(errors).toEqual([]);
});

test("Skip to personalise further bypasses the course recommendations screen", async ({ page }) => {
  const errors = mockQuizApi(page);
  await startQuiz(page);
  await answerQuestions(page, 20, "3");

  await expect(page.getByRole("heading", { name: "Your top interest areas" })).toBeVisible();
  await page.getByRole("button", { name: "Skip to personalise further" }).click();

  await expect(page.getByRole("heading", { name: "Courses that might suit you" })).toHaveCount(0);
  await expect(page.getByText("Question 1 of 25")).toBeVisible();

  expect(errors).toEqual([]);
});

test("the quiz is reachable from the very first screen via the global nav", async ({ page }) => {
  const errors = mockQuizApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your university" })).toBeVisible();
  await page.getByRole("button", { name: "Interest quiz" }).click();
  await expect(page.getByRole("heading", { name: "Find degrees that match your interests" })).toBeVisible();
  expect(errors).toEqual([]);
});
