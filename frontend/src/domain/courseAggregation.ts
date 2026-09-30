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

  export const otherCourses = (
  recommended: CourseRecommendation[],
  universities: University[],
  degreesByUniversity: Record<string, DegreeSummary[]>,
): CourseRecommendation[] => {
  const used = new Set(recommended.flatMap((course) => course.offerings.map((offering) => offering.degree.id)));
  const groups = new Map<string, CourseRecommendation>();
  for (const university of universities) {
    for (const degree of degreesByUniversity[university.code] ?? []) {
      if (used.has(degree.id)) continue;
      const key = degree.name.trim().toLowerCase();
      const group = groups.get(key) ?? { courseName: degree.name.trim(), offerings: [] };
      group.offerings.push({ university, degree });
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.courseName.localeCompare(b.courseName));
};

export const filterCourses = (courses: CourseRecommendation[], query: string): CourseRecommendation[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return courses;
  return courses.filter((course) =>
    course.courseName.toLowerCase().includes(normalized) ||
    course.offerings.some(({ degree }) =>
      degree.code.toLowerCase().includes(normalized) || degree.name.toLowerCase().includes(normalized)));
};