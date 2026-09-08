import type { SubjectAccessConditions } from "../types/subject";
import type { ValidationResult } from "../types/validation";
import { evaluateBooleanRule } from "./plannerValidation";

export interface PrerequisiteDisplayState {
  kind: "checking" | "unavailable" | "unmet" | "late" | "satisfied" | "none" | "review";
  label: string;
  reasons: string[];
  rawText: string[];
}

/**
 * Distinguishes incomplete handbook data from a known rule the student has not
 * satisfied. Validation issues describe placement; missing references describe
 * data quality. Neither is used as a substitute for the other.
 */
export function getPrerequisiteDisplayState(
  access: SubjectAccessConditions | null | undefined,
  issues: ValidationResult[] = [],
  options: { loading?: boolean; hasPlan?: boolean } = {},
): PrerequisiteDisplayState {
  if (options.loading) return { kind: "checking", label: "Checking prerequisites", reasons: [], rawText: [] };
  const reasons: string[] = [], rawText: string[] = [];
  if (!access || typeof access.hasConditions !== "boolean") reasons.push("The dataset does not confirm this subject's prerequisite information.");
  if (access?.hasConditions && !access.requisiteGroups.length && !access.antiRequisiteGroups.length) reasons.push("The handbook indicates conditions, but their details are unavailable.");
  for (const group of access?.requisiteGroups ?? []) {
    const keys = new Set(group.items.map(item => item.itemKey.toUpperCase()));
    const tokens = group.rule?.toUpperCase().match(/[A-Z0-9_.-]+/g) ?? [];
    if (!group.items.length || (!group.rule && group.items.length > 1)
      || (group.rule && /[^A-Z0-9_.()\s-]/i.test(group.rule))
      || tokens.some(token => !keys.has(token) && token !== "AND" && token !== "OR")
      || evaluateBooleanRule(group.rule, new Map([...keys].map(key => [key, "TRUE" as const]))) === "UNKNOWN") {
      reasons.push("A prerequisite expression cannot be interpreted from the available data.");
      if (group.rule) rawText.push(group.rule);
    }
    for (const item of group.items) {
      if (!item.referencedSubject && !item.referencedComponent && !item.referencedDegree) {
        reasons.push("A referenced prerequisite or enrolment condition has no resolved handbook record.");
        if (item.details) rawText.push(item.details);
        if (Array.isArray(item.rawReferencedCodes)) rawText.push(...item.rawReferencedCodes.filter((code): code is string => typeof code === "string"));
      }
    }
  }
  if (reasons.length) return { kind: "unavailable", label: "Prerequisite information unavailable", reasons: [...new Set(reasons)], rawText: [...new Set(rawText)] };
  const timing = issues.filter(issue => ["PREREQUISITE_TIMING", "COREQUISITE_TIMING"].includes(issue.code));
  if (timing.length) {
    const late = timing.some(issue => /scheduled|completed before/i.test(issue.message));
    return { kind: late ? "late" : "unmet", label: late ? "Prerequisite is scheduled too late" : "Prerequisite not completed", reasons: [], rawText: [] };
  }
  if (access?.hasConditions === false) return { kind: "none", label: "No prerequisites listed", reasons: [], rawText: [] };
  const manual = issues.some(issue => issue.code.includes("NOT_EVALUATED"));
  return { kind: options.hasPlan && !manual ? "satisfied" : "review", label: options.hasPlan && !manual ? "Prerequisites satisfied" : "View prerequisite conditions", reasons: [], rawText: [] };
}

/** Uses student-facing wording without changing the underlying validation result. */
export const requirementIssueText = (message: string): string => message.replace(/^Missing prerequisite:/i, "Prerequisite not completed:").replace(/^Missing corequisite:/i, "Corequisite not completed:");
