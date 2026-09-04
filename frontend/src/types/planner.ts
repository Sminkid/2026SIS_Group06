import type { StudyPlan } from "./handbook";

export interface PlannerContext {
  universityCode: string;
  handbookYear: number;
  degreeCode: string;
  selectedComponentCodes: string[];
  activePathwayRequirementGroupIds: string[];
  knownPathwayRequirementGroupIds: string[];
}

export interface PlannerItem {
  plannerItemId: string;
  officialItemId: string;
  originalPeriodId: string;
  itemType: "SUBJECT" | "CHOICE";
  subject: {
    officialSubjectId: string;
    code: string;
    name: string;
    creditPoints: number | null;
  } | null;
  rawCode: string | null;
  title: string;
  creditPoints: number | null;
  numberOfPeriods: number | null;
  choiceOrigin: {
    officialChoiceItemId: string;
    title: string;
    rawCode: string | null;
    creditPoints: number | null;
    originalPeriodId: string;
    formalComponentCode?: string;
    formalComponentId?: string;
    formalRequirementGroupId?: string;
    componentRequirementKind?: "FIXED" | "SELECTIVE";
  } | null;
  officialSortOrder: number | null;
}

export interface PlannerPeriod {
  plannerPeriodId: string;
  officialPeriodId: string;
  name: string;
  officialSortOrder: number | null;
  items: PlannerItem[];
}

export interface PlannerYear {
  plannerYearId: string;
  officialYearId: string;
  name: string;
  officialSortOrder: number | null;
  periods: PlannerPeriod[];
}

export interface PlannerState {
  schemaVersion: 3;
  context: PlannerContext;
  sourcePlanId: string;
  sourcePlanTitle: string;
  createdAt: string;
  updatedAt: string;
  years: PlannerYear[];
  unassignedItems: PlannerItem[];
}

export const cloneOfficialPlan = (
  plan: StudyPlan,
  context: PlannerContext,
): PlannerState => {
  const timestamp = new Date().toISOString();

  return {
    schemaVersion: 3,
    context: {
      ...context,
      selectedComponentCodes: [...context.selectedComponentCodes],
    },
    sourcePlanId: plan.id,
    sourcePlanTitle: plan.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    years: plan.years.map((year) => ({
      plannerYearId: `official:${year.id}`,
      officialYearId: year.id,
      name: year.name,
      officialSortOrder: year.sortOrder,
      periods: year.periods.map((period) => ({
        plannerPeriodId: `official:${period.id}`,
        officialPeriodId: period.id,
        name: period.name,
        officialSortOrder: period.sortOrder,
        items: period.items.map((item) => ({
          plannerItemId: `official:${item.id}`,
          officialItemId: item.id,
          originalPeriodId: period.id,
          itemType: item.itemType,
          subject: item.subject
            ? {
                officialSubjectId: item.subject.id,
                code: item.subject.code,
                name: item.subject.name,
                creditPoints: item.subject.creditPoints,
              }
            : null,
          rawCode: item.rawCode,
          title: item.title,
          creditPoints: item.creditPoints,
          numberOfPeriods: item.numberOfPeriods,
          choiceOrigin: item.itemType === "CHOICE"
            ? {
                officialChoiceItemId: item.id,
                title: item.title,
                rawCode: item.rawCode,
                creditPoints: item.creditPoints,
                originalPeriodId: period.id,
              }
            : null,
          officialSortOrder: item.sortOrder,
        })),
      })),
    })),
    unassignedItems: [],
  };
};

export const plannerToStudyPlan = (
  planner: PlannerState,
  officialPlan: StudyPlan,
): StudyPlan => ({
  ...officialPlan,
  years: planner.years.map((year, yearIndex) => ({
    id: year.plannerYearId,
    name: year.name,
    sortOrder: yearIndex,
    periods: year.periods.map((period, periodIndex) => ({
      id: period.plannerPeriodId,
      name: period.name,
      sortOrder: periodIndex,
      items: period.items.map((item, itemIndex) => ({
        id: item.plannerItemId,
        itemType: item.itemType,
        subject: item.subject
          ? {
              id: item.subject.officialSubjectId,
              code: item.subject.code,
              name: item.subject.name,
              creditPoints: item.subject.creditPoints,
            }
          : null,
        rawCode: item.rawCode,
        title: item.title,
        creditPoints: item.creditPoints,
        numberOfPeriods: item.numberOfPeriods,
        sortOrder: itemIndex,
        ...(item.choiceOrigin ? { choiceOrigin: item.choiceOrigin } : {}),
      })),
    })),
  })),
});

export const plannerItemToStudyPlanItem = (
  item: PlannerItem,
  sortOrder: number | null = null,
): StudyPlan["years"][number]["periods"][number]["items"][number] => ({
  id: item.plannerItemId,
  itemType: item.itemType,
  subject: item.subject
    ? {
        id: item.subject.officialSubjectId,
        code: item.subject.code,
        name: item.subject.name,
        creditPoints: item.subject.creditPoints,
      }
    : null,
  rawCode: item.rawCode,
  title: item.title,
  creditPoints: item.creditPoints,
  numberOfPeriods: item.numberOfPeriods,
  sortOrder,
  ...(item.choiceOrigin ? { choiceOrigin: item.choiceOrigin } : {}),
});
