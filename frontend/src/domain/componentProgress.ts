import type { ComponentDetailResponse, RequirementGroup, RequirementSubject } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import type { ComponentSelections } from "../hooks/useComponentSelections";

export interface ComponentProgress {
  componentCode: string;
  name: string;
  type: string;
  plannedCreditPoints: number;
  requiredCreditPoints: number | null;
  maximumCreditPoints: number | null;
  status: "UNDER" | "EXACT" | "OVER" | "UNKNOWN";
}

const collectSubjects = (groups: RequirementGroup[], subjects = new Map<string, RequirementSubject>()) => {
  for (const group of groups) {
    for (const item of group.items) if (item.subject) subjects.set(item.subject.code, item.subject);
    collectSubjects(group.children, subjects);
  }
  return subjects;
};

export const calculateComponentProgress = (
  planner: PlannerState | null,
  componentDetails: Record<string, ComponentDetailResponse>,
  degreeRequirements: RequirementGroup[],
  selections: ComponentSelections,
): ComponentProgress[] => {
  if (!planner) return [];
  const planned = new Map<string, number>();
  for (const item of [
    ...planner.years.flatMap((year) => year.periods.flatMap((period) => period.items)),
    ...planner.unassignedItems,
  ]) {
    if (item.subject && !planned.has(item.subject.code)) {
      planned.set(item.subject.code, item.subject.creditPoints ?? item.creditPoints ?? 0);
    }
  }

  const entries: Array<{ id: string; name: string; type: string; required: number | null; maximum: number | null; groups: RequirementGroup[] }> =
    Object.values(componentDetails).map((detail) => ({
      id: detail.component.code, name: detail.component.name, type: detail.component.type,
      required: detail.component.creditPoints, maximum: detail.component.creditPoints, groups: detail.requirements,
    }));
  const groupIndex = new Map<string, RequirementGroup>();
  const indexGroups = (groups: RequirementGroup[]) => groups.forEach((group) => {
    groupIndex.set(group.id, group); indexGroups(group.children);
  });
  indexGroups(degreeRequirements);
  Object.values(componentDetails).forEach((detail) => indexGroups(detail.requirements));
  for (const value of Object.values(selections)) {
    if (!value.startsWith("GROUP:")) continue;
    const group = groupIndex.get(value.slice(6));
    if (!group || group.requiredCreditPoints === null) continue;
    entries.push({
      id: group.id, name: group.title ?? "Selected pathway", type: "PATHWAY",
      required: group.requiredCreditPoints,
      maximum: group.maximumCreditPoints ?? ((group.logic === "ANY" || group.logic === "ONE_OF") ? group.requiredCreditPoints : null),
      groups: [group],
    });
  }

  return entries.map((entry) => {
    const eligibleCodes = new Set(collectSubjects(entry.groups).keys());
    const plannedCreditPoints = [...planned].reduce(
      (total, [code, points]) => total + (eligibleCodes.has(code) ? points : 0),
      0,
    );
    return {
      componentCode: entry.id,
      name: entry.name,
      type: entry.type,
      plannedCreditPoints,
      requiredCreditPoints: entry.required,
      maximumCreditPoints: entry.maximum,
      status: entry.maximum !== null && plannedCreditPoints > entry.maximum
        ? "OVER"
        : entry.required !== null && plannedCreditPoints === entry.required
          ? "EXACT"
          : entry.required !== null && plannedCreditPoints < entry.required ? "UNDER" : "UNKNOWN",
    };
  });
};
