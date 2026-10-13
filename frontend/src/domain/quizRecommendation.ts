import type { DegreeRecommendation, Recommendation } from "../types/quiz";

/** One RIASEC category as shown on the result screens. `score` is only known once personalised. */
export interface QuizCategorySummary {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
}

/**
 * What the quiz hands to the rest of the app (result page, course recommendations, comparison).
 *
 * - "initial": built from the 18 general questions plus the 2 closing questions.
 * - "personalised": built after the optional drill-down questions, with category scores and a
 *   best-fit major/stream per recommended degree.
 */
export interface QuizResult {
  stage: "initial" | "personalised";
  primaryInterest: string; // e.g. "Realistic"
  summary: string;
  /** Degree names, most relevant first; matched against each university's degree list. */
  recommendedCourseKeywords: string[];
  rankedCategories: QuizCategorySummary[];
  degreeRecommendations: DegreeRecommendation[];
  /** Top major/stream for the degree the quiz was matched against (personalised only). */
  suggestedMajor: Recommendation | null;
  suggestedMajorDegree: Pick<DegreeRecommendation, "code" | "name" | "universityCode"> | null;
  /** Best-fit major/stream per degree, keyed by `degreeKey(universityCode, degreeCode)`. */
  majorByDegree: Record<string, Recommendation>;
}

export const degreeKey = (universityCode: string, degreeCode: string): string => `${universityCode}:${degreeCode}`;
