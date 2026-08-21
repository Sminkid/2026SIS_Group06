import { mapDegreeDetail } from "../mappers/degree.mapper.js";
import { findDegreeDetailRecord } from "../repositories/degree.repository.js";
import type { DegreeDetailResponse } from "../types/degree.js";
import type { StudyPlanSummary } from "../types/study-plan.js";
import { findDegreeStudyPlansRecord } from "../repositories/study-plan.repository.js";
import { mapStudyPlans } from "../mappers/study-plan.mapper.js";
import { ApiError } from "../utils/api-error.js";

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
  return mapStudyPlans(degree.StudyPlan);
};
