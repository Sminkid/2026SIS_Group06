import type { PlannerItem, PlannerState } from "../types/planner";
import { isCustomPosition, proposeSwap, type SwapFacts } from "./plannerSwap";

export interface SwapTarget { item: PlannerItem; label: string }
export interface SwapTargetSession { id: string; label: string; targets: SwapTarget[] }

/**
 * Returns only user-controlled targets with compatible CP capacity and a valid
 * proposal. Session groups are emitted only when they contain a target.
 * This presentation filter delegates hard rules to the existing swap validator;
 * confirmation still validates the latest plan independently.
 */
export function getValidSwapTargets(plan: PlannerState, sourceId: string, facts: SwapFacts): SwapTargetSession[] {
  const items = plan.years.flatMap(year => year.periods.flatMap(period => period.items));
  const source = items.find(item => item.plannerItemId === sourceId);
  if (!source?.subject || !isCustomPosition(source)) return [];
  const capacity = (item: PlannerItem) => item.choiceOrigin?.maximumCreditPoints ?? item.choiceOrigin?.creditPoints ?? item.creditPoints;
  return plan.years.flatMap(year => year.periods.flatMap(period => {
    const label = `${year.name} ${period.name}`;
    const targets = period.items.filter(item => {
      if (item.plannerItemId === sourceId || !isCustomPosition(item) || item.choiceOrigin?.candidateSourceType === "UNRESOLVED") return false;
      const targetCapacity = capacity(item), sourceCapacity = capacity(source);
      if (targetCapacity === null || source.subject!.creditPoints === null || source.subject!.creditPoints > targetCapacity) return false;
      if (item.subject && (sourceCapacity === null || item.subject.creditPoints === null || item.subject.creditPoints > sourceCapacity)) return false;
      return proposeSwap(plan, sourceId, item.plannerItemId, facts).errors.length === 0;
    }).map(item => ({ item, label }));
    return targets.length ? [{ id: period.plannerPeriodId, label, targets }] : [];
  }));
}
