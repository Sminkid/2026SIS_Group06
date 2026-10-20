import { expect, type Page } from "@playwright/test";

/**
 * Leaving or refreshing a degree page resets it. A real user confirms the browser's "Leave site?" warning; tests do
 * the same, so `page.goto` and `page.reload` aren't cancelled by Playwright's default of dismissing dialogs.
 */
export const acceptLeavingDegreePages = (page: Page) => {
  page.on("dialog", (dialog) => { if (dialog.type() === "beforeunload") void dialog.accept(); });
};

/** Confirms the in-app "Leaving resets this page" pop-up shown when navigating away from a degree page. */
export const confirmLeavingDegree = async (page: Page) => {
  const dialog = page.getByRole("dialog", { name: "Leaving resets this page" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(dialog).toBeHidden();
};

/** Confirms the pop-up only if it opened, for helpers that may or may not start on a degree page. */
export const leaveDegreeIfAsked = async (page: Page) => {
  const dialog = page.getByRole("dialog", { name: "Leaving resets this page" });
  if (await dialog.isVisible()) await confirmLeavingDegree(page);
};
