export type PrerequisiteStatus = "HAS_CONDITIONS" | "NO_CONDITIONS" | "UNKNOWN";

export interface SubjectSearchResult {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
  prerequisiteStatus: PrerequisiteStatus;
  recommendation: "REQUIREMENT_MATCH" | "UNVERIFIED";
}

export interface SubjectDetail {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
  prerequisiteStatus: PrerequisiteStatus;
  description: string | null;
  offerings: unknown;
  sourceUrl?: string | null;
  accessConditions: null | {
    hasConditions: boolean;
    groups: SubjectAccessConditionGroup[];
  };
}

export interface SubjectAccessConditionItem {
  id: string;
  itemKey: string;
  requisiteType: string | null;
  details: string;
  referencedSubject: { id: string; code: string; name: string } | null;
  referencedComponent: { id: string; code: string; name: string; type: string } | null;
  referencedDegree: { id: string; code: string; name: string } | null;
  rawReferencedCodes: unknown;
  sortOrder: number | null;
}

export interface SubjectAccessConditionGroup {
  id: string;
  groupType: "REQUISITE" | "ANTI_REQUISITE" | "PREREQUISITE" | "COREQUISITE" | "PROHIBITION";
  rule: string | null;
  sortOrder: number | null;
  items: SubjectAccessConditionItem[];
}

export interface SubjectAccessConditions {
  subject: { id: string; code: string; name: string };
  hasConditions: boolean | null;
  requisiteGroups: SubjectAccessConditionGroup[];
  antiRequisiteGroups: SubjectAccessConditionGroup[];
}
