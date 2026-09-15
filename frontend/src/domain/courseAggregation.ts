import type { DegreeSummary, University } from "../types/handbook";

export interface CourseRecommendation {
  courseName: string; // the matched keyword, used as the "course" identity
  offerings: Array<{ university: University; degree: DegreeSummary }>;
}

export const matchCourses = (
  keywords: string[],
  universities: University[],
  degreesByUniversity: Record<string, DegreeSummary[]>,
): CourseRecommendation[] =>
  keywords.map((keyword) => {
    const normalized = keyword.toLowerCase();
    const offerings = universities.flatMap((university) => {
      const match = (degreesByUniversity[university.code] ?? []).find((degree) =>
        degree.name.toLowerCase().includes(normalized));
      return match ? [{ university, degree: match }] : [];
    });
    return { courseName: keyword, offerings };
  }).filter((course) => course.offerings.length > 0);