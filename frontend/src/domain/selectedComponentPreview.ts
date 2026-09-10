import type { ComponentDetailResponse } from "../types/handbook";

export type SelectedComponentPreviewStatus = "idle" | "loading" | "ready" | "error";

export const selectedComponentPreview = (
  componentCode: string,
  details: Record<string, ComponentDetailResponse>,
  status: SelectedComponentPreviewStatus,
) => {
  const detail = details[componentCode];
  if (detail) return { state: "ready" as const, detail };
  if (status === "error") return { state: "error" as const, detail: null };
  if (status === "ready") return { state: "empty" as const, detail: null };
  return { state: "loading" as const, detail: null };
};
