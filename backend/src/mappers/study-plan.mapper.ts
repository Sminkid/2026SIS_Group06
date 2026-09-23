import type { DegreeStudyPlansRecord } from "../repositories/study-plan.repository.js";
import type { StudyPlanSummary } from "../types/study-plan.js";

type UniversityRecord = NonNullable<DegreeStudyPlansRecord>;
type HandbookRecord = UniversityRecord["HandbookVersion"][number];
type DegreeRecord = HandbookRecord["Degree"][number];

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

/**
 * CUSP sometimes labels a choice only as "List" while retaining its useful
 * allocation wording in rawText. This improves the label without claiming that
 * any subjects are eligible for the still-unresolved CHOICE item.
 */
export const studyPlanItemTitle = (item: { title: string; itemType: string; rawData: unknown }): string => {
  if (item.itemType !== "CHOICE" || item.title.trim().toLowerCase() !== "list") return item.title;
  const outer = record(item.rawData);
  const rawText = typeof outer?.rawText === "string" ? outer.rawText.trim() : "";
  if (!rawText) return "Elective choice";
  const label = rawText.replace(/^select from\s+/i, "")
    .replace(/(Electives|Units)(?=[A-Z])/g, "$1 or ")
    .replace(/\s+/g, " ")
    .trim();
  return label || "Elective choice";
};

export const mapStudyPlans = (plans: DegreeRecord["StudyPlan"]): StudyPlanSummary[] =>
  plans.map((plan) => ({
    id: plan.id,
    sourcePlanId: plan.sourcePlanId,
    title: plan.title,
    description: plan.description,
    sourceUrl: plan.sourceUrl,
    pathway: plan.pathway,
    sourceType: plan.sourceType,
    handbookYear: plan.handbookYear,
    variantNumber: plan.variantNumber,
    totalCreditPoints: plan.totalCreditPoints,
    years: plan.StudyPlanYear.map((year) => ({
      id: year.id,
      name: year.name,
      sortOrder: year.sortOrder,
      periods: year.StudyPlanPeriod.map((period) => ({
        id: period.id,
        name: period.name,
        sortOrder: period.sortOrder,
        items: period.StudyPlanItem.map((item) => ({
          id: item.id,
          itemType: item.itemType,
          subject: item.Subject,
          rawCode: item.rawCode,
          title: studyPlanItemTitle(item),
          creditPoints: item.creditPoints,
          numberOfPeriods: item.numberOfPeriods,
          sortOrder: item.sortOrder,
        })),
      })),
    })),
  }));
