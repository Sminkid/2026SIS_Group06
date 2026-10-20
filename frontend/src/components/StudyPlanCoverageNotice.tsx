import { appUi } from "./ui";

/** Reminds users browsing degrees that only Engineering study plans are complete so far. */
export const StudyPlanCoverageNotice = () => (
  <p className={appUi.coverageNotice} role="note">
    <strong>Study plans are still being built.</strong>{" "}
    So far, only the study plans for Engineering degrees are complete. Study plans for others are still under development.
  </p>
);
