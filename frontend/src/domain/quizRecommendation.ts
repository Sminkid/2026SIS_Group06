import { rankedCategoryLabels, type ScoredLabel } from "./quizResult";
import type { AssessmentResult, DegreeRecommendation, RiasecLabels } from "../types/quiz";

/** What the quiz hands to the rest of the flow (result page -> course recommendations -> comparison). */
export interface QuizResult {
  primaryInterest: string;         // e.g. "Realistic"
  recommendedCourseKeywords: string[]; // e.g. ["Engineering", "Information Technology"]
  summary: string;
  /** All six RIASEC categories, highest first. Absent for results not built from a real assessment. */
  rankedInterests?: ScoredLabel[];
  /** The best-fitting major/stream the backend found within the top matched degree. */
  suggestedMajor?: { name: string; code: string; type: string };
}

const DEGREE_PREFIX = /^(?:bachelor|master|associate degree|graduate certificate|graduate diploma|diploma|doctor)\s+(?:of|in)\s+/i;
// Double degrees arrive as "A / B" or "Bachelor of A Bachelor of B"; only the first degree names the field.
const DOUBLE_DEGREE_SPLIT = /\s+\/\s+|\s+(?=(?:Bachelor|Master|Diploma)\s+of\b)/i;

/**
 * Turns a degree name into the keyword used to find equivalent courses at other universities,
 * e.g. "Bachelor of Engineering (Honours)" -> "Engineering".
 */
export const degreeNameToKeyword = (degreeName: string): string => {
  const firstDegree = degreeName.split(DOUBLE_DEGREE_SPLIT)[0] ?? degreeName;
  const keyword = firstDegree
    .replace(/\([^)]*\)/g, " ")
    .replace(DEGREE_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  return keyword || degreeName.trim();
};

const uniqueKeywords = (degreeNames: string[]): string[] => {
  const seen = new Set<string>();
  return degreeNames.map(degreeNameToKeyword).filter((keyword) => {
    const key = keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Converts the backend assessment output into the result shape the existing result/course pages consume. */
export const buildQuizResult = (
  assessment: AssessmentResult,
  labels: RiasecLabels,
  recommendations: DegreeRecommendation[],
): QuizResult => {
  const rankedInterests = rankedCategoryLabels(assessment, labels);
  const topCategory = labels.categories.find((category) => category.id === assessment.rankedCategoryIds[0]);
  const primaryInterest = topCategory?.name ?? rankedInterests[0]?.name ?? "Your interests";
  const { recommendation } = assessment;

  return {
    primaryInterest,
    recommendedCourseKeywords: uniqueKeywords(recommendations.map((degree) => degree.name)),
    summary: topCategory?.description ?? `Your answers point most strongly towards ${primaryInterest} interests.`,
    rankedInterests,
    suggestedMajor: recommendation
      ? { name: recommendation.name, code: recommendation.code, type: recommendation.type }
      : undefined,
  };
};