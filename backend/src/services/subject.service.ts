import {
  findSubjectDetailRecord,
  findSubjectSearchRecord,
  findSubjectAccessConditionsBatchRecord,
} from "../repositories/subject.repository.js";
import type {
  PrerequisiteStatus,
  SubjectDetailResponse,
  SubjectAccessConditionGroup,
  SubjectAccessConditionsResponse,
  SubjectSearchResult,
} from "../types/subject.js";
import { ApiError } from "../utils/api-error.js";

/** Preserves UNKNOWN when no access-condition record was imported. */
const prerequisiteStatus = (
  accessCondition: { hasConditions: boolean } | null,
): PrerequisiteStatus => accessCondition === null
  ? "UNKNOWN"
  : accessCondition.hasConditions ? "HAS_CONDITIONS" : "NO_CONDITIONS";

type AccessConditionRecord = NonNullable<
  NonNullable<Awaited<ReturnType<typeof findSubjectDetailRecord>>>["HandbookVersion"][number]["Subject"][number]["SubjectAccessCondition"]
>;

/** Maps imported rule text and references without simplifying enrolment logic. */
const mapAccessGroup = (
  group: AccessConditionRecord["SubjectRequisiteGroup"][number],
): SubjectAccessConditionGroup => ({
  id: group.id,
  groupType: group.groupType,
  rule: group.rule,
  sortOrder: group.sortOrder,
  items: group.SubjectRequisiteItem.map((item) => ({
    id: item.id,
    itemKey: item.itemKey,
    requisiteType: item.requisiteType,
    details: item.details,
    referencedSubject: item.Subject,
    referencedComponent: item.Component,
    referencedDegree: item.Degree,
    rawReferencedCodes: item.rawReferencedCodes,
    sortOrder: item.sortOrder,
  })),
});

/** Resolves a subject in the requested university and handbook, with specific not-found errors. */
const resolveSubjectRecord = async (
  universityCode: string,
  handbookYear: number,
  subjectCode: string,
) => {
  const university = await findSubjectDetailRecord(universityCode, handbookYear, subjectCode);
  if (!university) throw new ApiError(404, `University '${universityCode}' not found`);
  const handbook = university.HandbookVersion[0];
  if (!handbook) throw new ApiError(404, `No ${handbookYear} handbook found for university '${universityCode}'`);
  const subject = handbook.Subject[0];
  if (!subject) throw new ApiError(404, `Subject '${subjectCode}' not found in the ${handbookYear} ${universityCode} handbook`);
  return subject;
};

/** Searches subjects within the requested handbook and optional formal requirement scope. */
export const searchSubjects = async (
  universityCode: string,
  handbookYear: number,
  query: string,
  limit: number,
  componentCode?: string,
  requirementGroupId?: string,
): Promise<SubjectSearchResult[]> => {
  const university = await findSubjectSearchRecord(
    universityCode,
    handbookYear,
    query,
    limit,
    componentCode,
    requirementGroupId,
  );
  if (!university) throw new ApiError(404, `University '${universityCode}' not found`);
  const handbook = university.HandbookVersion[0];
  if (!handbook) throw new ApiError(404, `No ${handbookYear} handbook found for university '${universityCode}'`);
  if (componentCode && handbook.Component.length === 0) {
    throw new ApiError(404, `Component '${componentCode}' not found in the ${handbookYear} ${universityCode} handbook`);
  }
  return handbook.Subject.map((subject) => ({
    id: subject.id,
    code: subject.code,
    name: subject.name,
    creditPoints: subject.creditPoints,
    prerequisiteStatus: prerequisiteStatus(subject.SubjectAccessCondition),
    recommendation: componentCode || requirementGroupId ? "REQUIREMENT_MATCH" : "UNVERIFIED",
  }));
};

/** Returns subject details and the imported source link for handbook verification. */
export const getSubjectDetail = async (
  universityCode: string,
  handbookYear: number,
  subjectCode: string,
): Promise<SubjectDetailResponse> => {
  const subject = await resolveSubjectRecord(universityCode, handbookYear, subjectCode);
  const access = subject.SubjectAccessCondition;
  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    creditPoints: subject.creditPoints,
    description: subject.description,
    offerings: subject.offerings,
    sourceUrl: subject.sourceUrl,
    prerequisiteStatus: prerequisiteStatus(access),
    accessConditions: access
      ? {
          hasConditions: access.hasConditions,
          groups: access.SubjectRequisiteGroup.map(mapAccessGroup),
        }
      : null,
  };
};

/** Returns full access rules, distinguishing absent data from explicitly absent conditions. */
export const getSubjectAccessConditions = async (
  universityCode: string,
  handbookYear: number,
  subjectCode: string,
): Promise<SubjectAccessConditionsResponse> => {
  const subject = await resolveSubjectRecord(universityCode, handbookYear, subjectCode);
  const access = subject.SubjectAccessCondition;
  const groups = access?.SubjectRequisiteGroup.map(mapAccessGroup) ?? [];
  return {
    subject: { id: subject.id, code: subject.code, name: subject.name },
    hasConditions: access?.hasConditions ?? null,
    requisiteGroups: groups.filter((group) => group.groupType === "REQUISITE"),
    antiRequisiteGroups: groups.filter((group) => group.groupType === "ANTI_REQUISITE"),
  };
};

/** Loads access rules for planner subjects while preserving unknown-data status. */
export const getSubjectAccessConditionsBatch = async (
  universityCode: string,
  handbookYear: number,
  subjectCodes: string[],
): Promise<Record<string, SubjectAccessConditionsResponse>> => {
  const university = await findSubjectAccessConditionsBatchRecord(
    universityCode,
    handbookYear,
    subjectCodes,
  );
  if (!university) throw new ApiError(404, `University '${universityCode}' not found`);
  const handbook = university.HandbookVersion[0];
  if (!handbook) throw new ApiError(404, `No ${handbookYear} handbook found for university '${universityCode}'`);

  return Object.fromEntries(handbook.Subject.map((subject) => {
    const access = subject.SubjectAccessCondition;
    const groups = access?.SubjectRequisiteGroup.map(mapAccessGroup) ?? [];
    return [subject.code, {
      subject: { id: subject.id, code: subject.code, name: subject.name },
      hasConditions: access?.hasConditions ?? null,
      requisiteGroups: groups.filter((group) => group.groupType === "REQUISITE"),
      antiRequisiteGroups: groups.filter((group) => group.groupType === "ANTI_REQUISITE"),
    }];
  }));
};
