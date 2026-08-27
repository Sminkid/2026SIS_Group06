import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudyPlan } from "../types/handbook";
import type { ComponentDetailResponse } from "../types/handbook";
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

type ComponentSubject = NonNullable<
  ComponentDetailResponse["requirements"][number]["items"][number]["subject"]
>;
interface ComponentPlanTemplate {
  kind: "SUBJECT" | "CHOICE";
  subject: ComponentSubject | null;
  creditPoints: number;
  origin: {
    componentId: string;
    componentCode: string;
    groupId: string;
    title: string;
  };
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
    if (!item.subject || !origin || (!staleComponent && !stalePathway)) {
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

  const syncSelectedComponentSubjects = useCallback((details: Record<string, ComponentDetailResponse>) => {
    setStored((current) => {
      if (current.storageKey !== storageKey || !current.planner) return current;
      const allItems = [
        ...current.planner.years.flatMap((year) => year.periods.flatMap((period) => period.items)),
        ...current.planner.unassignedItems,
      ];
      const plannedCodes = new Set(allItems.flatMap((item) => item.subject ? [item.subject.code] : []));
      const alreadyExpanded = new Set(allItems.flatMap((item) =>
        item.choiceOrigin?.formalComponentId ? [item.choiceOrigin.formalComponentId] : []));
      const selectedCodes = new Set(current.planner.context.selectedComponentCodes);
      const parentComponents = new Set(Object.values(details).flatMap((detail) => {
        const collect = (groups: ComponentDetailResponse["requirements"]): string[] => groups.flatMap((group) => [
          ...group.items.flatMap((item) => item.component && selectedCodes.has(item.component.code) ? [detail.component.id] : []),
          ...collect(group.children),
        ]);
        return collect(detail.requirements);
      }));
      const templates: ComponentPlanTemplate[] = Object.values(details).filter((detail) =>
        !alreadyExpanded.has(detail.component.id) && !parentComponents.has(detail.component.id)).flatMap<ComponentPlanTemplate>((detail) =>
        detail.requirements.flatMap<ComponentPlanTemplate>((group) => {
          const subjects = group.items.flatMap((item) => item.subject ? [item.subject] : []);
          if (subjects.length === 0) return [];
          const origin = {
            componentId: detail.component.id,
            componentCode: detail.component.code,
            groupId: group.id,
            title: group.title ?? detail.component.name,
          };
          if (group.logic === "ALL") return subjects.flatMap((subject) => {
            if (plannedCodes.has(subject.code)) return [];
            plannedCodes.add(subject.code);
            return [{ kind: "SUBJECT" as const, subject, creditPoints: subject.creditPoints ?? 0, origin }];
          });
          if (group.logic !== "ANY" && group.logic !== "ONE_OF") return [];
          const candidatePoints = subjects.map((subject) => subject.creditPoints).filter((points): points is number => points !== null && points > 0);
          const slotPoints = candidatePoints.length > 0 ? Math.min(...candidatePoints) : group.requiredCreditPoints;
          if (!slotPoints || !group.requiredCreditPoints) return [];
          return Array.from({ length: Math.ceil(group.requiredCreditPoints / slotPoints) }, (_, index) => ({
            kind: "CHOICE" as const,
            subject: null,
            creditPoints: Math.min(slotPoints, group.requiredCreditPoints! - index * slotPoints),
            origin,
          }));
        }));
      if (templates.length === 0) return current;

      let templateIndex = 0;
      const years = current.planner.years.map((year) => ({
        ...year,
        periods: year.periods.map((period) => ({
          ...period,
          items: period.items.flatMap((item) => {
            if (item.itemType !== "CHOICE" || !item.choiceOrigin || item.choiceOrigin.formalComponentId
              || /\b(internship|placement|practicum)\b/i.test(item.title)) return [item];
            const slotPoints = item.creditPoints ?? 0;
            let usedPoints = 0;
            const replacements: PlannerState["unassignedItems"] = [];
            while (templateIndex < templates.length) {
              const template = templates[templateIndex]!;
              const points = template.creditPoints;
              if (points <= 0 || (slotPoints > 0 && usedPoints + points > slotPoints)) break;
              templateIndex += 1;
              usedPoints += points;
              replacements.push({
                ...item,
                plannerItemId: `${item.plannerItemId}:component:${template.origin.componentId}:${template.origin.groupId}:${templateIndex}`,
                itemType: template.kind,
                subject: template.subject ? {
                  officialSubjectId: template.subject.id,
                  code: template.subject.code,
                  name: template.subject.name,
                  creditPoints: template.subject.creditPoints,
                } : null,
                rawCode: template.subject?.code ?? null,
                title: template.subject?.name ?? template.origin.title,
                creditPoints: template.creditPoints,
                choiceOrigin: {
                  ...item.choiceOrigin,
                  title: template.origin.title,
                  creditPoints: template.creditPoints,
                  formalComponentId: template.origin.componentId,
                  formalComponentCode: template.origin.componentCode,
                  formalRequirementGroupId: template.origin.groupId,
                  componentRequirementKind: template.kind === "SUBJECT" ? "FIXED" : "SELECTIVE",
                },
              });
              if (slotPoints > 0 && usedPoints >= slotPoints) break;
            }
            const remainingPoints = slotPoints > usedPoints ? slotPoints - usedPoints : 0;
            return [...replacements, ...(remainingPoints > 0 ? [{ ...item, creditPoints: remainingPoints }] : [])];
          }),
        })),
      }));
      if (templateIndex === 0) return current;
      return { storageKey, planner: { ...current.planner, years, updatedAt: new Date().toISOString() } };
    });
  }, [storageKey]);

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
    syncSelectedComponentSubjects,
  };
};
