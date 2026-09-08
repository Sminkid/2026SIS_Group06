import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RequirementGroup } from "../types/handbook";
import { reconcileDependentBranches } from "../domain/studyPathDependencies";

export type ComponentSelections = Record<string, string>;

const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] =>
  groups.flatMap((group) => [group, ...flattenGroups(group.children)]);

export const revalidateComponentSelections = (
  selections: ComponentSelections,
  requirements: RequirementGroup[],
): ComponentSelections => {
  const validValues = new Map<string, Set<string>>();
  const groups = flattenGroups(requirements);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  for (const group of groups) {
    validValues.set(group.id, new Set([
      ...group.items.flatMap((item) => item.component ? [item.component.code] : []),
      ...group.children.map((child) => `GROUP:${child.id}`),
      ...group.pathways.map((pathway) => `PATHWAY:${pathway.id}`),
    ]));
    for (const pathway of group.pathways.filter((candidate) => selections[group.id] === `PATHWAY:${candidate.id}`)) {
      for (const selection of pathway.selections) {
        const sourceGroup = groupsById.get(selection.requirementGroupId);
        const options = new Set(sourceGroup?.items.flatMap((item) => item.component ? [item.component.code] : []) ?? []);
        for (let index = 0; index < selection.requiredSelections; index += 1) {
          validValues.set(`${pathway.id}:selection:${selection.requirementGroupId}:${index}`, options);
        }
      }
    }
  }
  const seen = new Map<string, Set<string>>();
  return reconcileDependentBranches(Object.fromEntries(Object.entries(selections).filter(([groupId, value]) => {
    if (!validValues.get(groupId)?.has(value)) return false;
    if (!groupId.includes(":selection:")) return true;
    const pathway = groupId.split(":selection:")[0];
    const used = seen.get(pathway) ?? new Set<string>();
    if (used.has(value)) return false;
    used.add(value); seen.set(pathway, used); return true;
  })), requirements);
};

const readSelections = (storageKey: string): ComponentSelections => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
};

export const useComponentSelections = (
  universityCode: string,
  handbookYear: number,
  degreeCode: string,
  requirements: RequirementGroup[] = [],
) => {
  const storageKey = useMemo(
    () => `degree-planner:components:${universityCode}:${handbookYear}:${degreeCode}`,
    [degreeCode, handbookYear, universityCode],
  );
  const [selections, setSelections] = useState<ComponentSelections>(() => readSelections(storageKey));
  const [selectionNotice, setSelectionNotice] = useState(false);
  const activeStorageKey = useRef(storageKey);
  const droppedSelection = useRef(false);

  useEffect(() => setSelections(readSelections(storageKey)), [storageKey]);
  useEffect(() => {
    if (droppedSelection.current) {
      droppedSelection.current = false;
      setSelectionNotice(true);
    }
  }, [selections]);
  useEffect(() => {
    if (activeStorageKey.current !== storageKey) {
      activeStorageKey.current = storageKey;
      return;
    }
    try { localStorage.setItem(storageKey, JSON.stringify(selections)); } catch { /* Storage can be unavailable. */ }
  }, [selections, storageKey]);

  const selectComponent = (requirementGroupId: string, componentCode: string, clearGroupIds: string[] = []) => {
    setSelectionNotice(false);
    setSelections((current) => {
      const next = { ...current, [requirementGroupId]: componentCode };
      clearGroupIds.forEach((groupId) => { if (groupId !== requirementGroupId) delete next[groupId]; });
      return universityCode === "UTS" ? reconcileDependentBranches(next, requirements) : next;
    });
  };

  const revalidateSelections = useCallback((requirements: RequirementGroup[]) => {
    setSelections((current) => {
      const next = revalidateComponentSelections(current, requirements);
      const unchanged = Object.keys(current).length === Object.keys(next).length
        && Object.entries(current).every(([key, value]) => next[key] === value);
      if (!unchanged) droppedSelection.current = true;
      return unchanged ? current : next;
    });
  }, []);

  return { selections, selectionNotice, selectComponent, revalidateSelections };
};
