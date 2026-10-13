import type { DegreeSummary, University } from "../types/handbook";
import { classifyDegree } from "./degreeClassification";

export interface CourseOffering { university: University; degree: DegreeSummary; variant: string | null; }

export interface CourseRecommendation {
  courseKey: string; // canonical identity shared by equivalent degrees, see classifyDegree
  courseName: string;
  /** Every matching degree, standard offerings before delivery variants such as "Offshore". */
  offerings: CourseOffering[];
}

/** Counts universities, not degrees, so a university's offshore or co-op variants don't inflate the number. */
export const universityCount = (course: CourseRecommendation): number =>
  new Set(course.offerings.map((offering) => offering.university.id)).size;

/** The offering shown for each university: its standard degree where it has one. */
export const primaryOfferings = (course: CourseRecommendation): CourseOffering[] => {
  const byUniversity = new Map<string, CourseOffering>();
  for (const offering of course.offerings) {
    if (!byUniversity.has(offering.university.id)) byUniversity.set(offering.university.id, offering);
  }
  return [...byUniversity.values()];
};

export const groupCourses = (
  universities: University[],
  degreesByUniversity: Record<string, DegreeSummary[]>,
): Map<string, CourseRecommendation> => {
  const groups = new Map<string, CourseRecommendation>();
  for (const university of universities) {
    for (const degree of degreesByUniversity[university.code] ?? []) {
      const { key, displayName, variant } = classifyDegree(degree.name);
      const group = groups.get(key) ?? { courseKey: key, courseName: displayName, offerings: [] };
      group.offerings.push({ university, degree, variant });
      groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    group.offerings.sort((a, b) => Number(a.variant !== null) - Number(b.variant !== null));
  }
  return groups;
};

/** Recommended degree names, each resolved to its cross-university course in recommendation order. */
export const matchCourses = (keywords: string[], courses: Map<string, CourseRecommendation>): CourseRecommendation[] => {
  const keys = [...new Set(keywords.map((keyword) => classifyDegree(keyword).key))];
  return keys.flatMap((key) => courses.get(key) ?? []);
};

export const otherCourses = (
  recommended: CourseRecommendation[],
  courses: Map<string, CourseRecommendation>,
): CourseRecommendation[] => {
  const used = new Set(recommended.map((course) => course.courseKey));
  return [...courses.values()]
    .filter((course) => !used.has(course.courseKey))
    .sort((a, b) => a.courseName.localeCompare(b.courseName));
};

export const filterCourses = (courses: CourseRecommendation[], query: string): CourseRecommendation[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return courses;
  return courses.filter((course) =>
    course.courseName.toLowerCase().includes(normalized) ||
    course.offerings.some(({ degree }) =>
      degree.code.toLowerCase().includes(normalized) || degree.name.toLowerCase().includes(normalized)));
};
