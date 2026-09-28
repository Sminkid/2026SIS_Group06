import type { RequirementCandidateSourceSummary, RequirementSubjectSummary } from "./degree.js";

export interface RequirementCandidateSubjectsResponse {
  candidateSource: RequirementCandidateSourceSummary;
  subjects: RequirementSubjectSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
