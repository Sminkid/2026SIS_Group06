import type { CourseFee } from "../types/fee";

export type FeeBasis = "domestic" | "international";

/** Fee guides quote one year of full-time study, which is 48 credit points at both universities. */
export const CREDIT_POINTS_PER_YEAR = 48;
export const MAX_COMPARED_COURSES = 4;

export const annualFee = (course: CourseFee, basis: FeeBasis): number | null =>
  basis === "domestic" ? course.domesticFee : course.internationalFee;

export const formatAud = (amount: number): string => `A$${Math.round(amount).toLocaleString("en-AU")}`;

/** Full-time duration rounded to one decimal, e.g. 198 CP is 4.1 years. */
export const formatDuration = (creditPoints: number | null): string => {
  if (creditPoints === null) return "Not listed";
  const years = Math.round((creditPoints / CREDIT_POINTS_PER_YEAR) * 10) / 10;
  return `${years} ${years === 1 ? "year" : "years"}`;
};

/** Annual fee scaled to the whole course at current rates; real totals rise as fees are indexed each year. */
export const estimatedTotal = (fee: number | null, creditPoints: number | null): number | null =>
  fee === null || creditPoints === null ? null : (fee * creditPoints) / CREDIT_POINTS_PER_YEAR;

/** The value other columns are measured against; null unless at least two courses have a figure to compare. */
export const lowestOf = (values: Array<number | null>): number | null => {
  const known = values.filter((value): value is number => value !== null);
  return known.length < 2 ? null : Math.min(...known);
};

export const filterCourses = (courses: CourseFee[], universityCode: string, query: string): CourseFee[] => {
  const normalized = query.trim().toLowerCase();
  return courses.filter((course) => course.universityCode === universityCode
    && (!normalized || `${course.degreeName} ${course.degreeCode}`.toLowerCase().includes(normalized)));
};

const STOP_WORDS = new Set(["bachelor", "of", "and", "the", "in", "honours"]);
const nameWords = (name: string): string[] =>
  name.toLowerCase().replace(/[()]/g, " ").split(/\s+/).filter((word) => word && !STOP_WORDS.has(word));

/**
 * Finds the course at another university whose name best matches a reference course, so switching
 * university keeps the comparison like-for-like. Shared name words score highest; extra words and
 * offshore variants count against a course.
 */
export const closestCourse = (
  courses: CourseFee[],
  universityCode: string,
  referenceName: string,
  excludedDegreeIds: ReadonlySet<string> = new Set(),
): CourseFee | null => {
  const target = new Set(nameWords(referenceName));
  let best: CourseFee | null = null;
  let bestScore = -Infinity;
  for (const course of courses) {
    if (course.universityCode !== universityCode || excludedDegreeIds.has(course.degreeId)) continue;
    const words = nameWords(course.degreeName);
    const shared = words.filter((word) => target.has(word)).length;
    const score = shared * 10 - Math.abs(words.length - target.size) - (/offshore/i.test(course.degreeName) ? 5 : 0);
    if (score > bestScore) { best = course; bestScore = score; }
  }
  return best;
};
