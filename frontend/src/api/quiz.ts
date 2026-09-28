import type { AssessmentResult, QuestionRef, QuestionResponse, RiasecLabels } from "../types/quiz";
import { apiGet, apiPost } from "./client";

export interface DegreeMatchTarget {
  degreeCode: string;
  university: string;
  year: number;
}

const matchQuery = (target?: DegreeMatchTarget) =>
  target
    ? `?${new URLSearchParams({ degreeCode: target.degreeCode, university: target.university, year: String(target.year) })}`
    : "";

export const fetchRiasecLabels = (signal?: AbortSignal): Promise<RiasecLabels> =>
  apiGet("/api/assessment/riasec-labels", signal);

export const startAssessmentSession = (
  signal?: AbortSignal,
): Promise<{ sessionId: string; questions: QuestionRef[] }> => apiPost("/api/assessment/sessions", {}, signal);

export const submitScreeningResponses = (
  sessionId: string,
  responses: QuestionResponse[],
  signal?: AbortSignal,
): Promise<{ rankedCategoryIds: string[]; closingQuestions: QuestionRef[] }> =>
  apiPost(`/api/assessment/sessions/${encodeURIComponent(sessionId)}/screening-responses`, { responses }, signal);

export const submitClosingResponses = (
  sessionId: string,
  responses: QuestionResponse[],
  signal?: AbortSignal,
): Promise<{ ok: true }> =>
  apiPost(`/api/assessment/sessions/${encodeURIComponent(sessionId)}/closing-responses`, { responses }, signal);

export const startDrillDown = (
  sessionId: string,
  signal?: AbortSignal,
): Promise<{ questions: QuestionRef[] }> =>
  apiPost(`/api/assessment/sessions/${encodeURIComponent(sessionId)}/drill-down`, {}, signal);

export const submitDrillDownResponses = (
  sessionId: string,
  responses: QuestionResponse[],
  target?: DegreeMatchTarget,
  signal?: AbortSignal,
): Promise<AssessmentResult> =>
  apiPost(
    `/api/assessment/sessions/${encodeURIComponent(sessionId)}/drill-down-responses${matchQuery(target)}`,
    { responses },
    signal,
  );

export const fetchAssessmentResult = (
  sessionId: string,
  target?: DegreeMatchTarget,
  signal?: AbortSignal,
): Promise<AssessmentResult> =>
  apiGet(`/api/assessment/sessions/${encodeURIComponent(sessionId)}/result${matchQuery(target)}`, signal);
