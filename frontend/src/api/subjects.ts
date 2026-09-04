import type { SubjectAccessConditions, SubjectDetail, SubjectSearchResult } from "../types/subject";
import { apiGet, apiPost } from "./client";

interface SubjectSearchOptions {
  universityCode: string;
  handbookYear: number;
  query?: string;
  componentCode?: string;
  requirementGroupId?: string;
  limit?: number;
  signal?: AbortSignal;
}

export const searchSubjects = ({
  universityCode,
  handbookYear,
  query,
  componentCode,
  requirementGroupId,
  limit = 20,
  signal,
}: SubjectSearchOptions): Promise<SubjectSearchResult[]> => {
  const params = new URLSearchParams({
    university: universityCode,
    year: String(handbookYear),
    limit: String(limit),
  });
  if (query) params.set("q", query);
  if (componentCode) params.set("component", componentCode);
  if (requirementGroupId) params.set("requirementGroup", requirementGroupId);
  return apiGet(`/api/subjects/search?${params}`, signal);
};

export const fetchSubjectDetail = (
  subjectCode: string,
  universityCode: string,
  handbookYear: number,
  signal?: AbortSignal,
): Promise<SubjectDetail> => {
  const params = new URLSearchParams({
    university: universityCode,
    year: String(handbookYear),
  });
  return apiGet(`/api/subjects/${encodeURIComponent(subjectCode)}?${params}`, signal);
};

export const fetchSubjectAccessConditions = (
  subjectCode: string,
  universityCode: string,
  handbookYear: number,
  signal?: AbortSignal,
): Promise<SubjectAccessConditions> => {
  const params = new URLSearchParams({
    university: universityCode,
    year: String(handbookYear),
  });
  return apiGet(
    `/api/subjects/${encodeURIComponent(subjectCode)}/access-conditions?${params}`,
    signal,
  );
};

export const fetchSubjectAccessConditionsBatch = (
  subjectCodes: string[],
  universityCode: string,
  handbookYear: number,
  signal?: AbortSignal,
): Promise<Record<string, SubjectAccessConditions>> => {
  const params = new URLSearchParams({
    university: universityCode,
    year: String(handbookYear),
  });
  return apiPost(
    `/api/subjects/access-conditions/batch?${params}`,
    { subjectCodes },
    signal,
  );
};
