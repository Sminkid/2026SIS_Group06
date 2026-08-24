export type PrerequisiteStatus = "HAS_CONDITIONS" | "NO_CONDITIONS" | "UNKNOWN";

export interface SubjectSearchResult {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
  prerequisiteStatus: PrerequisiteStatus;
  recommendation: "REQUIREMENT_MATCH" | "UNVERIFIED";
}

export interface SubjectDetailResponse {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
  description: string | null;
  offerings: unknown;
  prerequisiteStatus: PrerequisiteStatus;
  accessConditions: null | {
    hasConditions: boolean;
    groups: Array<{
      id: string;
      groupType: "REQUISITE" | "ANTI_REQUISITE";
      rule: string | null;
      sortOrder: number | null;
      items: Array<{
        id: string;
        itemKey: string;
        requisiteType: string | null;
        details: string;
        referencedSubject: { id: string; code: string; name: string } | null;
        referencedComponent: { id: string; code: string; name: string; type: string } | null;
        referencedDegree: { id: string; code: string; name: string } | null;
        rawReferencedCodes: unknown;
        sortOrder: number | null;
      }>;
    }>;
  };
}

export type SubjectAccessConditionGroup = NonNullable<
  SubjectDetailResponse["accessConditions"]
>["groups"][number];

export interface SubjectAccessConditionsResponse {
  subject: {
    id: string;
    code: string;
    name: string;
  };
  hasConditions: boolean | null;
  requisiteGroups: SubjectAccessConditionGroup[];
  antiRequisiteGroups: SubjectAccessConditionGroup[];
}
