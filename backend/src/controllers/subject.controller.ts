import type { RequestHandler } from "express";
import { getSubjectAccessConditions, getSubjectAccessConditionsBatch, getSubjectDetail, searchSubjects } from "../services/subject.service.js";
import {
  parseComponentCode,
  parseRequiredHandbookYear,
  parseRequirementGroupId,
  parseSearchLimit,
  parseSubjectCode,
  parseSubjectSearchQuery,
  parseUniversityCode,
} from "../utils/request-params.js";

export const subjectSearchController: RequestHandler = async (request, response) => {
  const universityCode = parseUniversityCode(request.query.university);
  const year = parseRequiredHandbookYear(request.query.year);
  const componentCode = request.query.component === undefined
    ? undefined
    : parseComponentCode(request.query.component);
  const requirementGroupId = request.query.requirementGroup === undefined
    ? undefined
    : parseRequirementGroupId(request.query.requirementGroup);
  const query = parseSubjectSearchQuery(request.query.q, componentCode !== undefined || requirementGroupId !== undefined);
  const limit = parseSearchLimit(request.query.limit);
  response.status(200).json(await searchSubjects(universityCode, year, query, limit, componentCode, requirementGroupId));
};

export const subjectDetailController: RequestHandler = async (request, response) => {
  const universityCode = parseUniversityCode(request.query.university);
  const year = parseRequiredHandbookYear(request.query.year);
  const subjectCode = parseSubjectCode(request.params.subjectCode);
  response.status(200).json(await getSubjectDetail(universityCode, year, subjectCode));
};

export const subjectAccessConditionsController: RequestHandler = async (request, response) => {
  const universityCode = parseUniversityCode(request.query.university);
  const year = parseRequiredHandbookYear(request.query.year);
  const subjectCode = parseSubjectCode(request.params.subjectCode);
  response.status(200).json(await getSubjectAccessConditions(universityCode, year, subjectCode));
};

export const subjectAccessConditionsBatchController: RequestHandler = async (request, response) => {
  const universityCode = parseUniversityCode(request.query.university);
  const year = parseRequiredHandbookYear(request.query.year);
  const body = request.body as { subjectCodes?: unknown } | undefined;
  if (!Array.isArray(body?.subjectCodes) || body.subjectCodes.length < 1 || body.subjectCodes.length > 500) {
    response.status(400).json({ error: "subjectCodes must contain between 1 and 500 subject codes" });
    return;
  }
  const subjectCodes = [...new Set(body.subjectCodes.map(parseSubjectCode))];
  response.status(200).json(await getSubjectAccessConditionsBatch(universityCode, year, subjectCodes));
};
