import type {
  ComponentType,
  RequirementCandidateSourceType,
  RequirementItemType,
  RequirementLogic,
} from "../generated/prisma/enums.js";

export interface DegreeDetail {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
  handbookYear: number;
  university: {
    id: string;
    code: string;
    name: string;
  };
  description: string | null;
}

export interface RequirementSubjectSummary {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
}

export interface RequirementComponentSummary {
  id: string;
  code: string;
  name: string;
  type: ComponentType;
  creditPoints: number | null;
  creditPointsAvailability: "EXPLICIT_RELATIONSHIP" | "EXPLICIT_COMPONENT" | "DERIVED_REQUIREMENTS" | "UNAVAILABLE";
  displayCode: string | null;
}

export interface DegreeRequirementPathwaySelection {
  requirementGroupId: string;
  selectionType: "COMPONENT" | "ELECTIVE_ALLOCATION";
  requiredSelections: number;
  requiredCreditPoints: number;
}

export interface DegreeRequirementPathway {
  id: string;
  title: string;
  requiredCreditPoints: number;
  selections: DegreeRequirementPathwaySelection[];
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

export interface DegreeRequirementItem {
  id: string;
  itemType: RequirementItemType;
  subject: RequirementSubjectSummary | null;
  component: RequirementComponentSummary | null;
  rawCode: string | null;
  rawName: string | null;
  creditPoints: number | null;
  sortOrder: number | null;
}

export interface RequirementCandidateSourceSummary {
  id: string;
  sourceKey: string;
  type: RequirementCandidateSourceType;
  title: string;
  authoritative: boolean;
  tableName: string | null;
  candidateCount: number;
}

export interface DegreeRequirementGroup {
  id: string;
  title: string | null;
  description: string | null;
  logic: RequirementLogic;
  requiredCreditPoints: number | null;
  maximumCreditPoints: number | null;
  sortOrder: number | null;
  items: DegreeRequirementItem[];
  candidateSources: RequirementCandidateSourceSummary[];
  children: DegreeRequirementGroup[];
  pathways: DegreeRequirementPathway[];
}

export interface DegreeDetailResponse {
  degree: DegreeDetail;
  requirements: DegreeRequirementGroup[];
  completionSummary: StudentRequirementSummary[];
}
