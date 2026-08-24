import { useEffect, useMemo, useState } from "react";
import type { StudyPlan } from "../types/handbook";
import type { SubjectSearchResult } from "../types/subject";
import {
  cloneOfficialPlan,
  type PlannerContext,
  type PlannerState,
} from "../types/planner";

interface StoredPlanner {
  storageKey: string;
  planner: PlannerState | null;
}

const keyPart = (value: string) => encodeURIComponent(value.trim().toUpperCase());

export const createPlannerStorageKey = (
  context: PlannerContext,
  sourcePlanId: string,
): string => {
  const components = context.selectedComponentCodes.length > 0
    ? [...new Set(context.selectedComponentCodes)].sort().map(keyPart).join("+")
    : "NO-COMPONENT";

  return [
    "planner",
    keyPart(context.universityCode),
    String(context.handbookYear),
    keyPart(context.degreeCode),
    components,
    encodeURIComponent(sourcePlanId),
  ].join(":");
};

const isPlannerState = (
  value: unknown,
  context: PlannerContext,
  sourcePlanId: string,
): value is PlannerState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlannerState>;
  return candidate.schemaVersion === 3
    && candidate.sourcePlanId === sourcePlanId
    && candidate.context?.universityCode === context.universityCode
    && candidate.context.handbookYear === context.handbookYear
    && candidate.context.degreeCode === context.degreeCode
    && Array.isArray(candidate.years)
    && Array.isArray(candidate.unassignedItems);
};

const upgradePlannerState = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  const legacy = value as Record<string, unknown>;
  if (legacy.schemaVersion !== 2 || !Array.isArray(legacy.years)) return value;

  return {
    ...legacy,
    schemaVersion: 3,
    unassignedItems: [],
    years: legacy.years.map((year) => {
      const yearRecord = year as Record<string, unknown>;
      return {
        ...yearRecord,
        periods: Array.isArray(yearRecord.periods)
          ? yearRecord.periods.map((period) => {
              const periodRecord = period as Record<string, unknown>;
              return {
                ...periodRecord,
                items: Array.isArray(periodRecord.items)
                  ? periodRecord.items.map((item, index) => ({
                      ...(item as Record<string, unknown>),
                      officialSortOrder: index,
                    }))
                  : [],
              };
            })
          : [],
      };
    }),
  };
};

const restorePlanner = (
  storageKey: string,
  context: PlannerContext,
  sourcePlanId: string,
): StoredPlanner => {
  try {
    const value: unknown = upgradePlannerState(
      JSON.parse(localStorage.getItem(storageKey) ?? "null"),
    );
    return {
      storageKey,
      planner: isPlannerState(value, context, sourcePlanId) ? value : null,
    };
  } catch {
    return { storageKey, planner: null };
  }
};

