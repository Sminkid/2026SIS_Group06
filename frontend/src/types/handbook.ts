export interface University { id: string; code: string; name: string; }
export interface HandbookSummary { id: string; universityCode: string; year: number; sourceUrl: string | null; }
export interface DegreeSummary { id: string; code: string; name: string; creditPoints: number | null; handbookYear: number; }
export type RequirementLogic = "ALL" | "ANY" | "ONE_OF" | "UNKNOWN";
export type RequirementItemType = "SUBJECT" | "COMPONENT" | "OTHER";

export interface RequirementSubject { id: string; code: string; name: string; creditPoints: number | null; }
export interface RequirementComponent { id: string; code: string; name: string; type: string; creditPoints: number | null; }
export interface RequirementItem {
  id: string;
  itemType: RequirementItemType;
  subject: RequirementSubject | null;
  component: RequirementComponent | null;
  rawCode: string | null;
  rawName: string | null;
  creditPoints: number | null;
  sortOrder: number | null;
}
export interface RequirementGroup {
  id: string;
  title: string | null;
  description: string | null;
  logic: RequirementLogic;
  requiredCreditPoints: number | null;
  maximumCreditPoints: number | null;
  sortOrder: number | null;
  items: RequirementItem[];
  children: RequirementGroup[];
}
export interface DegreeDetailResponse {
  degree: {
    id: string;
    code: string;
    name: string;
    creditPoints: number | null;
    handbookYear: number;
    university: University;
    description: string | null;
  };
  requirements: RequirementGroup[];
}

export interface ComponentDetailResponse {
  component: {
    id: string;
    code: string;
    name: string;
    type: string;
    originalType: string | null;
    creditPoints: number | null;
    handbookYear: number;
    university: University;
  };
  requirements: RequirementGroup[];
}

export interface StudyPlanItem {
  id: string;
  itemType: "SUBJECT" | "CHOICE";
  subject: RequirementSubject | null;
  rawCode: string | null;
  title: string;
  creditPoints: number | null;
  numberOfPeriods: number | null;
  sortOrder: number | null;
}
export interface StudyPlanPeriod { id: string; name: string; sortOrder: number | null; items: StudyPlanItem[]; }
export interface StudyPlanYear { id: string; name: string; sortOrder: number | null; periods: StudyPlanPeriod[]; }
export interface StudyPlan { id: string; title: string; description: string | null; sourceUrl: string | null; years: StudyPlanYear[]; }
