import type { DegreeRequirementGroup } from "../types/degree.js";

type Subject = NonNullable<DegreeRequirementGroup["items"][number]["subject"]>;
export const missingSubjectCodes = (groups: DegreeRequirementGroup[]): string[] => [...new Set(groups.flatMap((group) => [
  ...group.items.flatMap((item) => item.itemType === "SUBJECT" && !item.subject && /^(?:[A-Z]{2,6})?\d{4,6}$/.test(item.rawCode?.trim() ?? "") ? [item.rawCode!.trim()] : []),
  ...missingSubjectCodes(group.children),
]))];

/** Only verified records from the same university/handbook are supplied here.
 * Never manufacture subject identities from handbook prose. */
export const resolveSubjectReferences = (groups: DegreeRequirementGroup[], subjects: Subject[]): DegreeRequirementGroup[] =>
  groups.map((group) => ({ ...group, items: group.items.map((item) => {
    if (item.subject || item.itemType !== "SUBJECT") return item;
    const matches = subjects.filter((subject) => subject.code === item.rawCode?.trim());
    return matches.length === 1 ? { ...item, subject: matches[0]! } : item;
  }), children: resolveSubjectReferences(group.children, subjects) }));
