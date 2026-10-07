import type { ComponentDetailResponse, RequirementGroup, RequirementSubject } from "../types/handbook";
import { usydGroups } from "./usydEngineeringPlanner";

export interface UsydRequirementProgress {
  group: RequirementGroup; selectedCreditPoints: number; creditedCreditPoints: number;
  targetCreditPoints: number | null; state: "empty" | "partial" | "met" | "manual";
  reason?: string;
}

/** A CP overlay over unique selected subjects. It never adds capacity to a personal plan. */
export function usydEngineeringProgress(detail: ComponentDetailResponse, selected: RequirementSubject[]) {
  const unique = new Map(selected.map(subject => [subject.code, subject]));
  const counted = new Set<string>();
  let overlap = false;
  const rows: UsydRequirementProgress[] = usydGroups(detail.requirements).filter(g => g.items.length > 0 || !g.children.length).map(group => {
    const subjects = [...new Map(group.items.flatMap(item => item.subject ? [[item.subject.code, item.subject] as const] : [])).values()];
    const planned = subjects.filter(subject => unique.has(subject.code));
    planned.forEach(subject => { if (counted.has(subject.code)) overlap = true; counted.add(subject.code); });
    const points = planned.reduce((sum, subject) => sum + (unique.get(subject.code)?.creditPoints ?? 0), 0);
    const allPoints = subjects.reduce((sum, subject) => sum + (subject.creditPoints ?? 0), 0);
    const target = group.requiredCreditPoints ?? (group.logic === "ALL" && subjects.length ? allPoints : null);
    const incomplete = group.logic === "UNKNOWN" || group.candidateSources.length > 0 || group.children.length > 0
      || group.items.some(item => !item.subject || item.subject.creditPoints === null)
      || planned.some(subject => unique.get(subject.code)?.creditPoints !== subject.creditPoints)
      || target === null || !group.items.length || (group.maximumCreditPoints !== null && target > group.maximumCreditPoints)
      || (group.logic === "ALL" && target !== allPoints);
    if (incomplete) return { group, selectedCreditPoints: points, creditedCreditPoints: 0, targetCreditPoints: target,
      state: "manual", reason: "This rule is not fully structured. Membership CP is shown; completion needs handbook verification." };
    // Evaluate whole subjects against explicit bounds; an extra eligible subject is not extra requirement CP.
    const maximum = group.maximumCreditPoints ?? target;
    let possible = new Set([0]);
    if (group.logic === "ONE_OF") possible = new Set([0, ...planned.map(subject => subject.creditPoints!)]);
    else for (const subject of planned) possible = new Set([...possible, ...[...possible].map(cp => cp + subject.creditPoints!).filter(cp => cp <= maximum)]);
    const credited = Math.max(...[...possible].filter(cp => cp <= maximum));
    const met = group.logic === "ALL" ? planned.length === subjects.length : [...possible].some(cp => cp >= target && cp <= maximum);
    return { group, selectedCreditPoints: points, creditedCreditPoints: Math.min(credited, target), targetCreditPoints: target,
      state: met ? "met" : points > 0 ? "partial" : "empty" };
  });
  const observed = [...counted].reduce((sum, code) => sum + (unique.get(code)?.creditPoints ?? 0), 0);
  const manual = overlap || !rows.length || rows.some(row => row.state === "manual");
  const target = detail.component.creditPoints ?? (!manual ? rows.reduce((sum, row) => sum + row.targetCreditPoints!, 0) : null);
  const inconsistentTotal = target !== null && !manual && rows.reduce((sum, row) => sum + row.targetCreditPoints!, 0) !== target;
  return { rows, observedCreditPoints: observed, targetCreditPoints: target,
    creditedCreditPoints: manual || inconsistentTotal ? null : rows.reduce((sum, row) => sum + row.creditedCreditPoints, 0),
    state: manual || inconsistentTotal ? "manual" : rows.every(row => row.state === "met") ? "met" : observed > 0 ? "partial" : "empty",
    overlap };
}
