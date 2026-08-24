import { useEffect, useMemo, useRef, useState } from "react";

export type ComponentSelections = Record<string, string>;

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
  const activeStorageKey = useRef(storageKey);

  useEffect(() => setSelections(readSelections(storageKey)), [storageKey]);
  useEffect(() => {
    if (activeStorageKey.current !== storageKey) {
      activeStorageKey.current = storageKey;
      return;
    }
    try { localStorage.setItem(storageKey, JSON.stringify(selections)); } catch { /* Storage can be unavailable. */ }
  }, [selections, storageKey]);

  const selectComponent = (requirementGroupId: string, componentCode: string, clearGroupIds: string[] = []) => {
    setSelections((current) => {
      const next = { ...current, [requirementGroupId]: componentCode };
      clearGroupIds.forEach((groupId) => { if (groupId !== requirementGroupId) delete next[groupId]; });
      return next;
    });
  };

  return { selections, selectComponent };
};
