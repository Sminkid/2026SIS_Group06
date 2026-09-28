import type { RequirementCandidateSubjectsResponse } from "../types/handbook";
import { apiGet } from "./client";

interface CandidateSubjectOptions {
  sourceId: string;
  query?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export const fetchRequirementCandidateSubjects = ({ sourceId, query, page = 1, limit = 20,
  signal }: CandidateSubjectOptions): Promise<RequirementCandidateSubjectsResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (query) params.set("q", query);
  return apiGet(`/api/requirement-candidate-sources/${encodeURIComponent(sourceId)}/subjects?${params}`, signal);
};
