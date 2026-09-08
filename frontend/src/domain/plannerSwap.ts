import type { PlannerItem, PlannerState } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";
import { evaluateBooleanRule, validatePlanner } from "./plannerValidation";

export const plannerItems = (plan: PlannerState) => plan.years.flatMap((year) => year.periods.flatMap((period) => period.items));
export const isCustomPosition = (item: PlannerItem) => Boolean(item.choiceOrigin)
  && !item.scheduleLocked && !(item.numberOfPeriods && item.numberOfPeriods > 1)
  && item.choiceOrigin?.componentRequirementKind !== "FIXED"
  && !/\b(internship|placement|practicum|professional experience)\b/i.test(`${item.choiceOrigin?.title ?? ""} ${item.title}`);

export interface SwapFacts {
  accessConditions: Record<string, SubjectAccessConditions>;
  /** Absence means unknown, never unrestricted/verified. */
  offeredPeriods?: Record<string, string[]>;
}

const exchange = (plan: PlannerState, source: PlannerItem, target: PlannerItem): PlannerState => ({ ...plan,
  years: plan.years.map((year) => ({ ...year, periods: year.periods.map((period) => ({ ...period,
    items: period.items.map((item) => item.plannerItemId === source.plannerItemId
      ? { ...target, schedulePositionId: source.schedulePositionId ?? source.plannerItemId }
      : item.plannerItemId === target.plannerItemId ? { ...source, schedulePositionId: target.schedulePositionId ?? target.plannerItemId } : item),
  })) })),
});

export const proposeSwap = (plan: PlannerState, sourceId: string, targetId: string, facts: SwapFacts) => {
  const errors: string[] = [], warnings: string[] = [];
  const all = plannerItems(plan);
  const source = all.find((item) => item.plannerItemId === sourceId);
  const target = all.find((item) => item.plannerItemId === targetId);
  if (!source || !target || sourceId === targetId) errors.push("Choose two different positions within this plan.");
  if (source && !source.subject) errors.push("Start a swap from a selected subject.");
  if ([source, target].some((item) => item && !isCustomPosition(item))) errors.push("Official fixed subjects, placements and multi-session items are locked.");
  const codes = [...all, ...plan.unassignedItems].flatMap((item) => item.subject ? [item.subject.code] : []);
  if (new Set(codes).size !== codes.length) errors.push("Remove duplicate subjects before swapping positions.");
  if (errors.length || !source || !target) return { plan, errors, warnings };
  const next = exchange(plan, source, target);
  for (const year of next.years) for (const period of year.periods) {
    const moved = period.items.filter((item) => item.plannerItemId === sourceId || item.plannerItemId === targetId);
    if (!moved.length) continue;
    const cp = period.items.reduce((sum, item) => sum + (item.subject?.creditPoints ?? 0), 0);
    if (period.maximumCreditPoints !== undefined && cp > period.maximumCreditPoints) errors.push(`${year.name} ${period.name}: ${cp} CP exceeds the ${period.maximumCreditPoints} CP session limit.`);
    else if (period.maximumCreditPoints === undefined) warnings.push(`${year.name} ${period.name}: ${cp} CP scheduled; a hard workload limit is not supplied.`);
    for (const item of moved) {
      if (item.allowedPeriodIds && !item.allowedPeriodIds.includes(period.officialPeriodId)) errors.push(`${item.title} is restricted to a different official period.`);
      if (!item.subject) continue;
      const offered = facts.offeredPeriods?.[item.subject.code];
      const normalize = (value: string) => value.toLowerCase().replace(/\s+session$/, "").trim();
      if (offered && !offered.some((value) => normalize(value) === normalize(period.name))) errors.push(`${item.subject.code} is not offered in ${period.name}.`);
      if (!offered) warnings.push(`${item.subject.code}: session availability is unverified.`);
      if (!facts.accessConditions[item.subject.code] || facts.accessConditions[item.subject.code].hasConditions === null) warnings.push(`${item.subject.code}: prerequisite and sequencing information is unavailable.`);
    }
  }
  const known: Record<string, SubjectAccessConditions> = {};
  for (const [code, access] of Object.entries(facts.accessConditions)) {
    const exact = (group: SubjectAccessConditions["requisiteGroups"][number]) => group.items.every((item) => item.referencedSubject)
      && evaluateBooleanRule(group.rule, new Map(group.items.map((item) => [item.itemKey.toUpperCase(), "TRUE" as const]))) !== "UNKNOWN";
    known[code] = { ...access, requisiteGroups: access.requisiteGroups.filter(exact), antiRequisiteGroups: access.antiRequisiteGroups.filter(exact) };
    if (access.requisiteGroups.some((group) => !exact(group)) || access.antiRequisiteGroups.some((group) => !exact(group))) warnings.push(`${code}: some enrolment rules need manual verification.`);
  }
  const check = (planner: PlannerState) => validatePlanner({ planner, degreeCreditPoints: null, requirements: [], selectedComponents: {}, accessConditions: known }).results;
  const key = (issue: ReturnType<typeof check>[number]) => `${issue.code}:${issue.subjectCode}:${issue.message}`;
  const before = new Set(check(plan).map(key));
  const movedCodes = new Set([source.subject?.code, target.subject?.code]);
  for (const issue of check(next)) {
    if (!["PREREQUISITE_TIMING", "COREQUISITE_TIMING", "ANTI_REQUISITE_CONFLICT"].includes(issue.code)) continue;
    if (!before.has(key(issue)) || movedCodes.has(issue.subjectCode)) errors.push(`${issue.subjectCode ?? "Subject"}: ${issue.message}`);
    else warnings.push(`Existing issue — ${issue.subjectCode ?? "Subject"}: ${issue.message}`);
  }
  warnings.push("Check any course-specific commencement, capstone and recommended sequencing rules not supplied by the handbook data.");
  return { plan: errors.length ? plan : next, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
};
