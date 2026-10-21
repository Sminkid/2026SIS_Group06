import { appUi } from "../ui";

/** Shows whether the study plan below is the read-only official roadmap or the user's editable copy. */
export const PlanModeBadge = ({ editable }: { editable: boolean }) => (
  <span className={editable ? appUi.planModeEditing : appUi.planModeReadOnly} role="status">
    {editable
      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
    {editable ? "Editing · your plan" : "Read-only · official roadmap"}
  </span>
);
