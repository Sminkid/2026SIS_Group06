import { findRequirementCandidateSubjects } from "../repositories/requirement-candidate-source.repository.js";
import type { RequirementCandidateSubjectsResponse } from "../types/requirement-candidate-source.js";
import { ApiError } from "../utils/api-error.js";

export const getRequirementCandidateSubjects = async (
  sourceId: string,
  query: string,
  page: number,
  limit: number,
): Promise<RequirementCandidateSubjectsResponse> => {
  const record = await findRequirementCandidateSubjects(sourceId, query, page, limit);
  if (!record) throw new ApiError(404, `Requirement candidate source '${sourceId}' not found`);

  return {
    candidateSource: {
      id: record.source.id,
      sourceKey: record.source.sourceKey,
      type: record.source.type,
      title: record.source.title,
      authoritative: record.source.authoritative,
      tableName: record.source.tableName,
      candidateCount: record.source._count.RequirementCandidateSubject,
    },
    subjects: record.memberships.map((membership) => membership.Subject),
    pagination: {
      page,
      limit,
      total: record.total,
      totalPages: Math.ceil(record.total / limit),
    },
  };
};
