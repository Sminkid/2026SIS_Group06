import type { ComponentDetailResponse, RequirementGroup } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import { flattenRequirements } from "./roadmapSlots";
import { plannerItems } from "./plannerSwap";

export const isRequiredCore = (group: RequirementGroup) => group.logic === "ALL" && group.items.length > 0
  && group.items.every((item) => item.itemType === "SUBJECT")
  && group.items.reduce((sum, item) => sum + (item.subject?.creditPoints ?? item.creditPoints ?? 0), 0) === group.requiredCreditPoints;

export const componentPlacementProgress = (detail: ComponentDetailResponse, planner: PlannerState | null) => {
  const positions = planner ? plannerItems(planner).filter((item) => item.choiceOrigin?.formalComponentId === detail.component.id) : [];
  const placed = positions.filter((item) => item.subject);
  const groups = flattenRequirements(detail.requirements);
  const requiredCore = groups.filter(isRequiredCore).flatMap((group) => group.items.map((item) => ({
    code: item.subject?.code ?? item.rawCode ?? "Unknown", name: item.subject?.name ?? item.rawName ?? "Required subject",
    available: Boolean(item.subject), groupId: group.id,
    placed: placed.some((position) => position.subject?.code === (item.subject?.code ?? item.rawCode) && position.choiceOrigin?.formalRequirementGroupId === group.id),
  })));
  const points = placed.reduce((sum, item) => sum + (item.subject?.creditPoints ?? 0), 0);
  const remainingCore = requiredCore.filter((item) => !item.placed);
  const groupsComplete = groups.filter((group) => group.items.some((item) => item.itemType === "SUBJECT")).every((group) => {
    const cp = placed.filter((item) => item.choiceOrigin?.formalRequirementGroupId === group.id)
      .reduce((sum, item) => sum + (item.subject?.creditPoints ?? 0), 0);
    return cp >= (group.requiredCreditPoints ?? Infinity) && cp <= (group.maximumCreditPoints ?? group.requiredCreditPoints ?? Infinity);
  });
  return { points, positions: positions.length, filled: placed.length, requiredCore, remainingCore,
    complete: remainingCore.length === 0 && groupsComplete && points === detail.component.creditPoints };
};
