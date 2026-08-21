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

const mapGroup = (group: GroupRecord): DegreeRequirementGroup => {
  const items = group.RequirementItem.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    subject: item.Subject,
    component: item.Component,
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
  };
};

export const mapComponentDetail = (
  university: UniversityRecord,
  handbook: HandbookRecord,
  component: ComponentRecord,
): ComponentDetailResponse => {
  const groupsById = new Map<string, DegreeRequirementGroup>();
  for (const group of component.RequirementGroup) groupsById.set(group.id, mapGroup(group));

  const requirements: DegreeRequirementGroup[] = [];
  for (const group of component.RequirementGroup) {
    const mapped = groupsById.get(group.id);
    if (!mapped) continue;
    const parent = group.parentGroupId ? groupsById.get(group.parentGroupId) : undefined;
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
      handbookYear: handbook.year,
      university: { id: university.id, code: university.code, name: university.name },
    },
    requirements,
  };
};
