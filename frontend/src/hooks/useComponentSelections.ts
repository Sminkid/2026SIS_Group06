import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RequirementGroup } from "../types/handbook";

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
    for (const pathway of group.pathways) {
      for (const selection of pathway.selections) {
        const sourceGroup = groupsById.get(selection.requirementGroupId);
        const options = new Set(sourceGroup?.items.flatMap((item) => item.component ? [item.component.code] : []) ?? []);
        for (let index = 0; index < selection.requiredSelections; index += 1) {
          validValues.set(`${pathway.id}:selection:${selection.requirementGroupId}:${index}`, options);
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(selections).filter(([groupId, value]) =>
    validValues.get(groupId)?.has(value)));
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
      return next;
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
