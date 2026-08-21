import type {
  ComponentType,
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

export interface DegreeRequirementGroup {
  id: string;
  title: string | null;
  description: string | null;
  logic: RequirementLogic;
  requiredCreditPoints: number | null;
  maximumCreditPoints: number | null;
  sortOrder: number | null;
  items: DegreeRequirementItem[];
  children: DegreeRequirementGroup[];
}

export interface DegreeDetailResponse {
  degree: DegreeDetail;
  requirements: DegreeRequirementGroup[];
}
