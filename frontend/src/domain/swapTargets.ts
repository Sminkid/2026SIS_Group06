import type {
  PlannerItem,
  PlannerState,
} from "../types/planner";
import {
  isCustomPosition,
  proposeSwap,
  type SwapFacts,
} from "./plannerSwap";

export interface SwapTarget {
  item: PlannerItem;
  label: string;
}

export interface SwapTargetSession {
  id: string;
  label: string;
  targets: SwapTarget[];
}

/**
 * Returns all user-controlled/flexible schedule positions whose resulting
 * swapped plan passes the normal validator.
 *
 * We deliberately do NOT compare formal requirement ownership or slot CP
 * capacity here. The complete allocation/card is what moves:
 *
 * - subject
 * - Core/Option/Sub-major/Stream ownership
 * - choiceOrigin/provenance
 * - allocation credit-point metadata
 *
 * Only its schedule position is rebound by plannerSwap.exchange().
 *
 * Hard validation still happens through proposeSwap():
 * - official/fixed positions remain locked
 * - session workload
 * - offering availability
 * - allowed schedule position
 * - prerequisite/corequisite/anti-requisite timing
 */
export function getValidSwapTargets(
  plan: PlannerState,
  sourceId: string,
  facts: SwapFacts,
): SwapTargetSession[] {
  const items =
    plan.years.flatMap((year) =>
      year.periods.flatMap(
        (period) => period.items,
      ),
    );

  const source =
    items.find(
      (item) =>
        item.plannerItemId ===
        sourceId,
    );

  if (
    !source?.subject ||
    !isCustomPosition(source)
  ) {
    return [];
  }

  return plan.years.flatMap(
    (year) =>
      year.periods.flatMap(
        (period) => {
          const label =
            `${year.name} ${period.name}`;

          const targets =
            period.items
              .filter((item) => {
                if (
                  item.plannerItemId ===
                    sourceId ||
                  !isCustomPosition(item)
                ) {
                  return false;
                }

                return (
                  proposeSwap(
                    plan,
                    sourceId,
                    item.plannerItemId,
                    facts,
                  ).errors.length === 0
                );
              })
              .map((item) => ({
                item,
                label,
              }));

          return targets.length
            ? [
                {
                  id:
                    period.plannerPeriodId,
                  label,
                  targets,
                },
              ]
            : [];
        },
      ),
  );
}
