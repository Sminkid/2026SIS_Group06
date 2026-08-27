import type { ComponentDetailRecord } from "../repositories/component.repository.js";
import type { ComponentDetailResponse } from "../types/component.js";
import type { DegreeRequirementGroup } from "../types/degree.js";

type UniversityRecord = NonNullable<ComponentDetailRecord>;
type HandbookRecord = UniversityRecord["HandbookVersion"][number];
type ComponentRecord = HandbookRecord["Component"][number];
type GroupRecord = ComponentRecord["RequirementGroup"][number];

const compareOrder = <T extends { id: string; sortOrder: number | null }>(left: T, right: T) => {
  if (left.sortOrder === null && right.sortOrder !== null) return 1;
  if (left.sortOrder !== null && right.sortOrder === null) return -1;
  return (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id.localeCompare(right.id);
};

const normalizedText = (value: string | null): string =>
  (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const itemFingerprint = (item: GroupRecord["RequirementItem"][number]): string => [
  item.itemType,
  item.Subject?.id ?? "",
  item.Component?.id ?? "",
  normalizedText(item.rawCode),
  normalizedText(item.rawName),
  item.creditPoints ?? "",
].join("|");

const statusRank = (status: GroupRecord["status"]): number =>
  status === "AUTHORITATIVE" ? 0 : status === "RAW_FALLBACK" ? 2 : 1;

const mapGroup = (group: GroupRecord): DegreeRequirementGroup => {
  const uniqueItems = [...new Map(group.RequirementItem.map((item) => [itemFingerprint(item), item])).values()];
  const items: DegreeRequirementGroup["items"] = uniqueItems.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    subject: item.Subject,
    component: item.Component ? {
      ...item.Component,
      displayCode: item.Component.code.split(":").length >= 4 ? null : item.Component.code,
      creditPoints: item.creditPoints ?? item.Component.creditPoints,
      creditPointsAvailability: item.creditPoints !== null
        ? "EXPLICIT_RELATIONSHIP"
        : item.Component.creditPoints !== null ? "EXPLICIT_COMPONENT" : "UNAVAILABLE",
    } : null,
    rawCode: item.rawCode,
    rawName: item.rawName,
    creditPoints: item.creditPoints,
    sortOrder: item.sortOrder,
  }));
  items.sort(compareOrder);
  return {
    id: group.id,
    title: group.title,
    description: group.description,
    logic: group.logic,
    requiredCreditPoints: group.requiredCreditPoints,
    maximumCreditPoints: group.maximumCreditPoints,
    sortOrder: group.sortOrder,
    items,
    children: [],
    pathways: [],
  };
};

export const mapComponentDetail = (
  university: UniversityRecord,
  handbook: HandbookRecord,
  component: ComponentRecord,
): ComponentDetailResponse => {
  const sourceGroupsById = new Map(component.RequirementGroup.map((group) => [group.id, group]));
  const childrenByParent = new Map<string, GroupRecord[]>();
  for (const group of component.RequirementGroup) {
    if (!group.parentGroupId || !sourceGroupsById.has(group.parentGroupId)) continue;
    childrenByParent.set(group.parentGroupId, [...(childrenByParent.get(group.parentGroupId) ?? []), group]);
  }
  const fingerprint = (group: GroupRecord): string => {
    const items = [...new Set(group.RequirementItem.map(itemFingerprint))].sort();
    const children = (childrenByParent.get(group.id) ?? []).map(fingerprint).sort();
    return JSON.stringify([
      normalizedText(group.title), group.logic,
      group.requiredCreditPoints, group.maximumCreditPoints, items, children,
    ]);
  };
  const canonicalByFingerprint = new Map<string, GroupRecord>();
  for (const group of [...component.RequirementGroup].sort((left, right) => statusRank(left.status) - statusRank(right.status) || compareOrder(left, right))) {
    const key = fingerprint(group);
    if (!canonicalByFingerprint.has(key)) canonicalByFingerprint.set(key, group);
  }
  const canonicalGroups = [...canonicalByFingerprint.values()];
  const canonicalForId = new Map(component.RequirementGroup.map((group) => [
    group.id,
    canonicalByFingerprint.get(fingerprint(group)),
  ]));
  const groupsById = new Map<string, DegreeRequirementGroup>();
  for (const group of canonicalGroups) groupsById.set(group.id, mapGroup(group));

  const requirements: DegreeRequirementGroup[] = [];
  for (const group of canonicalGroups) {
    const mapped = groupsById.get(group.id);
    if (!mapped) continue;
    const canonicalParent = group.parentGroupId ? canonicalForId.get(group.parentGroupId) : undefined;
    const parent = canonicalParent && canonicalParent.id !== group.id
      ? groupsById.get(canonicalParent.id)
      : undefined;
    if (parent) parent.children.push(mapped);
    else requirements.push(mapped);
  }
  for (const group of groupsById.values()) group.children.sort(compareOrder);
  requirements.sort(compareOrder);

  return {
    component: {
      id: component.id,
      code: component.code,
      name: component.name,
      type: component.type,
      originalType: component.originalType,
      creditPoints: component.creditPoints,
      sourceUrl: component.sourceUrl,
      handbookYear: handbook.year,
      university: { id: university.id, code: university.code, name: university.name },
    },
    requirements,
  };
};
