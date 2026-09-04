import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { RequirementGroup } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import type { SubjectAccessConditionGroup, SubjectAccessConditions, SubjectSearchResult } from "../types/subject";
import type { PlannerValidation, RequirementProgress, ValidationResult } from "../types/validation";

interface Input {
  degreeCreditPoints: number | null;
  requirements: RequirementGroup[];
  selectedComponents: ComponentSelections;
  planner: PlannerState;
  accessConditions: Record<string, SubjectAccessConditions>;
}

interface Placement { subjectCode: string; subjectName: string; creditPoints: number | null; periodIndex: number | null; }

const addManualVerificationInfo = (
  results: ValidationResult[],
  subjectCode: string,
  group: SubjectAccessConditionGroup,
) => results.push({
  severity: "info",
  code: "CONDITION_NOT_EVALUATED",
  subjectCode,
  message: "Some enrollment conditions require manual verification.",
});

const requirementProgress = (
  groups: RequirementGroup[],
  plannedCodes: Set<string>,
  selectedCodes: Set<string>,
): RequirementProgress[] => {
  const progress: RequirementProgress[] = [];

  const visit = (group: RequirementGroup): { points: number; determinable: boolean } => {
    const children = group.children.map(visit);
    const itemsDeterminable = group.items.every((item) =>
      (item.itemType === "SUBJECT" && item.subject !== null)
      || (item.itemType === "COMPONENT" && item.component !== null));
    const childrenDeterminable = children.every((child) => child.determinable);
    let points = group.items.reduce((total, item) => {
      if (item.subject && plannedCodes.has(item.subject.code)) {
        return total + (item.creditPoints ?? item.subject.creditPoints ?? 0);
      }
      if (item.component && selectedCodes.has(item.component.code)) {
        return total + (item.creditPoints ?? item.component.creditPoints ?? 0);
      }
      return total;
    }, 0) + children.reduce((total, child) => total + child.points, 0);

    const determinable = group.logic !== "UNKNOWN" && itemsDeterminable && childrenDeterminable;
    if (group.requiredCreditPoints !== null && group.requiredCreditPoints > 0 && determinable) {
      points = Math.min(points, group.requiredCreditPoints);
      progress.push({
        requirementGroupId: group.id,
        title: group.title ?? "Untitled requirement",
        plannedCreditPoints: points,
        requiredCreditPoints: group.requiredCreditPoints,
        complete: points >= group.requiredCreditPoints,
      });
    }
    return { points, determinable };
  };

  groups.forEach(visit);
  return progress;
};

const validateMissingComponents = (
  groups: RequirementGroup[],
  selections: ComponentSelections,
  results: ValidationResult[],
) => {
  for (const group of groups) {
    const componentItems = group.items.filter((item) => item.itemType === "COMPONENT");
    const isRequiredChoice = group.logic === "ONE_OF"
      && componentItems.length > 1
      && componentItems.length === group.items.length;
    const selectedCode = selections[group.id];
    if (isRequiredChoice && !componentItems.some((item) => item.component?.code === selectedCode)) {
      results.push({
        severity: "warning",
        code: "MISSING_COMPONENT_SELECTION",
        requirementGroupId: group.id,
        message: `Select one component for ${group.title ?? "this requirement"}.`,
      });
    }
    validateMissingComponents(group.children, selections, results);
  }
};

