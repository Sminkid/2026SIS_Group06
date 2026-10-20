/** Everything the degree page keeps in this browser: course structure choices, study plan drafts and planner preferences. */
const DEGREE_PROGRESS_PREFIXES = ["planner:", "degree-planner:", "usyd:study-path:", "usyd:dalyell:"];

/** The degree page starts fresh each visit, so its saved progress is cleared when the user leaves or refreshes it. */
export const clearDegreeProgress = (): void => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (DEGREE_PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (e.g. private mode); there is nothing saved to clear then.
  }
};
