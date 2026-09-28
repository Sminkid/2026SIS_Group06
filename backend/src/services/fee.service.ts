import { findCourseFees } from "../repositories/fee.repository.js";
import type { CourseFeeSummary } from "../types/fee.js";

type CourseFeeRow = Awaited<ReturnType<typeof findCourseFees>>[number];

/** Flattens a fee row and its degree, handbook and university into the shape the comparison page reads. */
export const toCourseFeeSummary = ({ Degree: degree, ...fee }: CourseFeeRow): CourseFeeSummary => ({
  degreeId: degree.id,
  degreeCode: degree.code,
  degreeName: degree.name,
  creditPoints: degree.creditPoints,
  handbookYear: degree.HandbookVersion.year,
  universityCode: degree.HandbookVersion.University.code,
  universityName: degree.HandbookVersion.University.name,
  feeYear: fee.feeYear,
  domesticFee: fee.domesticFee,
  internationalFee: fee.internationalFee,
});

export const getCourseFees = async (): Promise<CourseFeeSummary[]> =>
  (await findCourseFees()).map(toCourseFeeSummary);
