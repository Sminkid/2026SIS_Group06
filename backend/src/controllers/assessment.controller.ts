import type { RequestHandler } from "express";
import * as assessmentService from "../services/assessment.service.js";
import { ApiError } from "../utils/api-error.js";
import { parseDegreeCode, parseRequiredHandbookYear, parseUniversityCode } from "../utils/request-params.js";

const parseSessionId = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0) throw new ApiError(400, "sessionId is required");
  return value;
};

const parseResponses = (body: unknown): { questionId: string; value: number }[] => {
  const responses = typeof body === "object" && body !== null ? (body as Record<string, unknown>).responses : undefined;
  if (!Array.isArray(responses)) throw new ApiError(400, "responses array is required");
  return responses.map((r) => {
    const entry = r as { questionId?: unknown; value?: unknown };
    if (typeof entry.questionId !== "string" || typeof entry.value !== "number") {
      throw new ApiError(400, "each response requires questionId (string) and value (number)");
    }
    if (entry.value < 1 || entry.value > 5) throw new ApiError(400, "response value must be between 1 and 5");
    return { questionId: entry.questionId, value: entry.value };
  });
};

const parseOptionalMatchTarget = (
  query: Record<string, unknown>,
): { degreeCode?: string; university?: string; year?: number } => {
  if (query.degreeCode === undefined && query.university === undefined && query.year === undefined) return {};
  return {
    degreeCode: parseDegreeCode(query.degreeCode),
    university: parseUniversityCode(query.university),
    year: parseRequiredHandbookYear(query.year),
  };
};

export const startSessionController: RequestHandler = async (_request, response) => {
  response.status(201).json(await assessmentService.startSession());
};

export const submitScreeningResponsesController: RequestHandler = async (request, response) => {
  const sessionId = parseSessionId(request.params.id);
  const responses = parseResponses(request.body);
  response.status(200).json(await assessmentService.submitScreeningResponses(sessionId, responses));
};

export const submitClosingResponsesController: RequestHandler = async (request, response) => {
  const sessionId = parseSessionId(request.params.id);
  const responses = parseResponses(request.body);
  response.status(200).json(await assessmentService.submitClosingResponses(sessionId, responses));
};

export const startDrillDownController: RequestHandler = async (request, response) => {
  const sessionId = parseSessionId(request.params.id);
  response.status(200).json(await assessmentService.startDrillDown(sessionId));
};

export const submitDrillDownResponsesController: RequestHandler = async (request, response) => {
  const sessionId = parseSessionId(request.params.id);
  const responses = parseResponses(request.body);
  const { degreeCode, university, year } = parseOptionalMatchTarget(request.query as Record<string, unknown>);
  response
    .status(200)
    .json(await assessmentService.submitDrillDownResponses(sessionId, responses, degreeCode, university, year));
};

export const getResultController: RequestHandler = async (request, response) => {
  const sessionId = parseSessionId(request.params.id);
  const { degreeCode, university, year } = parseOptionalMatchTarget(request.query as Record<string, unknown>);
  response.status(200).json(await assessmentService.getResult(sessionId, degreeCode, university, year));
};
