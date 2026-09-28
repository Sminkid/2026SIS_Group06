import { navigationUi } from "./navigation";
import { commonUi } from "./common";
import { requirementsUi } from "./requirements";
import { glossaryUi } from "./glossary";
import { studyPathUi } from "./studyPath";
import { studyPlanUi } from "./studyPlan";
import { subjectChoiceUi } from "./subjectChoice";
import { feeComparisonUi } from "./feeComparison";
export { cn } from "./cn";

/** Named, statically discoverable recipes shared by the existing frontend views. */
export const appUi = {
  ...navigationUi,
  ...commonUi,
  ...requirementsUi,
  ...glossaryUi,
  ...studyPathUi,
  ...studyPlanUi,
  ...subjectChoiceUi,
  ...feeComparisonUi,
} as const;
