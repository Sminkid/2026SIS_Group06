export interface University { id: string; code: string; name: string; }
export interface HandbookSummary { id: string; universityCode: string; year: number; sourceUrl: string | null; }
export interface DegreeSummary { id: string; code: string; name: string; creditPoints: number | null; handbookYear: number; }
export type RequirementLogic = "ALL" | "ANY" | "ONE_OF" | "UNKNOWN";
export type RequirementItemType = "SUBJECT" | "COMPONENT" | "TABLE" | "RAW" | "OTHER";

export interface RequirementSubject { id: string; code: string; name: string; creditPoints: number | null; }
export type RequirementCandidateSourceType = "SUBJECT_FILTER" | "TABLE_SUBJECT_POOL";
export interface RequirementCandidateSourceSummary {
  id: string;
  sourceKey: string;
  type: RequirementCandidateSourceType;
  title: string;
  authoritative: boolean;
  tableName: string | null;
  candidateCount: number;
}
export interface RequirementComponent {
  id: string;
  code: string;
  displayCode: string | null;
  name: string;
  type: string;
  creditPoints: number | null;
  creditPointsAvailability: "EXPLICIT_RELATIONSHIP" | "EXPLICIT_COMPONENT" | "DERIVED_REQUIREMENTS" | "UNAVAILABLE";
}
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
  candidateSources: RequirementCandidateSourceSummary[];
  children: RequirementGroup[];
  pathways: Array<{
    id: string;
    title: string;
    requiredCreditPoints: number;
    selections: Array<{
      requirementGroupId: string;
      selectionType: "COMPONENT" | "ELECTIVE_ALLOCATION";
      requiredSelections: number;
      requiredCreditPoints: number;
    }>;
  }>;
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
  completionSummary: StudentRequirementSummary[];
}

export interface RequirementCandidateSubjectsResponse {
  candidateSource: RequirementCandidateSourceSummary;
  subjects: RequirementSubject[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type RequirementObligation = "REQUIRED" | "OPTIONAL" | "CONDITIONAL" | "INFORMATIONAL";
export interface StudentRequirementSummary {
  id: string;
  title: string;
  explanation: string | null;
  obligation: RequirementObligation;
  minimumCreditPoints: number | null;
  maximumCreditPoints: number | null;
  conditionLabel: string | null;
  actionKind: "NONE" | "CHOOSE_COMPONENT" | "CHOOSE_SUBJECTS" | "CONFIRM_CONDITION";
  sourceText: string | null;
  sourceUrl: string | null;
  requirementGroupId: string;
}

export interface ComponentDetailResponse {
  component: {
    id: string;
    code: string;
    name: string;
    type: string;
    originalType: string | null;
    creditPoints: number | null;
    sourceUrl: string | null;
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
  choiceOrigin?: {
    officialChoiceItemId: string;
    title: string;
    rawCode: string | null;
    creditPoints: number | null;
    originalPeriodId: string;
    formalComponentCode?: string;
    formalComponentId?: string;
    formalRequirementGroupId?: string;
    componentRequirementKind?: "FIXED" | "SELECTIVE" | "COMPONENT";
    allocatedGroupLabel?: string;
    parentAggregateItemId?: string;
    parentAggregateTitle?: string;
    parentAggregateCreditPoints?: number;
    selectedPathwayId?: string;
    degreeRequirementGroupId?: string;
    candidateSourceType?: "FORMAL" | "BROAD" | "UNRESOLVED";
    maximumCreditPoints?: number;
    sourceLabel?: string;
  };
}
export interface StudyPlanPeriod { id: string; name: string; sortOrder: number | null; items: StudyPlanItem[]; }
export interface StudyPlanYear { id: string; name: string; sortOrder: number | null; periods: StudyPlanPeriod[]; }
export interface StudyPlan {
  id: string; title: string; description: string | null; sourceUrl: string | null; years: StudyPlanYear[];
  sourcePlanId?: string | null;
  pathway?: string | null;
  sourceType?: string | null;
  handbookYear?: number | null;
  variantNumber?: number | null;
  totalCreditPoints?: number | null;
  major?: { id: string; code: string; name: string } | null;
  relationshipBasis?: "SOURCE_TITLE_AND_SUBJECT_IDS" | null;
  commencement?: string | null;
  attendance?: string | null;
}
