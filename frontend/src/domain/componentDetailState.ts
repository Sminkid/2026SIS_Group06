import type { ComponentDetailResponse } from "../types/handbook";

export type ComponentDetailStatus = "idle" | "loading" | "ready" | "error";
export type ComponentDetailView = "loading" | "failure" | "success-empty" | "success-with-groups";

const hasVerifiedSubjects = (detail: ComponentDetailResponse): boolean => {
  const visit = (groups: ComponentDetailResponse["requirements"]): boolean => groups.some((group) =>
    group.items.some((item) => item.subject !== null) || visit(group.children));
  return visit(detail.requirements);
};

export const componentCreditLabel = (detail: ComponentDetailResponse): string | null =>
  detail.component.creditPoints === null ? null : `${detail.component.creditPoints} CP`;

export const componentDetailView = (
  status: ComponentDetailStatus,
  detail: ComponentDetailResponse | null,
): ComponentDetailView => {
  if (status === "error") return "failure";
  if (status !== "ready" || !detail) return "loading";
  return hasVerifiedSubjects(detail)
    ? "success-with-groups"
    : "success-empty";
};

export const createLatestRequestGate = () => {
  let latest = 0;
  return {
    begin: () => ++latest,
    isLatest: (request: number) => request === latest,
    invalidate: () => { latest += 1; },
  };
};
