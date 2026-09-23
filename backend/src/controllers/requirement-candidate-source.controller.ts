import type { RequestHandler } from "express";
import { getRequirementCandidateSubjects } from "../services/requirement-candidate-source.service.js";
import {
  parseCandidateSourceId,
  parsePage,
  parseSearchLimit,
  parseSubjectSearchQuery,
} from "../utils/request-params.js";

export const requirementCandidateSubjectsController: RequestHandler = async (request, response) => {
  const sourceId = parseCandidateSourceId(request.params.sourceId);
  const query = parseSubjectSearchQuery(request.query.q, true);
  const page = parsePage(request.query.page);
  const limit = parseSearchLimit(request.query.limit);
  response.status(200).json(await getRequirementCandidateSubjects(sourceId, query, page, limit));
};
