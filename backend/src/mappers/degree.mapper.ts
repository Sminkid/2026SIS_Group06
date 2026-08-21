import type { DegreeDetailRecord } from "../repositories/degree.repository.js";
import type {
  DegreeDetailResponse,
  DegreeRequirementGroup,
} from "../types/degree.js";

type UniversityRecord = NonNullable<DegreeDetailRecord>;
type HandbookRecord = UniversityRecord["HandbookVersion"][number];
type DegreeRecord = HandbookRecord["Degree"][number];
type GroupRecord = DegreeRecord["RequirementGroup"][number];

const compareSortOrder = <T extends { id: string; sortOrder: number | null }>(
  left: T,
  right: T,
): number => {
  if (left.sortOrder === null && right.sortOrder !== null) return 1;
  if (left.sortOrder !== null && right.sortOrder === null) return -1;
  const orderDifference = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
  return orderDifference || left.id.localeCompare(right.id);
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
  items.sort(compareSortOrder);

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

export const mapDegreeDetail = (
  university: UniversityRecord,
  handbook: HandbookRecord,
  degree: DegreeRecord,
): DegreeDetailResponse => {
  const groupsById = new Map<string, DegreeRequirementGroup>();

  for (const group of degree.RequirementGroup) {
    groupsById.set(group.id, mapGroup(group));
  }

  const requirements: DegreeRequirementGroup[] = [];

  for (const group of degree.RequirementGroup) {
    const mappedGroup = groupsById.get(group.id);
    if (!mappedGroup) continue;

    const parent = group.parentGroupId
      ? groupsById.get(group.parentGroupId)
      : undefined;

    if (parent) {
      parent.children.push(mappedGroup);
    } else {
      requirements.push(mappedGroup);
    }
  }

  for (const group of groupsById.values()) {
    group.children.sort(compareSortOrder);
  }
  requirements.sort(compareSortOrder);

  return {
    degree: {
      id: degree.id,
      code: degree.code,
      name: degree.name,
      creditPoints: degree.creditPoints,
      handbookYear: handbook.year,
      university: {
        id: university.id,
        code: university.code,
        name: university.name,
      },
      description: degree.description,
    },
    requirements,
  };
};
