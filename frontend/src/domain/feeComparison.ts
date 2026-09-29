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

/** How one column's figure compares with the cheapest in view; null when there's nothing to compare. */
export type FeeComparison = { kind: "lowest" } | { kind: "more"; difference: number };

export const compareToLowest = (value: number | null, lowest: number | null): FeeComparison | null => {
  if (value === null || lowest === null) return null;
  return value === lowest ? { kind: "lowest" } : { kind: "more", difference: value - lowest };
};

export interface ComparisonColumn { universityCode: string; degreeId: string | null; query: string; }

/** Opens on engineering at each university, the degrees the planner covers in most depth. */
export const DEFAULT_DEGREE_CODES = ["BHENGINE-04", "C09066"];

/** One column per university (up to two), preferring the default degree and falling back to the first listed. */
export const initialColumns = (
  courses: CourseFee[],
  universityCodes: string[],
  defaultDegreeCodes: string[] = DEFAULT_DEGREE_CODES,
): ComparisonColumn[] =>
  universityCodes.slice(0, 2).map((universityCode, index) => {
    const course = courses.find((item) => item.universityCode === universityCode && item.degreeCode === defaultDegreeCodes[index])
      ?? courses.find((item) => item.universityCode === universityCode);
    return { universityCode, degreeId: course?.degreeId ?? null, query: "" };
  });

/** Suggests the university with the fewest columns so adding a course balances the comparison; ties keep list order. */
export const leastUsedUniversity = (universityCodes: string[], columns: ComparisonColumn[]): string | null => {
  const count = (code: string) => columns.filter((column) => column.universityCode === code).length;
  return [...universityCodes].sort((a, b) => count(a) - count(b))[0] ?? null;
};

/** Applies a filter query, switching to the first match only when the current course no longer matches. */
export const applyQuery = (courses: CourseFee[], column: ComparisonColumn, query: string): ComparisonColumn => {
  const matches = filterCourses(courses, column.universityCode, query);
  const keepSelection = matches.length === 0 || matches.some((course) => course.degreeId === column.degreeId);
  const closest = closestCourse(matches, column.universityCode, query) ?? matches[0];
  return { ...column, query, degreeId: keepSelection ? column.degreeId : closest.degreeId };
};

/** Filtered options for a column's course dropdown, always including the current course so the select stays valid. */
export const courseOptions = (courses: CourseFee[], column: ComparisonColumn, current: CourseFee | null): CourseFee[] => {
  const options = filterCourses(courses, column.universityCode, column.query);
  return current && !options.includes(current) ? [current, ...options] : options;
};

export const filterCourses = (courses: CourseFee[], universityCode: string, query: string): CourseFee[] => {
  const normalized = query.trim().toLowerCase();
  return courses.filter((course) => course.universityCode === universityCode
    && (!normalized || `${course.degreeName} ${course.degreeCode}`.toLowerCase().includes(normalized)));
};

const STOP_WORDS = new Set(["bachelor", "of", "and", "the", "in", "honours"]);
const nameWords = (name: string): string[] =>
  [...new Set(name.toLowerCase().replace(/[()]/g, " ").split(/\s+/).filter((word) => word && !STOP_WORDS.has(word)))];

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
