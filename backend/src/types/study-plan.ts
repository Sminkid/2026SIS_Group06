import type { StudyPlanItemType } from "../generated/prisma/enums.js";

export interface StudyPlanItemSummary {
  id: string;
  itemType: StudyPlanItemType;
  subject: { id: string; code: string; name: string; creditPoints: number | null } | null;
  rawCode: string | null;
  title: string;
  creditPoints: number | null;
  numberOfPeriods: number | null;
  sortOrder: number | null;
}

export interface StudyPlanPeriodSummary {
  id: string;
  name: string;
  sortOrder: number | null;
  items: StudyPlanItemSummary[];
}

export interface StudyPlanYearSummary {
  id: string;
  name: string;
  sortOrder: number | null;
  periods: StudyPlanPeriodSummary[];
}

export interface StudyPlanSummary {
  major?: { id: string; code: string; name: string } | null;
  relationshipBasis?: "SOURCE_TITLE_AND_SUBJECT_IDS" | null;
  commencement?: string | null;
  attendance?: string | null;
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  years: StudyPlanYearSummary[];
}
