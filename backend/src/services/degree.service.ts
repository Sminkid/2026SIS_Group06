import { mapDegreeDetail } from "../mappers/degree.mapper.js";
import { findDegreeDetailRecord } from "../repositories/degree.repository.js";
import type { DegreeDetailResponse } from "../types/degree.js";
import type { StudyPlanSummary } from "../types/study-plan.js";
import { findDegreeStudyPlansRecord } from "../repositories/study-plan.repository.js";
import { mapStudyPlans } from "../mappers/study-plan.mapper.js";
import { ApiError } from "../utils/api-error.js";
import { getPrisma } from "../db/prisma.js";
import { attachMajorRelationships } from "../mappers/study-plan-relationship.js";

export const getDegreeDetail = async (
  degreeCode: string,
  universityCode: string,
  handbookYear: number,
): Promise<DegreeDetailResponse> => {
  const university = await findDegreeDetailRecord(
    degreeCode,
    universityCode,
    handbookYear,
  );

  if (!university) {
    throw new ApiError(404, `University '${universityCode}' not found`);
  }

  const handbook = university.HandbookVersion[0];
  if (!handbook) {
    throw new ApiError(
      404,
      `No ${handbookYear} handbook found for university '${universityCode}'`,
    );
  }

  const degree = handbook.Degree[0];
  if (!degree) {
    throw new ApiError(
      404,
      `Degree '${degreeCode}' not found in the ${handbookYear} ${universityCode} handbook`,
    );
  }

  return mapDegreeDetail(university, handbook, degree);
};

export const getDegreeStudyPlans = async (
  degreeCode: string,
  universityCode: string,
  handbookYear: number,
): Promise<StudyPlanSummary[]> => {
  const university = await findDegreeStudyPlansRecord(degreeCode, universityCode, handbookYear);
  if (!university) throw new ApiError(404, `University '${universityCode}' not found`);
  const handbook = university.HandbookVersion[0];
  if (!handbook) throw new ApiError(404, `No ${handbookYear} handbook found for university '${universityCode}'`);
  const degree = handbook.Degree[0];
  if (!degree) throw new ApiError(404, `Degree '${degreeCode}' not found in the ${handbookYear} ${universityCode} handbook`);
  const plans = mapStudyPlans(degree.StudyPlan);
  if (universityCode !== "UTS") return plans;
  const detail = await getDegreeDetail(degreeCode, universityCode, handbookYear);
  const flatten = (groups: typeof detail.requirements): typeof detail.requirements =>
    groups.flatMap((group) => [group, ...flatten(group.children)]);
  const ids = flatten(detail.requirements).flatMap((group) => group.items.flatMap((item) =>
    item.component?.type === "MAJOR" ? [item.component.id] : []));
  const majors = await getPrisma().component.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true, RequirementGroup: {
      select: { RequirementItem: { select: { subjectId: true } } },
    } },
  });
  return attachMajorRelationships(plans, majors.map((major) => ({ ...major,
    subjectIds: major.RequirementGroup.flatMap((group) => group.RequirementItem.flatMap((item) =>
      item.subjectId ? [item.subjectId] : [])),
  })));
};
