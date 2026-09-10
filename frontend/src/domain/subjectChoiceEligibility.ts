import type { RequirementGroup } from "../types/handbook";

export interface RequirementPoolContext {
  group: RequirementGroup;
  quotaGroup: RequirementGroup;
  selectable: boolean;
  requiredCore: boolean;
}

export const collectRequirementPoolContexts = (
  groups: RequirementGroup[],
  selectableGroupIds: ReadonlySet<string>,
  inheritedSelectable?: RequirementGroup,
  inheritedCore?: RequirementGroup,
): RequirementPoolContext[] => groups.flatMap((group) => {
  const selectableGroup = inheritedSelectable ?? (selectableGroupIds.has(group.id) ? group : undefined);
  const coreGroup = selectableGroup ? undefined : inheritedCore ?? (group.logic === "ALL" ? group : undefined);
  const context = group.items.some((item) => item.itemType === "SUBJECT") ? [{
    group,
    quotaGroup: selectableGroup ?? coreGroup ?? group,
    selectable: Boolean(selectableGroup),
    requiredCore: Boolean(coreGroup),
  }] : [];
  return [
    ...context,
    ...collectRequirementPoolContexts(group.children, selectableGroupIds, selectableGroup, coreGroup),
  ];
});

interface SelectionActionInput {
  belongsToResolvedScope: boolean;
  duplicate: boolean;
  maximumCreditPoints: number | null;
  selectedCreditPoints: number;
  currentCreditPoints: number;
  candidateCreditPoints: number;
  replacingCurrent: boolean;
}

export interface SelectionAction {
  visible: boolean;
  disabled: boolean;
  label: "Select" | "Replace current option" | "Requirement already satisfied";
}

export const getSubjectSelectionAction = ({
  belongsToResolvedScope,
  duplicate,
  maximumCreditPoints,
  selectedCreditPoints,
  currentCreditPoints,
  candidateCreditPoints,
  replacingCurrent,
}: SelectionActionInput): SelectionAction => {
  const requirementComplete = maximumCreditPoints !== null && selectedCreditPoints >= maximumCreditPoints;
  const wouldExceed = maximumCreditPoints !== null
    && selectedCreditPoints - currentCreditPoints + candidateCreditPoints > maximumCreditPoints;
  return {
    visible: belongsToResolvedScope,
    disabled: duplicate || wouldExceed || (requirementComplete && !replacingCurrent),
    label: replacingCurrent
      ? "Replace current option"
      : requirementComplete ? "Requirement already satisfied" : "Select",
  };
};
