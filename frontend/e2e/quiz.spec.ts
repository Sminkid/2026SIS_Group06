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

const SCREENING_COUNT = screeningQuestions.length;
const INITIAL_COUNT = SCREENING_COUNT + closingQuestions.length;

const riasecLabels = {
  categories: CATEGORY_IDS.map((id) => ({ id, name: CATEGORY_NAMES[id], description: `${CATEGORY_NAMES[id]} description.` })),
  subcategories: [],
};

// An engineering-leaning persona: screening ranks Realistic/Investigative top (88%, 76%, 64%, 52%, 40%, 28%), and the
// screening-stage (category-only) recommendations surface a real Engineering degree.
const screeningResponseBody = {
  rankedCategoryIds: [...CATEGORY_IDS],
  categoryScores: Object.fromEntries(CATEGORY_IDS.map((id, i) => [id, 0.88 - i * 0.12])),
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

const CONTINUE_BUTTON = /^(Next|Continue to a closer look|See my initial results|See my personalised result)$/;

interface Response { questionId: string; value: number }

interface MockOptions {
  /** Replaces the screening response, e.g. to leave out the scores an older backend didn't send. */
  screening?: object;
  final?: object;
  /** How many times starting a session fails (500) before it succeeds. */
  failStarts?: number;
  /** How many times submitting the screening answers fails (500) before it succeeds. */
  failScreenings?: number;
  /** Holds the screening response until the promise settles, to observe the loading pop-up. */
  holdScreening?: Promise<void>;
}

/** Fakes the quiz and handbook API, and records what the quiz sends so tests can check the submitted answers. */
const mockQuizApi = async (page: Page, options: MockOptions = {}) => {
  const errors: string[] = [];
  const sent = { sessions: 0, screening: [] as Response[][], closing: [] as Response[][], drillDown: [] as Response[][] };
  let failStarts = options.failStarts ?? 0;
  let failScreenings = options.failScreenings ?? 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // A deliberately failed request is logged by the browser; anything else is a real error.
    if (message.type() === "error" && !message.text().includes("500")) errors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const responses = () => (request.postDataJSON() as { responses: Response[] }).responses;
    if (path === "/api/assessment/riasec-labels") return route.fulfill({ json: riasecLabels });
    if (path === "/api/assessment/sessions" && request.method() === "POST") {
      sent.sessions += 1;
      if (failStarts-- > 0) return route.fulfill({ status: 500, json: { error: "Unavailable" } });
      return route.fulfill({ status: 201, json: { sessionId: `session-${sent.sessions}`, questions: screeningQuestions } });
    }
    if (path.endsWith("/screening-responses")) {
      if (failScreenings-- > 0) return route.fulfill({ status: 500, json: { error: "Unavailable" } });
      sent.screening.push(responses());
      await options.holdScreening;
      return route.fulfill({ json: options.screening ?? screeningResponseBody });
    }
    if (path.endsWith("/closing-responses")) { sent.closing.push(responses()); return route.fulfill({ json: { ok: true } }); }
    if (path.endsWith("/drill-down")) return route.fulfill({ json: { questions: drillDownQuestions } });
    if (path.endsWith("/drill-down-responses")) {
      sent.drillDown.push(responses());
      return route.fulfill({ json: options.final ?? finalResultBody });
    }
    // The course list groups the recommended degrees from each university's handbook.
    if (path === "/api/universities") return route.fulfill({ json: [{ id: "uts", code: "UTS", name: "University of Technology Sydney", rankings: [] }] });
    if (path.endsWith("/handbooks/latest")) return route.fulfill({ json: { year: 2026 } });
    if (path === "/api/universities/UTS/degrees") {
      return route.fulfill({ json: screeningResponseBody.recommendations.map((degree) =>
        ({ id: degree.degreeId, code: degree.code, name: degree.name, creditPoints: 144, handbookYear: degree.year })) });
    }
    return route.fulfill({ json: {} });
  });
  return { errors, sent };
};

