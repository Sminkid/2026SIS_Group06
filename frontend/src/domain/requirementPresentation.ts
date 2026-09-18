import type { RequirementGroup, RequirementItem } from "../types/handbook";

/** Contextual requirement CP takes precedence without mutating canonical subject data. */
export const requirementItemCreditPoints = (item: RequirementItem): number | null =>
  item.creditPoints ?? item.subject?.creditPoints ?? null;

/** UNKNOWN has no badge because the persisted data does not claim formal logic. */
export const requirementLogicLabel = (logic: RequirementGroup["logic"]): string | null =>
  logic === "UNKNOWN"
    ? null
    : logic === "ONE_OF"
      ? "Choose one"
      : logic === "ANY"
        ? "Choose from options"
        : logic.replace("_", " ");
