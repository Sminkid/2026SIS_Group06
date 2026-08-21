import type { DegreeSummary, HandbookSummary, University } from "../types/handbook";
import { apiGet } from "./client";

export const fetchUniversities = (signal?: AbortSignal): Promise<University[]> => apiGet("/api/universities", signal);
export const fetchLatestHandbook = (universityCode: string, signal?: AbortSignal): Promise<HandbookSummary> =>
  apiGet(`/api/universities/${encodeURIComponent(universityCode)}/handbooks/latest`, signal);
export const fetchDegrees = (universityCode: string, year: number, signal?: AbortSignal): Promise<DegreeSummary[]> => {
  const params = new URLSearchParams({ year: String(year) });
  return apiGet(`/api/universities/${encodeURIComponent(universityCode)}/degrees?${params}`, signal);
};