const startQuiz = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Interest Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
};

const answerQuestions = async (page: Page, count: number, value: string) => {
  for (let i = 0; i < count; i++) {
    await page.getByRole("radio", { name: new RegExp(`^${value} `) }).click();
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
  }
};

const questionList = (page: Page) => page.getByRole("list", { name: "Quiz progress" }).getByRole("listitem");
const progress = (page: Page) => page.getByText(/ · Question \d+ of \d+$/);
const topCards = (page: Page) => page.getByRole("list", { name: "Your top interest areas" }).getByRole("listitem");
const otherAreas = (page: Page) => page.getByRole("list", { name: "Your other interest areas" }).getByRole("listitem");
const hollandCode = (page: Page) => page.getByText(/^[A-Z] – [A-Z] – [A-Z]$/);
const valuesOf = (responses: Response[]) => responses.map((response) => response.value);

test("engineering-leaning persona: completes the full quiz and is recommended an Engineering major", async ({ page }) => {
  const { errors, sent } = await mockQuizApi(page);
  await startQuiz(page);

  // Screening + the 2 merged bonus questions, with no results screen in between.
  await answerQuestions(page, INITIAL_COUNT, "5");
  expect(valuesOf(sent.screening[0]!)).toEqual(Array(SCREENING_COUNT).fill(5));
  expect(sent.screening[0]!.map((response) => response.questionId)).toEqual(screeningQuestions.map((question) => question.id));
  expect(sent.closing[0]!.map((response) => response.questionId)).toEqual(closingQuestions.map((question) => question.id));

  await expect(page.getByText("Your initial result")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top 3 dimensions breakdown" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Personalise further", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "View course recommendations" }).click();
  await expect(page.getByRole("heading", { name: "Recommended courses" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bachelor of Engineering (Honours)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bachelor of Science", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Personalise further" }).click();
  await answerQuestions(page, drillDownQuestions.length, "4");
  expect(valuesOf(sent.drillDown[0]!)).toEqual(Array(drillDownQuestions.length).fill(4));

  await expect(page.getByText("Your personalised result")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mechanical Engineering" })).toBeVisible();
  await expect(page.getByText("MAJ03007")).toBeVisible();
  // The subcategory breakdown was removed from the final result; it shouldn't come back.
  await expect(page.getByText("Top specific interests")).toHaveCount(0);

  expect(errors).toEqual([]);
});

/** Each area's colour on the result page; its percentage, rank label, icon and bar all use it. */
const AREA_COLOURS: Record<string, string> = {
  Realistic: "#15803d", Investigative: "#7c3aed", Artistic: "#c2410c",
  Social: "#be185d", Enterprising: "#0f766e", Conventional: "#1d4ed8",
};
const RANK_TAGS = ["Dominant strength", "High affinity", "Strong interest"];
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

interface Area { name: string; score: number | null }

/** Reads the colours, icon and bar of a card or row, so they can be checked against its area. */
const lookOf = (item: ReturnType<Page["locator"]>) => item.evaluate((element) => {
  const bar = element.querySelector<HTMLElement>('span[aria-hidden="true"] > span');
  const track = bar?.parentElement;
  const colourOf = (selector: string) => {
    const found = element.querySelector<HTMLElement>(selector);
    return found ? getComputedStyle(found).color : null;
  };
  return {
    // Percentage text, rank label and icon tile are coloured inline.
    inlineColours: [...element.querySelectorAll<HTMLElement>("[style*='color']")].map((node) => getComputedStyle(node).color),
    icon: element.querySelector("svg")?.innerHTML ?? null,
    iconColour: colourOf("svg"),
    barShare: bar && track ? bar.getBoundingClientRect().width / track.getBoundingClientRect().width : null,
    barColour: bar ? getComputedStyle(bar).backgroundColor : null,
  };
});

/**
 * Checks the whole result against the areas in ranked order: the code, names line and summary, then each of the
 * top three cards (name and letter, percentage, rank label, description, colour, icon, bar) and the other rows.
 */
const expectResult = async (page: Page, areas: Area[]) => {
  const [top, others] = [areas.slice(0, 3), areas.slice(3)];
  const percent = (score: number) => `${Math.round(score * 100)}%`;
  await expect(hollandCode(page)).toHaveText(top.map((area) => area.name[0]).join(" – "));
  await expect(page.getByText(top.map((area) => area.name).join(" • "), { exact: true })).toBeVisible();
  await expect(page.getByText(`Your strongest interest areas are ${top[0]!.name}, ${top[1]!.name} and ${top[2]!.name}.`)).toBeVisible();

  await expect(topCards(page)).toHaveCount(top.length);
  const icons = new Set<string | null>();
  for (const [index, area] of top.entries()) {
    const card = topCards(page).nth(index);
    const colour = rgb(AREA_COLOURS[area.name]!);
    await expect(card.getByRole("heading", { level: 3 })).toHaveText(`#${index + 1} ${area.name} (${area.name[0]})`);
    await expect(card).toContainText(RANK_TAGS[index]!, { ignoreCase: true });
    await expect(card).toContainText(`${area.name} description.`);
    const look = await lookOf(card);
    expect(look.iconColour, `${area.name} icon colour`).toBe(colour);
    expect(look.icon, `${area.name} icon`).not.toBeNull();
    icons.add(look.icon);
    expect(look.inlineColours.every((value) => value === colour), `${area.name} card colours`).toBeTruthy();
    if (area.score === null) {
      await expect(card).not.toContainText("%");
      expect(look.barShare, `${area.name} has no bar`).toBeNull();
    } else {
      await expect(card).toContainText(percent(area.score));
      expect(look.barColour, `${area.name} bar colour`).toBe(colour);
      expect(look.barShare!, `${area.name} bar length`).toBeCloseTo(Math.round(area.score * 100) / 100, 2);
    }
  }
  expect(icons.size, "each top area has its own icon").toBe(top.length);

  await expect(otherAreas(page)).toHaveCount(others.length);
  for (const [index, area] of others.entries()) {
    const row = otherAreas(page).nth(index);
    const look = await lookOf(row);
    // The other areas show only a name, score and bar, without the description.
    await expect(row).not.toContainText("description");
    if (area.score === null) {
      await expect(row).toHaveText(`${index + 4}. ${area.name}`);
      expect(look.barShare, `${area.name} has no bar`).toBeNull();
    } else {
      await expect(row).toHaveText(new RegExp(`^${index + 4}\\. ${area.name}\\s*${percent(area.score)}$`));
      expect(look.barColour, `${area.name} bar colour`).toBe(rgb(AREA_COLOURS[area.name]!));
      expect(look.barShare!, `${area.name} bar length`).toBeCloseTo(Math.round(area.score * 100) / 100, 2);
    }
  }
};

const areasFrom = (ids: string[], scores?: Record<string, number>): Area[] =>
  ids.map((id) => ({ name: CATEGORY_NAMES[id]!, score: scores ? scores[id]! : null }));

test("the initial result shows the Holland Code, every area's score, and each area's colour, icon and bar", async ({ page }) => {
  const { errors } = await mockQuizApi(page);
  await startQuiz(page);
  await answerQuestions(page, INITIAL_COUNT, "5");

  await expect(page.getByText("Your initial result")).toBeVisible();
  // Realistic 88%, Investigative 76%, Artistic 64%, then Social 52%, Enterprising 40%, Conventional 28%.
  await expectResult(page, areasFrom(screeningResponseBody.rankedCategoryIds, screeningResponseBody.categoryScores));
  expect(errors).toEqual([]);
});

test("an initial result without scores still shows the code and areas, just without percentages or bars", async ({ page }) => {
  const { categoryScores: _scores, ...withoutScores } = screeningResponseBody;
  const { errors } = await mockQuizApi(page, { screening: withoutScores });
  await startQuiz(page);
  await answerQuestions(page, INITIAL_COUNT, "3");

  await expectResult(page, areasFrom(screeningResponseBody.rankedCategoryIds));
  await expect(page.getByRole("list", { name: "Your top interest areas" })).not.toContainText("%");
  expect(errors).toEqual([]);
});

test("the personalised result follows the new order when the extra questions change the ranking", async ({ page }) => {
  const reordered = ["riasec-social", "riasec-realistic", "riasec-investigative", "riasec-artistic", "riasec-enterprising", "riasec-conventional"];
  const scores = Object.fromEntries(reordered.map((id, i) => [id, [0.95, 0.85, 0.75, 0.65, 0.55, 0.45][i]!]));
  const { errors } = await mockQuizApi(page, { final: { ...finalResultBody, rankedCategoryIds: reordered, categoryScores: scores } });
  await startQuiz(page);
  await answerQuestions(page, INITIAL_COUNT, "4");
  await expect(hollandCode(page)).toHaveText("R – I – A");

  await page.getByRole("button", { name: "Personalise further", exact: true }).click();
  await answerQuestions(page, drillDownQuestions.length, "4");
  await expect(page.getByText("Your personalised result")).toBeVisible();
  // Social 95%, Realistic 85%, Investigative 75%, then Artistic 65%, Enterprising 55%, Conventional 45%.
  await expectResult(page, areasFrom(reordered, scores));
  expect(errors).toEqual([]);
});

test("scores are rounded to whole percentages, from 0% to 100%", async ({ page }) => {
  const scores = Object.fromEntries(CATEGORY_IDS.map((id, i) => [id, [1, 0.876, 0.647, 0.523, 0.398, 0.004][i]!]));
  const { errors } = await mockQuizApi(page, { screening: { ...screeningResponseBody, categoryScores: scores } });
  await startQuiz(page);
  await answerQuestions(page, INITIAL_COUNT, "4");

  await expect(topCards(page).nth(0)).toContainText("100%");
  await expect(topCards(page).nth(1)).toContainText("88%");
  await expect(topCards(page).nth(2)).toContainText("65%");
  await expect(otherAreas(page)).toHaveText([/52%$/, /40%$/, /0%$/]);
  await expectResult(page, areasFrom(CATEGORY_IDS, scores));
  expect(errors).toEqual([]);
});

test("Likert buttons reflect selection and Next stays disabled until answered", async ({ page }) => {
  const { errors } = await mockQuizApi(page);
  await startQuiz(page);

  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
  await expect(page.getByRole("radio")).toHaveText(["1 Not at all", "2 Not really", "3 Neutral", "4 Like it", "5 Love it"]);

  const radioThree = page.getByRole("radio", { name: "3 Neutral" });
  await radioThree.click();
  await expect(radioThree).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
  await expect(nextButton).toBeEnabled();

  // Regression guard for the earlier bug where the selected button's number became
  // invisible (same text colour as its background) due to a Tailwind class conflict.
  const [color, background] = await radioThree.evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.color, style.backgroundColor];
  });
  expect(color).not.toBe(background);

  await nextButton.click();
  await expect(progress(page)).toHaveText("General interests · Question 2 of 18");
  await expect(page.getByRole("button", { name: "Back" })).toBeEnabled();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(progress(page)).toHaveText("General interests · Question 1 of 18");
  await expect(radioThree).toHaveAttribute("aria-checked", "true");

  expect(errors).toEqual([]);
});