const validateRequisiteGroup = (
  target: Placement,
  group: SubjectAccessConditionGroup,
  placementsByCode: Map<string, Placement[]>,
  results: ValidationResult[],
) => {
  const itemValues = new Map<string, TruthValue>();
  const unknownItems = group.items.filter((item) => item.referencedSubject === null);
  const hasAdmission = unknownItems.some((item) => {
    const type = item.requisiteType?.toLowerCase() ?? "";
    return type.includes("admission") || item.referencedDegree !== null || item.referencedComponent !== null;
  });
  const unsatisfied: Array<{ code: string; name: string; present: boolean; samePeriod: boolean; later: boolean; corequisite: boolean }> = [];
  for (const item of group.items) {
    const prerequisite = item.referencedSubject;
    if (!prerequisite) {
      itemValues.set(item.itemKey.toUpperCase(), "UNKNOWN");
      continue;
    }
    const placements = placementsByCode.get(prerequisite.code) ?? [];
    const isCorequisite = item.requisiteType?.toLowerCase().includes("corequisite") ?? false;
    const satisfied = target.periodIndex !== null && placements.some((placement) =>
      placement.periodIndex !== null && (isCorequisite
        ? placement.periodIndex <= target.periodIndex!
        : placement.periodIndex < target.periodIndex!));
    itemValues.set(item.itemKey.toUpperCase(), satisfied ? "TRUE" : "FALSE");
    if (!satisfied) unsatisfied.push({
      code: prerequisite.code, name: prerequisite.name, present: placements.length > 0, corequisite: isCorequisite,
      samePeriod: placements.some((placement) => placement.periodIndex === target.periodIndex),
      later: placements.some((placement) => placement.periodIndex !== null && target.periodIndex !== null && placement.periodIndex > target.periodIndex),
    });
  }
  const satisfied = evaluateBooleanRule(group.rule, itemValues);
  if (satisfied === "FALSE" || (satisfied === "UNKNOWN" && unsatisfied.length > 0)) {
    const actionable = unsatisfied.filter((prerequisite) => {
      const matchingItem = group.items.find((item) => item.referencedSubject?.code === prerequisite.code);
      if (!matchingItem) return false;
      const hypothetical = new Map(itemValues);
      hypothetical.set(matchingItem.itemKey.toUpperCase(), "TRUE");
      return evaluateBooleanRule(group.rule, hypothetical) !== "FALSE";
    });
    const reported = actionable.length > 0 ? actionable : unsatisfied;
    if (reported.length > 1 && group.rule?.toUpperCase().includes("OR") && reported.every((item) => !item.present)) {
      results.push({
        severity: "warning", code: "PREREQUISITE_TIMING", subjectCode: target.subjectCode,
        message: `Missing prerequisite: either ${reported.map((item) => `${item.code} ${item.name}`).join(" or ")}.`,
      });
    } else {
      for (const prerequisite of reported) {
        results.push({
          severity: "warning",
          code: prerequisite.corequisite ? "COREQUISITE_TIMING" : "PREREQUISITE_TIMING",
          subjectCode: target.subjectCode,
          message: prerequisite.present
            ? prerequisite.samePeriod && !prerequisite.corequisite
              ? `Prerequisite must be completed before this subject: ${prerequisite.code} ${prerequisite.name}.`
              : `${prerequisite.corequisite ? "Corequisite" : "Prerequisite"} scheduled ${prerequisite.later ? "after this subject" : "too late"}: ${prerequisite.code} ${prerequisite.name}.`
            : `Missing ${prerequisite.corequisite ? "corequisite" : "prerequisite"}: ${prerequisite.code} ${prerequisite.name}.`,
        });
      }
    }
  }
  if (unknownItems.length > 0 || satisfied === "UNKNOWN") {
    results.push({
      severity: "info",
      code: hasAdmission ? "ADMISSION_CONDITION_NOT_EVALUATED" : "CONDITION_NOT_EVALUATED",
      subjectCode: target.subjectCode,
      message: hasAdmission
        ? (group.items.length === unknownItems.length
          ? "Admission condition applies — check details."
          : "An additional admission or enrollment condition requires manual verification.")
        : "Some enrollment conditions require manual verification.",
    });
  }
};

export const validateSubjectCandidate = (
  planner: PlannerState,
  plannerItemId: string,
  subject: SubjectSearchResult,
  access: SubjectAccessConditions | undefined,
): ValidationResult[] => {
  const candidatePlanner: PlannerState = {
    ...planner,
    years: planner.years.map((year) => ({ ...year, periods: year.periods.map((period) => ({
      ...period,
      items: period.items.map((item) => item.plannerItemId === plannerItemId ? {
        ...item, itemType: "SUBJECT" as const,
        subject: { officialSubjectId: subject.id, code: subject.code, name: subject.name, creditPoints: subject.creditPoints },
      } : item),
    })) })),
  };
  return validatePlanner({
    degreeCreditPoints: null, requirements: [], selectedComponents: {}, planner: candidatePlanner,
    accessConditions: access ? { [subject.code]: access } : {},
  }).results.filter((result) => result.subjectCode === subject.code && result.code !== "UNSCHEDULED_SUBJECT");
};

type TruthValue = "TRUE" | "FALSE" | "UNKNOWN";
const and = (left: TruthValue, right: TruthValue): TruthValue =>
  left === "FALSE" || right === "FALSE" ? "FALSE" : left === "TRUE" && right === "TRUE" ? "TRUE" : "UNKNOWN";
const or = (left: TruthValue, right: TruthValue): TruthValue =>
  left === "TRUE" || right === "TRUE" ? "TRUE" : left === "FALSE" && right === "FALSE" ? "FALSE" : "UNKNOWN";

export const evaluateBooleanRule = (rule: string | null, values: Map<string, TruthValue>): TruthValue => {
  if (!rule?.trim()) return [...values.values()].reduce<TruthValue>(and, "TRUE");
  const tokens = rule.toUpperCase().match(/\(|\)|\bAND\b|\bOR\b|[A-Z0-9_.-]+/g);
  if (!tokens) return "UNKNOWN";
  let index = 0;
  const primary = (): TruthValue => {
    const token = tokens[index++];
    if (!token) return "UNKNOWN";
    if (token === "(") {
      const value = orExpression();
      if (tokens[index++] !== ")") return "UNKNOWN";
      return value;
    }
    return values.get(token) ?? "UNKNOWN";
  };
  const andExpression = (): TruthValue => {
    let value = primary();
    while (tokens[index] === "AND") {
      index += 1; const right = primary();
      value = and(value, right);
    }
    return value;
  };
  const orExpression = (): TruthValue => {
    let value = andExpression();
    while (tokens[index] === "OR") {
      index += 1; const right = andExpression();
      value = or(value, right);
    }
    return value;
  };
  const result = orExpression();
  return index === tokens.length ? result : "UNKNOWN";
};

