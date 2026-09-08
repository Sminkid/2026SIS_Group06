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

const plannerItemIsValid = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item.plannerItemId !== "string" || typeof item.title !== "string") return false;
  if (item.itemType !== "SUBJECT" && item.itemType !== "CHOICE") return false;
  if (item.subject === null) return true;
  if (!item.subject || typeof item.subject !== "object") return false;
  const subject = item.subject as Record<string, unknown>;
  return typeof subject.officialSubjectId === "string"
    && typeof subject.code === "string"
    && typeof subject.name === "string";
};

const plannerItemsAreValid = (candidate: Partial<PlannerState>): boolean => {
  const yearItems = candidate.years?.flatMap((year) =>
    year.periods.flatMap((period) => period.items)) ?? [];
  return yearItems.every(plannerItemIsValid)
    && (candidate.unassignedItems ?? []).every(plannerItemIsValid);
};

const keyPart = (value: string) => encodeURIComponent(value.trim().toUpperCase());

export const createPlannerStorageKey = (
  context: PlannerContext,
  sourcePlanId: string,
): string => {
  const components = context.selectedComponentCodes.length > 0
    ? [...new Set(context.selectedComponentCodes)].sort().map(keyPart).join("+")
    : "NO-COMPONENT";
  const pathwayGroups = context.activePathwayRequirementGroupIds.length > 0
    ? [...context.activePathwayRequirementGroupIds].sort().map(keyPart).join("+")
    : "NO-PATHWAY";

  return [
    "planner",
    keyPart(context.universityCode),
    String(context.handbookYear),
    keyPart(context.degreeCode),
    components,
    pathwayGroups,
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
    && Array.isArray(candidate.unassignedItems)
    && plannerItemsAreValid(candidate);
};

export const reconcilePlannerComponentSelections = (
  planner: PlannerState,
  context: PlannerContext,
): PlannerState => {
  const selectedCodes = new Set(context.selectedComponentCodes);
  const activePathwayGroups = new Set(context.activePathwayRequirementGroupIds);
  const knownPathwayGroups = new Set(context.knownPathwayRequirementGroupIds);
  const reconcileItem = (item: PlannerState["unassignedItems"][number]) => {
    const origin = item.choiceOrigin;
    const staleComponent = origin?.formalComponentCode && !selectedCodes.has(origin.formalComponentCode);
    const stalePathway = origin?.formalRequirementGroupId
      && knownPathwayGroups.has(origin.formalRequirementGroupId)
      && !activePathwayGroups.has(origin.formalRequirementGroupId);
    if (!origin || (!staleComponent && !stalePathway)) {
      return item;
    }
    const {
      formalComponentCode: _componentCode,
      formalComponentId: _componentId,
      formalRequirementGroupId: _group,
      componentRequirementKind: _kind,
      ...choiceOrigin
    } = origin;
    return {
      ...item,
      itemType: "CHOICE" as const,
      subject: null,
      rawCode: origin.rawCode,
      title: origin.title,
      creditPoints: origin.creditPoints,
      choiceOrigin,
    };
  };
  return {
    ...planner,
    years: planner.years.map((year) => ({
      ...year,
      periods: year.periods.map((period) => ({
        ...period,
        items: period.items.map(reconcileItem),
      })),
    })),
    unassignedItems: planner.unassignedItems.map(reconcileItem),
  };
};

/** Rebase generated capacity against stable source identities. */
export const rebasePlannerSlots = (planner: PlannerState, plan: StudyPlan, context: PlannerContext): PlannerState => {
  const fresh = cloneOfficialPlan(plan, context);
  const previous = new Map(planner.years.flatMap((year) => year.periods.flatMap((period) => period.items))
    .concat(planner.unassignedItems).map((item) => [item.plannerItemId, item]));
  return { ...fresh, createdAt: planner.createdAt, updatedAt: planner.updatedAt,
    years: fresh.years.map((year) => ({ ...year, periods: year.periods.map((period) => ({ ...period,
      items: period.items.map((item) => {
        const old = previous.get(item.plannerItemId);
        if (!old?.subject || !old.choiceOrigin || item.choiceOrigin?.componentRequirementKind === "FIXED") return item;
        if (old.choiceOrigin.formalComponentId !== item.choiceOrigin?.formalComponentId
          || old.choiceOrigin.selectedPathwayId !== item.choiceOrigin?.selectedPathwayId) return item;
        return { ...item, subject: old.subject, title: old.title, rawCode: old.rawCode, creditPoints: old.creditPoints,
          itemType: old.itemType, choiceOrigin: { ...old.choiceOrigin, ...item.choiceOrigin } };
      }),
    })) })),
  };
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
      planner: isPlannerState(value, context, sourcePlanId) ? reconcilePlannerComponentSelections(value, context) : null,
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
        const reconciled = reconcilePlannerComponentSelections(
          current.planner,
          context,
        );
        return {
          storageKey,
          planner: {
            ...reconciled,
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

  const planner = useMemo(() => {
    if (stored.storageKey !== storageKey || !stored.planner) return null;
    const generated = officialPlan?.years.some((year) => year.periods.some((period) => period.items.some((item) => item.choiceOrigin?.parentAggregateItemId)))
      || stored.planner.years.some((year) => year.periods.some((period) => period.items.some((item) => item.choiceOrigin?.parentAggregateItemId)));
    return generated && officialPlan ? rebasePlannerSlots(stored.planner, officialPlan, context) : stored.planner;
  }, [stored, storageKey, officialPlan, context]);
  useEffect(() => {
    if (planner && planner !== stored.planner && JSON.stringify(planner) !== JSON.stringify(stored.planner)) setStored({ storageKey, planner });
  }, [planner, stored.planner, storageKey]);

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
    formalComponentId?: string,
  ) => {
    setStored((current) => {
      if (current.storageKey !== storageKey || !current.planner) return current;
      const items = current.planner.years.flatMap((year) => year.periods.flatMap((period) => period.items)).concat(current.planner.unassignedItems);
      const target = items.find((item) => item.plannerItemId === plannerItemId);
      if (!target?.choiceOrigin || target.choiceOrigin.componentRequirementKind === "FIXED"
        || items.some((item) => item.plannerItemId !== plannerItemId && item.subject?.code === subject.code)
        || subject.creditPoints === null || subject.creditPoints <= 0
        || subject.creditPoints > (target.choiceOrigin.maximumCreditPoints ?? target.choiceOrigin.creditPoints ?? Infinity)) return current;
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
                    ? { ...item.choiceOrigin, formalComponentCode: formalComponentCode ?? item.choiceOrigin.formalComponentCode, formalComponentId: formalComponentId ?? item.choiceOrigin.formalComponentId, formalRequirementGroupId: formalRequirementGroupId ?? item.choiceOrigin.formalRequirementGroupId }
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