test("each phase is labelled, and the last question's button says what comes next", async ({ page }) => {
  const { errors } = await mockQuizApi(page);
  await startQuiz(page);
  await expect(progress(page)).toHaveText("General interests · Question 1 of 18");

  await answerQuestions(page, SCREENING_COUNT - 1, "4");
  await page.getByRole("radio", { name: /^4 / }).click();
  await page.getByRole("button", { name: "Continue to a closer look" }).click();

  await expect(progress(page)).toHaveText("A closer look · Question 19 of 20");
  await expect(page.getByText("Bonus question 1")).toBeVisible();
  // The 2 extra questions join the end of the list, after the 18 already answered.
  await expect(questionList(page)).toHaveCount(INITIAL_COUNT);
  await expect(questionList(page).nth(SCREENING_COUNT)).toHaveAttribute("aria-current", "step");
  await expect(questionList(page).nth(SCREENING_COUNT - 1)).toContainText("✓");
  await answerQuestions(page, 1, "4");
  await page.getByRole("radio", { name: /^4 / }).click();
  await expect(page.getByRole("button", { name: "See my initial results" })).toBeVisible();
  await page.getByRole("button", { name: "See my initial results" }).click();

  await page.getByRole("button", { name: "Personalise further", exact: true }).click();
  await expect(progress(page)).toHaveText("Fine-tuning your match · Question 1 of 25");
  // The personalised questions get a fresh list, with nothing answered yet.
  await expect(questionList(page)).toHaveCount(drillDownQuestions.length);
  await expect(questionList(page).first()).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("list", { name: "Quiz progress" })).not.toContainText("✓");
  await answerQuestions(page, drillDownQuestions.length - 1, "4");
  await page.getByRole("radio", { name: /^4 / }).click();
  await expect(page.getByRole("button", { name: "See my personalised result" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the question list ticks answered questions, lets you revisit them, and stops you skipping ahead", async ({ page }) => {
  const { errors } = await mockQuizApi(page);
  await startQuiz(page);
  await answerQuestions(page, 2, "5");

  const steps = questionList(page);
  await expect(steps).toHaveCount(SCREENING_COUNT);
  await expect(steps.nth(0)).toContainText("✓");
  await expect(steps.nth(0).getByRole("button", { name: "Question 1 (answered)" })).toBeVisible();
  await expect(steps.nth(2)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(3).getByRole("button")).toHaveCount(0);
  await expect(steps.nth(10).getByRole("button")).toHaveCount(0);

  await steps.nth(0).getByRole("button").click();
  await expect(progress(page)).toHaveText("General interests · Question 1 of 18");
  await expect(page.getByRole("radio", { name: "5 Love it" })).toHaveAttribute("aria-checked", "true");
  // The revisited question becomes the current one (no tick), and the others keep their marks.
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(0)).not.toContainText("✓");
  await expect(steps.nth(1)).toContainText("✓");
  await expect(steps.nth(2)).not.toHaveAttribute("aria-current", "step");
  // The next unanswered question can be reached directly; nothing past it can.
  await steps.nth(2).getByRole("button").click();
  await expect(progress(page)).toHaveText("General interests · Question 3 of 18");
  expect(errors).toEqual([]);
});

test("Skip this question records the lowest answer and moves on, including on the last question", async ({ page }) => {
  const { errors, sent } = await mockQuizApi(page);
  await startQuiz(page);

  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect(progress(page)).toHaveText("General interests · Question 2 of 18");
  const steps = page.getByRole("list", { name: "Quiz progress" }).getByRole("listitem");
  await expect(steps.nth(0)).toContainText("(answered)");

  await answerQuestions(page, SCREENING_COUNT - 2, "5");
  // Skipping the last question submits straight away, with the skipped answer included.
  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect(progress(page)).toHaveText("A closer look · Question 19 of 20");
  const values = valuesOf(sent.screening[0]!);
  expect(values).toHaveLength(SCREENING_COUNT);
  expect(values[0]).toBe(1);
  expect(values.at(-1)).toBe(1);
  expect(values.slice(1, -1)).toEqual(Array(SCREENING_COUNT - 2).fill(5));
  expect(errors).toEqual([]);
});

test("Personalise further on the result goes straight to the extra questions", async ({ page }) => {
  const { errors } = await mockQuizApi(page);
  await startQuiz(page);
  await answerQuestions(page, INITIAL_COUNT, "3");

  await expect(page.getByRole("heading", { name: "Top 3 dimensions breakdown" })).toBeVisible();
  await page.getByRole("button", { name: "Personalise further", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Recommended courses" })).toHaveCount(0);
  await expect(progress(page)).toHaveText("Fine-tuning your match · Question 1 of 25");
  expect(errors).toEqual([]);
});

test("Retake quiz starts a new session from the first question with no answers kept", async ({ page }) => {
  const { errors, sent } = await mockQuizApi(page);
  await startQuiz(page);
  await answerQuestions(page, INITIAL_COUNT, "5");

  await page.getByRole("button", { name: "Retake quiz" }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(progress(page)).toHaveText("General interests · Question 1 of 18");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(sent.sessions).toBe(2);
  expect(errors).toEqual([]);
});

test("if the quiz can't start, an error is shown and Try again starts it", async ({ page }) => {
  const { errors } = await mockQuizApi(page, { failStarts: 1 });
  await startQuiz(page);

  await expect(page.getByRole("alert")).toContainText("We couldn't start the quiz.");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(progress(page)).toHaveText("General interests · Question 1 of 18");
  expect(errors).toEqual([]);
});

test("if submitting fails, the answers are kept and submitting again continues", async ({ page }) => {
  const { errors, sent } = await mockQuizApi(page, { failScreenings: 1 });
  await startQuiz(page);
  await answerQuestions(page, SCREENING_COUNT - 1, "5");
  await page.getByRole("radio", { name: "5 Love it" }).click();
  await page.getByRole("button", { name: "Continue to a closer look" }).click();

  await expect(page.getByText("We couldn't submit your answers. Please try again.")).toBeVisible();
  await expect(progress(page)).toHaveText("General interests · Question 18 of 18");
  await expect(page.getByRole("radio", { name: "5 Love it" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Continue to a closer look" }).click();
  await expect(progress(page)).toHaveText("A closer look · Question 19 of 20");
  expect(valuesOf(sent.screening[0]!)).toEqual(Array(SCREENING_COUNT).fill(5));
  expect(errors).toEqual([]);
});

test("a loading pop-up shows while answers are being submitted", async ({ page }) => {
  let release!: () => void;
  const { errors } = await mockQuizApi(page, { holdScreening: new Promise<void>((resolve) => { release = resolve; }) });
  await startQuiz(page);
  await answerQuestions(page, SCREENING_COUNT - 1, "4");
  await page.getByRole("radio", { name: /^4 / }).click();
  await page.getByRole("button", { name: "Continue to a closer look" }).click();

  const loading = page.getByRole("dialog", { name: "Saving your answers and preparing a few more questions…" });
  await expect(loading).toBeVisible();
  // Questions can't be revisited while their answers are being sent.
  const listButtons = page.getByRole("list", { name: "Quiz progress" }).getByRole("button", { includeHidden: true });
  await expect(listButtons).toHaveCount(SCREENING_COUNT - 1);
  for (const button of await listButtons.all()) await expect(button).toBeDisabled();
  release();
  await expect(loading).toBeHidden();
  await expect(progress(page)).toHaveText("A closer look · Question 19 of 20");
  await expect(listButtons.first()).toBeEnabled();
  expect(errors).toEqual([]);
});

test("the quiz fits a phone screen without sideways scrolling", async ({ page }) => {
  const { errors } = await mockQuizApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startQuiz(page);
  await expect(progress(page)).toBeVisible();
  // There's no room for the question list beside the question, so only the "Question n of m" label shows.
  await expect(page.locator('ol[aria-label="Quiz progress"]')).toBeHidden();
  for (const radio of await page.getByRole("radio").all()) await expect(radio).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await answerQuestions(page, INITIAL_COUNT, "4");
  await expect(hollandCode(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