const validateAntiRequisiteGroup = (
  target: Placement,
  group: SubjectAccessConditionGroup,
  plannedCodes: Set<string>,
  results: ValidationResult[],
) => {
  const referenced = group.items.flatMap((item) => item.referencedSubject ? [item.referencedSubject] : []);
  if (referenced.length !== group.items.length) {
    addManualVerificationInfo(results, target.subjectCode, group);
    return;
  }
  const values = new Map<string, TruthValue>(group.items.map((item) => [
    item.itemKey.toUpperCase(),
    item.referencedSubject ? (plannedCodes.has(item.referencedSubject.code) ? "TRUE" : "FALSE") : "UNKNOWN",
  ]));
  const conflictApplies = evaluateBooleanRule(group.rule, values);
  if (conflictApplies === "UNKNOWN") {
    addManualVerificationInfo(results, target.subjectCode, group);
    return;
  }
  const conflicts = referenced.filter((subject) => plannedCodes.has(subject.code));
  if (conflictApplies === "TRUE") {
    results.push({
      severity: "warning",
      code: "ANTI_REQUISITE_CONFLICT",
      subjectCode: target.subjectCode,
      message: `Anti-requisite conflict: ${conflicts.map((subject) => `${subject.code} ${subject.name}`).join(", ")}.`,
    });
  }
};

export const validatePlanner = ({
  degreeCreditPoints,
  requirements,
  selectedComponents,
  planner,
  accessConditions,
}: Input): PlannerValidation => {
  const results: ValidationResult[] = [];
  const placements: Placement[] = [];
  let periodIndex = 0;
  const orderedYears = planner.years.map((year, index) => ({ year, index })).sort((left, right) =>
    (left.year.officialSortOrder ?? left.index) - (right.year.officialSortOrder ?? right.index));
  for (const { year } of orderedYears) {
    const orderedPeriods = year.periods.map((period, index) => ({ period, index })).sort((left, right) =>
      (left.period.officialSortOrder ?? left.index) - (right.period.officialSortOrder ?? right.index));
    for (const { period } of orderedPeriods) {
      for (const item of period.items) {
        if (item.subject) placements.push({
          subjectCode: item.subject.code,
          subjectName: item.subject.name,
          creditPoints: item.subject.creditPoints ?? item.creditPoints,
          periodIndex,
        });
      }
      periodIndex += 1;
    }
  }
  for (const item of planner.unassignedItems) {
    if (!item.subject) continue;
    placements.push({
      subjectCode: item.subject.code,
      subjectName: item.subject.name,
      creditPoints: item.subject.creditPoints ?? item.creditPoints,
      periodIndex: null,
    });
    results.push({
      severity: "warning",
      code: "UNSCHEDULED_SUBJECT",
      subjectCode: item.subject.code,
      message: `${item.subject.code} ${item.subject.name} is not assigned to a study period.`,
    });
  }

  const placementsByCode = new Map<string, Placement[]>();
  for (const placement of placements) {
    const existing = placementsByCode.get(placement.subjectCode) ?? [];
    existing.push(placement);
    placementsByCode.set(placement.subjectCode, existing);
  }

  for (const [code, subjectPlacements] of placementsByCode) {
    if (subjectPlacements.length > 1) results.push({
      severity: "error",
      code: "DUPLICATE_SUBJECT",
      subjectCode: code,
      message: `${code} appears ${subjectPlacements.length} times in the plan.`,
    });
  }

  const uniquePlacements = [...placementsByCode.values()].map((items) => items[0]!);
  const plannedCodes = new Set(placementsByCode.keys());
  const totalPlannedCreditPoints = uniquePlacements.reduce(
    (total, placement) => total + (placement.creditPoints ?? 0),
    0,
  );

  validateMissingComponents(requirements, selectedComponents, results);

  for (const target of uniquePlacements) {
    if (target.periodIndex === null) continue;
    const access = accessConditions[target.subjectCode];
    if (!access) continue;
    access.requisiteGroups.forEach((group) =>
      validateRequisiteGroup(target, group, placementsByCode, results));
    access.antiRequisiteGroups.forEach((group) =>
      validateAntiRequisiteGroup(target, group, plannedCodes, results));
  }

  const selectedCodes = new Set(Object.values(selectedComponents));
  const progress = requirementProgress(requirements, plannedCodes, selectedCodes);
  const errorCount = results.filter((result) => result.severity === "error").length;
  const warningCount = results.filter((result) => result.severity === "warning").length;
  const infoCount = results.filter((result) => result.severity === "info").length;

  return {
    totalPlannedCreditPoints,
    degreeCreditPoints,
    degreeProgressPercent: degreeCreditPoints && degreeCreditPoints > 0
      ? Math.min(100, Math.round((totalPlannedCreditPoints / degreeCreditPoints) * 100))
      : null,
    requirementProgress: progress,
    results,
    errorCount,
    warningCount,
    infoCount,
  };
};
