import { expect, type Locator } from "@playwright/test";

/** Opens a Course Structure section if it's closed. Choice sections such as majors and streams start closed. */
export const openSection = async (button: Locator) => {
  if ((await button.getAttribute("aria-expanded")) === "false") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
};
