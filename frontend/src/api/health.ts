import type { HealthResponse } from "../types/health";

const apiUrl = import.meta.env.VITE_API_URL ?? "";

export const fetchHealth = async (signal?: AbortSignal): Promise<HealthResponse> => {
  const response = await fetch(`${apiUrl}/api/health`, { signal });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
};

