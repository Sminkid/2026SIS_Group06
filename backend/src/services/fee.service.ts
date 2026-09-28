import { findCourseFees } from "../repositories/fee.repository.js";
import type { CourseFeeSummary } from "../types/fee.js";

export const getCourseFees = async (): Promise<CourseFeeSummary[]> => {
  const fees = await findCourseFees();

  return fees.map(({ Degree: degree, ...fee }) => ({
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
  }));
};
