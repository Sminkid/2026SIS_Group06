import type { DegreeStudyPlansRecord } from "../repositories/study-plan.repository.js";
import type { StudyPlanSummary } from "../types/study-plan.js";

type UniversityRecord = NonNullable<DegreeStudyPlansRecord>;
type HandbookRecord = UniversityRecord["HandbookVersion"][number];
type DegreeRecord = HandbookRecord["Degree"][number];

export const mapStudyPlans = (plans: DegreeRecord["StudyPlan"]): StudyPlanSummary[] =>
  plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    description: plan.description,
    sourceUrl: plan.sourceUrl,
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
          title: item.title,
          creditPoints: item.creditPoints,
          numberOfPeriods: item.numberOfPeriods,
          sortOrder: item.sortOrder,
        })),
      })),
    })),
  }));
