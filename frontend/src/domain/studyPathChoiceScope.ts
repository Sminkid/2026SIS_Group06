import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { ComponentDetailResponse, RequirementGroup, StudyPlanItem } from "../types/handbook";

export interface ChoiceScope {
  kind: "FORMAL" | "BROAD" | "UNRESOLVED";
  label?: string;
  componentCode?: string;
  requirementGroupId?: string;
  groups?: RequirementGroup[];
  selectableGroupIds?: string[];
}

const flatten = (groups: RequirementGroup[]): RequirementGroup[] =>
  groups.flatMap((group) => [group, ...flatten(group.children)]);
const components = (group: RequirementGroup) => group.items.flatMap((item) => item.component ? [item.component] : []);
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const selectedChild = (group: RequirementGroup, selections: ComponentSelections) => {
  const value = selections[group.id];
  return value?.startsWith("GROUP:") ? group.children.find((child) => child.id === value.slice(6)) : undefined;
};
const selectedComponentsIn = (
  group: RequirementGroup | undefined,
  selections: ComponentSelections,
  details: Record<string, ComponentDetailResponse>,
) => group ? flatten([group]).flatMap((candidate) => {
  const value = selections[candidate.id];
  return value && !value.startsWith("GROUP:") && details[value] ? [details[value]] : [];
}) : [];

const componentScope = (detail: ComponentDetailResponse, preferredGroupId?: string): ChoiceScope => {
  const optionalGroups = flatten(detail.requirements).filter((group) => {
    const hasSubjects = group.items.some((item) => item.subject);
    const name = normalized(group.title ?? "");
    return hasSubjects && !/\b(core|mandatory|compulsory)\b/.test(name)
      && (group.logic === "ANY" || group.logic === "ONE_OF" || /\b(option|elective|choice)\b/.test(name));
  });
  return {
    kind: "FORMAL",
    label: detail.component.name,
    componentCode: detail.component.code,
    requirementGroupId: preferredGroupId,
    groups: detail.requirements,
    selectableGroupIds: preferredGroupId ? [preferredGroupId] : optionalGroups.map((group) => group.id),
  };
};

export const resolveStudyPathChoiceScope = (
  choice: StudyPlanItem | null,
  degreeRequirements: RequirementGroup[],
  details: Record<string, ComponentDetailResponse>,
  selections: ComponentSelections,
): ChoiceScope => {
  if (!choice) return { kind: "UNRESOLVED" };
  const origin = choice.choiceOrigin;
  if (origin?.formalComponentCode && details[origin.formalComponentCode]) {
    return componentScope(details[origin.formalComponentCode], origin.formalRequirementGroupId);
  }
  if (origin?.formalRequirementGroupId) {
    const group = [...flatten(degreeRequirements), ...Object.values(details).flatMap((detail) => flatten(detail.requirements))]
      .find((candidate) => candidate.id === origin.formalRequirementGroupId);
    return {
      kind: "FORMAL", requirementGroupId: origin.formalRequirementGroupId,
      label: group?.title ?? "Mapped handbook requirement",
      groups: group ? [group] : undefined,
      selectableGroupIds: [origin.formalRequirementGroupId],
    };
  }
  const rawComponentCode = (origin?.rawCode ?? choice.rawCode)?.trim().toUpperCase();
  if (rawComponentCode && details[rawComponentCode]) return componentScope(details[rawComponentCode]);

  const slotName = normalized(origin?.title ?? choice.title);
  const allDegreeGroups = flatten(degreeRequirements);
  const majorGroup = allDegreeGroups.find((group) => components(group).some((component) => component.type === "MAJOR"));
  const majorCode = majorGroup ? selections[majorGroup.id] : undefined;
  const majorDetail = majorCode ? details[majorCode] : undefined;
  const majorOptions = majorDetail?.requirements.find((group) => group.children.length > 1 && (group.logic === "ANY" || group.logic === "ONE_OF"));
  const majorOption = majorOptions ? selectedChild(majorOptions, selections) : undefined;
  const majorNested = selectedComponentsIn(majorOption, selections, details);

  const separatePath = degreeRequirements.find((group) => group.children.length > 1 && !components(group).some((component) => component.type === "MAJOR"));
  const separateSelection = separatePath ? selectedChild(separatePath, selections) : undefined;
  const separateNested = selectedComponentsIn(separateSelection, selections, details);

  if (/free elective/.test(slotName)) {
    if (/sub major|submajor/.test(slotName) && separateNested.length > 0) return componentScope(separateNested.at(-1)!);
    const freeGroup = separateSelection && flatten([separateSelection]).find((group) => /free elective/.test(normalized(group.title ?? "")));
    return {
      kind: "BROAD", label: freeGroup?.title ?? "Free Elective",
      requirementGroupId: freeGroup?.id,
      groups: freeGroup ? [freeGroup] : undefined,
      selectableGroupIds: freeGroup ? [freeGroup.id] : undefined,
    };
  }
  if (/transdisciplinary/.test(slotName) && separateSelection) {
    const group = flatten([separateSelection]).find((candidate) => /transdisciplinary/.test(normalized(candidate.title ?? "")));
    if (group) return { kind: "FORMAL", label: group.title ?? "Transdisciplinary Elective", requirementGroupId: group.id, groups: [group], selectableGroupIds: [group.id] };
  }
  if (separateNested.length > 0 && /elective|specialist|sub major|submajor|industry/.test(slotName)) return componentScope(separateNested.at(-1)!);
  if (majorNested.length > 0 && /option|technical|sub major|submajor/.test(slotName)) return componentScope(majorNested.at(-1)!);

  const selectedDetails = [...majorNested, ...separateNested];
  const named = selectedDetails.find((detail) => slotName.includes(normalized(detail.component.name)));
  if (named) return componentScope(named);
  return { kind: "UNRESOLVED" };
};
