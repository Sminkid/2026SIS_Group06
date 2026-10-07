import type { PlannerItem, PlannerState } from "../types/planner";
import { isCustomPosition, plannerItems, type SwapFacts } from "./plannerSwap";
import { validatePlanner } from "./plannerValidation";

/** Review a schedule move without changing allocation identity or requirement ownership. */
export function proposeMove(plan: PlannerState, id: string, target: string | null, facts: SwapFacts,
  canMove: (item: PlannerItem) => boolean = isCustomPosition) {
  const errors: string[] = []; const warnings: string[] = [];
  const item = [...plannerItems(plan), ...plan.unassignedItems].find(item => item.plannerItemId === id);
  const period = plan.years.flatMap(year => year.periods).find(period => period.plannerPeriodId === target);
  if (!item?.subject || !canMove(item)) errors.push("This subject is locked in its recommended period.");
  if (target !== null && !period) errors.push("Choose a study period in this plan.");
  if (errors.length || !item?.subject) return { plan, errors, warnings };
  const next: PlannerState = { ...plan,
    years: plan.years.map(year => ({ ...year, periods: year.periods.map(period => ({ ...period,
      items: [...period.items.filter(old => old.plannerItemId !== id), ...(period.plannerPeriodId === target ? [item] : [])],
    })) })),
    unassignedItems: [...plan.unassignedItems.filter(old => old.plannerItemId !== id), ...(target === null ? [item] : [])],
  };
  const check = (planner: PlannerState) => validatePlanner({ planner, degreeCreditPoints: null, requirements: [], selectedComponents: {}, accessConditions: facts.accessConditions }).results;
  const issueKey = (issue: ReturnType<typeof check>[number]) => `${issue.code}:${issue.subjectCode}:${issue.message}`;
  const before = new Set(check(plan).map(issueKey));
  for (const issue of check(next)) {
    if (issue.code === "DUPLICATE_SUBJECT") errors.push(issue.message);
    if (["PREREQUISITE_TIMING", "COREQUISITE_TIMING", "ANTI_REQUISITE_CONFLICT"].includes(issue.code)
      && (!before.has(issueKey(issue)) || issue.subjectCode === item.subject.code)) errors.push(issue.message);
  }
  if (period) {
    const points = next.years.flatMap(year => year.periods).find(next => next.plannerPeriodId === target)!.items.reduce((sum, item) => sum + (item.subject?.creditPoints ?? item.creditPoints ?? 0), 0);
    if (period.maximumCreditPoints !== undefined && points > period.maximumCreditPoints) errors.push(`${points} CP exceeds this period's ${period.maximumCreditPoints} CP limit.`);
    if (item.allowedPeriodIds && !item.allowedPeriodIds.includes(period.officialPeriodId)) errors.push("This subject is restricted to another period.");
    const offered = facts.offeredPeriods?.[item.subject.code];
    if (offered && !offered.some(name => name.toLowerCase().trim() === period.name.toLowerCase().trim())) errors.push(`${item.subject.code} is not offered in ${period.name}.`);
    if (!offered) warnings.push(`${item.subject.code}: period availability is unverified.`);
  }
  if (!facts.accessConditions[item.subject.code] || facts.accessConditions[item.subject.code].hasConditions === null) warnings.push("Access conditions are unavailable; check the official handbook.");
  if (check(next).some(issue => issue.subjectCode === item.subject!.code && issue.severity === "info")) warnings.push("Some enrolment conditions require manual verification.");
  return { plan: errors.length ? plan : next, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
