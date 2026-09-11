import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { ComponentDetailResponse, RequirementGroup, StudyPlanItem } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import { handbookCodes, requirementCodes } from "./roadmapSlots";

export interface ChoiceScope {
  kind: "FORMAL" | "BROAD" | "UNRESOLVED";
  label?: string;
  componentCode?: string;
  componentId?: string;
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
  const exact = preferredGroupId ? flatten(detail.requirements).find((group) => group.id === preferredGroupId) : undefined;
  if (preferredGroupId && !exact) return { kind: "UNRESOLVED", label: "The mapped component requirement is unavailable." };
  const selectableGroups = flatten(detail.requirements).filter((group) =>
    (group.logic === "ANY" || group.logic === "ONE_OF")
    && flatten([group]).some((candidate) => candidate.items.some((item) => item.subject)));
  return {
    kind: "FORMAL",
    label: detail.component.name,
    componentCode: detail.component.code,
    componentId: detail.component.id,
    requirementGroupId: preferredGroupId,
    groups: exact ? [exact] : detail.requirements,
    selectableGroupIds: preferredGroupId ? [preferredGroupId] : selectableGroups.map((group) => group.id),
  };
};

export const resolveStudyPathChoiceScope = (
  choice: StudyPlanItem | null,
  degreeRequirements: RequirementGroup[],
  details: Record<string, ComponentDetailResponse>,
  selections: ComponentSelections,
  planner?: PlannerState | null,
): ChoiceScope => {
  if (!choice) return { kind: "UNRESOLVED" };
  const origin = choice.choiceOrigin;
  if (origin?.candidateSourceType === "UNRESOLVED") return { kind: "UNRESOLVED", label: origin.sourceLabel };
  if (origin?.candidateSourceType === "BROAD") {
    const group = flatten(degreeRequirements).find((candidate) => candidate.id === origin.formalRequirementGroupId);
    const mapped = group && flatten([group]).some((candidate) => candidate.items.some((item) => item.itemType === "SUBJECT" || item.component));
    return { kind: mapped ? "FORMAL" : "BROAD", label: origin.sourceLabel, requirementGroupId: group?.id,
      groups: group ? [group] : undefined, selectableGroupIds: group ? [group.id] : undefined };
  }
  if (origin?.formalComponentCode && details[origin.formalComponentCode]) {
    return componentScope(details[origin.formalComponentCode], origin.componentRequirementKind === "COMPONENT" ? undefined : origin.formalRequirementGroupId);
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

  const codes = new Set([...handbookCodes(origin?.rawCode ?? choice.rawCode), ...handbookCodes(origin?.title ?? choice.title)]);
  if (codes.size) {
    const selectedCodes = new Set(Object.values(selections));
    const componentMatches = Object.values(details).filter((detail) => selectedCodes.has(detail.component.code)).flatMap((detail) =>
      flatten(detail.requirements).filter((group) => [...requirementCodes(group)].some((code) => codes.has(code)))
        .map((group) => ({ detail, group })));
    if (componentMatches.length === 1) return componentScope(componentMatches[0].detail, componentMatches[0].group.id);
    const degreeMatches = flatten(degreeRequirements).filter((group) => [...requirementCodes(group)].some((code) => codes.has(code)));
    if (degreeMatches.length === 1 && degreeMatches[0].pathways.length === 0) return {
      kind: "FORMAL", label: degreeMatches[0].title ?? "Mapped requirement", requirementGroupId: degreeMatches[0].id,
      groups: degreeMatches, selectableGroupIds: [degreeMatches[0].id],
    };
    if (componentMatches.length > 1 || degreeMatches.length > 0) return { kind: "UNRESOLVED", label: "Choose the pathway and component for this requirement." };
  }

  const explicitGroup = degreeRequirements.find((group) => group.pathways.length > 0);
  const selectedPathwayValue = explicitGroup ? selections[explicitGroup.id] : undefined;
  const selectedPathway = selectedPathwayValue?.startsWith("PATHWAY:")
    ? explicitGroup?.pathways.find((pathway) => pathway.id === selectedPathwayValue.slice(8))
    : undefined;
  if (explicitGroup && selectedPathway && planner) {
    const roadmapChoices = planner.years.flatMap((year) => year.periods.flatMap((period) => period.items))
      .filter((item) => item.choiceOrigin && !/\b(internship|placement|practicum|professional experience)\b/i.test(item.title));
    const choiceIndex = roadmapChoices.findIndex((item) => item.plannerItemId === choice.id);
    if (choiceIndex >= 0) {
      const startPoint = roadmapChoices.slice(0, choiceIndex).reduce((total, item) => total + (item.creditPoints ?? 0), 0);
      let allocationEnd = 0;
      for (const selection of selectedPathway.selections) {
        const allocationPoints = selection.requiredCreditPoints / Math.max(1, selection.requiredSelections);
        for (let index = 0; index < selection.requiredSelections; index += 1) {
          allocationEnd += allocationPoints;
          if (startPoint >= allocationEnd) continue;
          const group = flatten(degreeRequirements).find((candidate) => candidate.id === selection.requirementGroupId);
          if (selection.selectionType === "ELECTIVE_ALLOCATION") {
            return {
              kind: "BROAD", label: group?.title ?? "Electives", requirementGroupId: group?.id,
              groups: group ? [group] : undefined, selectableGroupIds: group ? [group.id] : undefined,
            };
          }
          const componentCode = selections[`${selectedPathway.id}:selection:${selection.requirementGroupId}:${index}`];
          if (componentCode && details[componentCode]) return componentScope(details[componentCode]);
          return { kind: "UNRESOLVED" };
        }
      }
    }
  }
  const rawComponentCode = (origin?.rawCode ?? choice.rawCode)?.trim().toUpperCase();
  if (rawComponentCode && details[rawComponentCode]) return componentScope(details[rawComponentCode]);

  const slotName = normalized(origin?.title ?? choice.title);
  const allDegreeGroups = flatten(degreeRequirements);
  const majorGroup = allDegreeGroups.find((group) => components(group).some((component) => component.type === "MAJOR"));
  const majorCode = majorGroup ? selections[majorGroup.id] : undefined;
  const majorDetail = majorCode ? details[majorCode] : undefined;
  const majorOptions = majorDetail?.requirements.find((group) => (group.children.length > 1 || group.items.some((item) => item.component)) && (group.logic === "ANY" || group.logic === "ONE_OF"));
  const majorOption = majorOptions ? majorOptions.children.length ? selectedChild(majorOptions, selections) : majorOptions : undefined;
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
  if (majorOption?.items.some((item) => item.subject) && /option|technical/.test(slotName)) {
    return {
      kind: "FORMAL", label: majorDetail?.component.name ?? majorOption.title ?? "Selected major",
      componentCode: majorDetail?.component.code, componentId: majorDetail?.component.id,
      requirementGroupId: majorOption.id, groups: [majorOption], selectableGroupIds: [majorOption.id],
    };
  }
  if (separateNested.length > 0 && /elective|specialist|sub major|submajor|industry/.test(slotName)) return componentScope(separateNested.at(-1)!);
  if (majorNested.length > 0 && /option|technical|sub major|submajor/.test(slotName)) return componentScope(majorNested.at(-1)!);

  const selectedDetails = [...majorNested, ...separateNested];
  const named = selectedDetails.find((detail) => slotName.includes(normalized(detail.component.name)));
  if (named) return componentScope(named);
  return { kind: "UNRESOLVED" };
};
