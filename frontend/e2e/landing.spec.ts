import { test, expect, type Page } from "@playwright/test";

/** The landing page needs no data; the pages it links to get empty lists so they render without a backend. */
const mockApi = (page: Page) => page.route("**/api/**", (route) => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith("/api/")) return route.continue();
  return route.fulfill({ json: path.endsWith("/handbooks/latest") ? { year: 2026 } : [] });
});

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const landingHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Build your university path" });
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(landingHeading(page)).toBeVisible();
});

test("is the first screen and introduces the app", async ({ page }) => {
  await expect(page.getByText("For students choosing a degree in Sydney")).toBeVisible();
  await expect(page.getByText("20 questions · About 5 minutes · Free · Built on the official UNSW, USYD and UTS handbooks")).toBeVisible();
  for (const heading of ["What you can do", "From “no idea” to a semester-by-semester plan", "Stuck on a term? Just ask.",
    "Built on official handbook data", "Start with 20 quick questions"]) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
  await expect(page.getByText("Course and fee information comes from university handbooks.")).toBeVisible();
});

test("both quiz buttons open the interest quiz", async ({ page }) => {
  const quizButtons = page.getByRole("button", { name: "Take the interest quiz" });
  await expect(quizButtons).toHaveCount(2);
  for (const index of [0, 1]) {
    await quizButtons.nth(index).click();
    await expect(page.getByRole("heading", { level: 1, name: "Interest quiz" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();
    await page.getByRole("button", { name: "UniXPrep home" }).click();
    await expect(landingHeading(page)).toBeVisible();
  }
});

test("“Plan it out” and the course-list link both open All Courses", async ({ page }) => {
  for (const name of ["Plan it out", "Start by browsing all courses and picking one"]) {
    await page.getByRole("button", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Courses" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("All Courses");
    await page.goBack();
    await expect(landingHeading(page)).toBeVisible();
  }
});

test("“What you can do” cards show an icon each and no links of their own", async ({ page }) => {
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "What you can do" }) });
  for (const title of ["Find courses that fit", "Compare universities", "Plan every semester"]) {
    const card = section.locator("div").filter({ has: page.getByRole("heading", { level: 3, name: title }) }).last();
    await expect(card.locator("svg")).toHaveCount(1);
    await expect(card.getByRole("button")).toHaveCount(0);
  }
  await expect(section.getByRole("button")).toHaveCount(1);
});

test("“How it works” shows five steps with previews of the real pages", async ({ page }) => {
  const section = page.locator("#how-it-works");
  for (const [number, label] of ["Quiz", "Result", "Courses", "Universities", "Study plan"].entries()) {
    await expect(section.getByText(`Step ${number + 1} · ${label}`, { exact: true })).toBeVisible();
  }
  const previews = section.locator('div[aria-hidden="true"]');
  await expect(previews).toHaveCount(5);
  await expect(previews.nth(0)).toContainText("General interests · Question 4 of 18");
  await expect(previews.nth(1)).toContainText("R – C – A");
  await expect(previews.nth(2)).toContainText("Recommended courses");
  await expect(previews.nth(3)).toContainText("Compare universities for Bachelor of Engineering (Honours)");
  await expect(previews.nth(3)).toContainText("Lowest");
  await expect(previews.nth(4)).toContainText("Year 1");
});

test("previews are decorative: hidden from screen readers and not reachable by keyboard", async ({ page }) => {
  const focusableInPreviews = await page.evaluate(() => [...document.querySelectorAll('[aria-hidden="true"]')]
    .flatMap((preview) => [...preview.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")]).length);
  expect(focusableInPreviews).toBe(0);
  await expect(page.getByRole("button", { name: "View Study Plan" })).toHaveCount(0);
});

test("the coverage section states the data behind the app", async ({ page }) => {
  const coverage = page.locator("section").filter({ has: page.getByRole("heading", { name: "Built on official handbook data" }) });
  await expect(coverage).toContainText("271");
  await expect(coverage).toContainText("2026–27");
  await expect(coverage).toContainText("Sydney universities: UNSW, USYD and UTS");
});

for (const width of [1280, 390]) {
  test(`“See how it works” lands below the sticky nav bar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    // Wait for the jump to finish (the section reaches the top of the window), then check it clears the nav bar.
    await page.waitForFunction(() => Math.abs(document.getElementById("how-it-works")!.getBoundingClientRect().top) < 250);
    const header = (await page.locator("header").first().boundingBox())!;
    const section = (await page.locator("#how-it-works").boundingBox())!;
    expect(section.y).toBeGreaterThanOrEqual(header.y + header.height);
    await expect(page.getByRole("heading", { name: "From “no idea” to a semester-by-semester plan" })).toBeInViewport();
  });
}

for (const width of [1440, 1280, 768, 390]) {
  test(`fits a ${width}px screen without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(landingHeading(page)).toBeVisible();
    expect(await fitsWidth(page)).toBeTruthy();
  });
}

const NAV_LINKS = [
  { name: "Interest Quiz", description: /Holland Code/, opens: "Interest quiz" },
  { name: "View All Courses", description: /Browse every course/, opens: "Courses" },
  { name: "University Handbooks", description: /official handbook/, opens: "Choose a university" },
];

test("nav links explain their page in a pop-up on hover, and the logo returns to the landing page", async ({ page }) => {
  const tooltips = page.locator('[role="tooltip"]');
  for (const [index, link] of NAV_LINKS.entries()) {
    const button = nav(page).getByRole("button", { name: link.name, exact: true });
    await expect(button).toHaveAccessibleDescription(link.description);
    await expect(tooltips.nth(index)).toBeHidden();
    await button.hover();
    await expect(tooltips.nth(index)).toBeVisible();
    await expect(tooltips.nth(index)).toHaveText(link.description);
    await page.mouse.move(10, 600);
    await expect(tooltips.nth(index)).toBeHidden();

    await button.click();
    await expect(page.getByRole("heading", { level: 1, name: link.opens })).toBeVisible();
    await page.getByRole("button", { name: "UniXPrep home" }).click();
    await expect(landingHeading(page)).toBeVisible();
  }
});

test("nav pop-ups also open on keyboard focus", async ({ page }) => {
  const quizLink = nav(page).getByRole("button", { name: "Interest Quiz", exact: true });
  await quizLink.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(quizLink).toBeFocused();
  await expect(page.locator('[role="tooltip"]').first()).toBeVisible();
});

for (const width of [1280, 768, 390]) {
  test(`nav pop-ups stay on a ${width}px screen, switching to the link's right edge when they would overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await expect(landingHeading(page)).toBeVisible();
    expect(await fitsWidth(page)).toBeTruthy();
    for (const [index, link] of NAV_LINKS.entries()) {
      const button = nav(page).getByRole("button", { name: link.name, exact: true });
      await button.hover();
      const tooltip = page.locator('[role="tooltip"]').nth(index);
      await expect(tooltip).toBeVisible();
      const box = (await tooltip.boundingBox())!;
      const linkBox = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (width > 560) {
        // Left-aligned with the link unless that would overflow, then right-aligned with it.
        const alignedLeft = Math.abs(box.x - linkBox.x) < 1.5;
        const alignedRight = Math.abs(box.x + box.width - (linkBox.x + linkBox.width)) < 1.5;
        expect(alignedLeft || alignedRight).toBeTruthy();
        if (alignedRight) expect(linkBox.x + box.width).toBeGreaterThan(width);
      }
      expect(await fitsWidth(page)).toBeTruthy();
    }
  });
}
