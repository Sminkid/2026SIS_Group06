export interface CourseFeeSummary {
  degreeId: string;
  degreeCode: string;
  degreeName: string;
  creditPoints: number | null;
  handbookYear: number;
  universityCode: string;
  universityName: string;
  feeYear: string;
  domesticFee: number | null;
  internationalFee: number | null;
}
