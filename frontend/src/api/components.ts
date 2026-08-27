import type { ComponentDetailResponse } from "../types/handbook";
import { apiGet } from "./client";

export const fetchComponentDetail = (
  componentIdentifier: string,
  universityCode: string,
  year: number,
  signal?: AbortSignal,
): Promise<ComponentDetailResponse> => {
  const params = new URLSearchParams({ university: universityCode, year: String(year) });
  return apiGet(`/api/components/${encodeURIComponent(componentIdentifier)}?${params}`, signal);
};
