import type { DegreeDetailResponse, StudyPlan } from "../types/handbook";
import { apiGet } from "./client";

export const fetchDegreeDetail = (degreeCode: string, universityCode: string, year: number, signal?: AbortSignal): Promise<DegreeDetailResponse> => {
  const params = new URLSearchParams({ university: universityCode, year: String(year) });
  return apiGet(`/api/degrees/${encodeURIComponent(degreeCode)}?${params}`, signal);
};

export const fetchDegreeStudyPlans = (
  degreeCode: string,
  universityCode: string,
  year: number,
  signal?: AbortSignal,
): Promise<StudyPlan[]> => {
  const params = new URLSearchParams({ university: universityCode, year: String(year) });
  return apiGet(`/api/degrees/${encodeURIComponent(degreeCode)}/study-plans?${params}`, signal);
};
