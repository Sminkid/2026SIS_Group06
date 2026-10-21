import { appUi } from "./ui";

/** Whether a degree's study plan is one of the completed ones; only Engineering plans are finished so far. */
export const hasCompleteStudyPlan = (degreeName: string) => /engineering/i.test(degreeName);

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

/**
 * Amber reminder that only Engineering study plans are complete. Shown wherever users browse or compare degrees;
 * on a degree page, pass `degreeName` to show it only for degrees whose study plan is still being built.
 */
export const StudyPlanCoverageNotice = ({ degreeName, comparing = false }: {
  degreeName?: string;
  /** On the comparison page: the notice is about the study plans behind "View Study Plan". */
  comparing?: boolean;
}) => {
  if (degreeName && hasCompleteStudyPlan(degreeName)) return null;
  if (comparing) return (
    <div className={appUi.coverageNotice} role="note">
      <WarningIcon />
      <div>
        <strong>Study plans for this course are still under development</strong>
        <p>Only the study plans for Engineering degrees are complete so far. The study plans behind &ldquo;View Study Plan&rdquo; may be incomplete, so check them against the official handbook.</p>
      </div>
    </div>
  );
  return (
    <div className={appUi.coverageNotice} role="note">
      <WarningIcon />
      <div>
        <strong>{degreeName ? "This study plan is still under development" : "Study plans are still being built"}</strong>
        <p>{degreeName
          ? "This degree's study plan may be incomplete, so check it against the official handbook before relying on it."
          : "So far, only the study plans for Engineering degrees are complete. Study plans for other degrees are still under development and may be incomplete."}</p>
      </div>
    </div>
  );
};