export const usePlannerState = (
  officialPlan: StudyPlan | undefined,
  context: PlannerContext,
) => {
  const storageKey = useMemo(
    () => createPlannerStorageKey(context, officialPlan?.id ?? "NO-PLAN"),
    [context, officialPlan?.id],
  );
  const [stored, setStored] = useState<StoredPlanner>(() =>
    restorePlanner(storageKey, context, officialPlan?.id ?? "NO-PLAN"),
  );

  useEffect(() => {
    const sourcePlanId = officialPlan?.id ?? "NO-PLAN";
    setStored((current) => {
      const canCarryDraft = current.storageKey !== storageKey
        && current.planner?.sourcePlanId === sourcePlanId
        && current.planner.context.universityCode === context.universityCode
        && current.planner.context.handbookYear === context.handbookYear
        && current.planner.context.degreeCode === context.degreeCode;
      if (canCarryDraft && current.planner) {
        return {
          storageKey,
          planner: {
            ...current.planner,
            context: { ...context, selectedComponentCodes: [...context.selectedComponentCodes] },
            updatedAt: new Date().toISOString(),
          },
        };
      }
      return restorePlanner(storageKey, context, sourcePlanId);
    });
  }, [context, officialPlan?.id, storageKey]);

  useEffect(() => {
    if (stored.storageKey !== storageKey || !stored.planner) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored.planner));
    } catch {
      // Customization still works for the session when storage is unavailable.
    }
  }, [storageKey, stored]);

  const planner = stored.storageKey === storageKey ? stored.planner : null;

  const customize = () => {
    if (!officialPlan) return;
    setStored({ storageKey, planner: cloneOfficialPlan(officialPlan, context) });
  };

  const reset = () => {
    if (!officialPlan) return;
    setStored({ storageKey, planner: cloneOfficialPlan(officialPlan, context) });
  };

  const clear = () => {
    try { localStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ }
    setStored({ storageKey, planner: null });
  };

  const selectSubject = (
    plannerItemId: string,
    subject: SubjectSearchResult,
    formalComponentCode?: string,
    formalRequirementGroupId?: string,
  ) => {
    setStored((current) => {
      if (current.storageKey !== storageKey || !current.planner) return current;
      return {
        storageKey,
        planner: {
          ...current.planner,
          updatedAt: new Date().toISOString(),
          years: current.planner.years.map((year) => ({
            ...year,
            periods: year.periods.map((period) => ({
              ...period,
              items: period.items.map((item) => {
                if (item.plannerItemId !== plannerItemId || !item.choiceOrigin) return item;
                return {
                  ...item,
                  choiceOrigin: item.choiceOrigin
                    ? { ...item.choiceOrigin, formalComponentCode, formalRequirementGroupId }
                    : item.choiceOrigin,
                  itemType: "SUBJECT",
                  subject: {
                    officialSubjectId: subject.id,
                    code: subject.code,
                    name: subject.name,
                    creditPoints: subject.creditPoints,
                  },
                  rawCode: subject.code,
                  title: subject.name,
                  creditPoints: subject.creditPoints ?? item.choiceOrigin.creditPoints,
                };
              }),
            })),
          })),
        },
      };
    });
  };

  const moveItem = (
    plannerItemId: string,
    targetPeriodId: string | null,
  ) => {
    setStored((current) => {
      if (current.storageKey !== storageKey || !current.planner) return current;
      let movingItem = current.planner.unassignedItems.find(
        (item) => item.plannerItemId === plannerItemId,
      );
      const yearsWithoutItem = current.planner.years.map((year) => ({
        ...year,
        periods: year.periods.map((period) => ({
          ...period,
          items: period.items.filter((item) => {
            if (item.plannerItemId !== plannerItemId) return true;
            movingItem = item;
            return false;
          }),
        })),
      }));
      if (!movingItem?.subject) return current;

      const unassignedItems = current.planner.unassignedItems.filter(
        (item) => item.plannerItemId !== plannerItemId,
      );
      const years = targetPeriodId === null
        ? yearsWithoutItem
        : yearsWithoutItem.map((year) => ({
            ...year,
            periods: year.periods.map((period) => period.plannerPeriodId === targetPeriodId
              ? { ...period, items: [...period.items, movingItem!] }
              : period),
          }));
      const targetExists = targetPeriodId !== null && years.some((year) =>
        year.periods.some((period) => period.plannerPeriodId === targetPeriodId));

      return {
        storageKey,
        planner: {
          ...current.planner,
          updatedAt: new Date().toISOString(),
          years,
          unassignedItems: targetPeriodId === null || !targetExists
            ? [...unassignedItems, movingItem]
            : unassignedItems,
        },
      };
    });
  };

  const restoreChoiceSlot = (plannerItemId: string) => {
    setStored((current) => {
      if (current.storageKey !== storageKey || !current.planner) return current;
      let choiceItem = current.planner.unassignedItems.find(
        (item) => item.plannerItemId === plannerItemId,
      );
      const yearsWithoutItem = current.planner.years.map((year) => ({
        ...year,
        periods: year.periods.map((period) => ({
          ...period,
          items: period.items.filter((item) => {
            if (item.plannerItemId !== plannerItemId) return true;
            choiceItem = item;
            return false;
          }),
        })),
      }));
      if (!choiceItem?.choiceOrigin) return current;
      const origin = choiceItem.choiceOrigin;
      const restoredItem = {
        ...choiceItem,
        itemType: "CHOICE" as const,
        subject: null,
        rawCode: origin.rawCode,
        title: origin.title,
        creditPoints: origin.creditPoints,
      };
      let restored = false;
      const years = yearsWithoutItem.map((year) => ({
        ...year,
        periods: year.periods.map((period) => {
          if (period.officialPeriodId !== origin.originalPeriodId) return period;
          restored = true;
          return {
            ...period,
            items: [...period.items, restoredItem].sort((left, right) =>
              (left.officialSortOrder ?? Number.MAX_SAFE_INTEGER)
              - (right.officialSortOrder ?? Number.MAX_SAFE_INTEGER)),
          };
        }),
      }));
      return {
        storageKey,
        planner: {
          ...current.planner,
          updatedAt: new Date().toISOString(),
          years,
          unassignedItems: restored
            ? current.planner.unassignedItems.filter((item) => item.plannerItemId !== plannerItemId)
            : [...current.planner.unassignedItems.filter((item) => item.plannerItemId !== plannerItemId), restoredItem],
        },
      };
    });
  };

  const clearPeriod = (plannerPeriodId: string) => {
    setStored((current) => {
      if (current.storageKey !== storageKey || !current.planner) return current;
      const movedItems: typeof current.planner.unassignedItems = [];
      const years = current.planner.years.map((year) => ({
        ...year,
        periods: year.periods.map((period) => {
          if (period.plannerPeriodId !== plannerPeriodId) return period;
          movedItems.push(...period.items.filter((item) => item.subject !== null));
          return {
            ...period,
            items: period.items.filter((item) => item.subject === null),
          };
        }),
      }));
      if (movedItems.length === 0) return current;
      return {
        storageKey,
        planner: {
          ...current.planner,
          updatedAt: new Date().toISOString(),
          years,
          unassignedItems: [...current.planner.unassignedItems, ...movedItems],
        },
      };
    });
  };

  return {
    planner,
    storageKey,
    customize,
    reset,
    clear,
    selectSubject,
    moveItem,
    restoreChoiceSlot,
    clearPeriod,
  };
};
