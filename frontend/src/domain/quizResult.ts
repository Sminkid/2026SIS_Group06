import { readableText } from "./readableText";
import { degreeKey, type QuizCategorySummary, type QuizResult } from "./quizRecommendation";
import type { CourseRecommendation } from "./courseAggregation";
import type {
  AssessmentResult,
  DegreeRecommendation,
  Recommendation,
  RiasecLabels,
} from "../types/quiz";

export interface ScoredLabel {
  id: string;
  name: string;
  score: number;
}

export const rankedCategoryLabels = (result: AssessmentResult, labels: RiasecLabels): ScoredLabel[] => {
  const nameById = new Map(labels.categories.map((category) => [category.id, category.name]));
  return result.rankedCategoryIds.map((id) => ({
    id,
    name: nameById.get(id) ?? id,
    score: result.categoryScores[id] ?? 0,
  }));
};

export const formatScorePercent = (score: number): string => `${Math.round(score * 100)}%`;

/** Strips HTML/entities from a handbook description and truncates it to a short blurb. */
export const briefDescription = (description: string, maxLength = 160): string => {
  const clean = readableText(description);
  if (clean.length <= maxLength) return clean;
  const truncated = clean.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
};

const SUMMARY_CATEGORY_COUNT = 3;

const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

const categorySummaries = (
  rankedCategoryIds: string[],
  labels: RiasecLabels,
  scores?: Record<string, number>,
): QuizCategorySummary[] =>
  rankedCategoryIds.map((id) => {
    const category = labels.categories.find((candidate) => candidate.id === id);
    return { id, name: category?.name ?? id, description: category?.description ?? null, score: scores?.[id] ?? null };
  });

const summaryFor = (categories: QuizCategorySummary[]): string => {
  const top = categories.slice(0, SUMMARY_CATEGORY_COUNT).map((category) => category.name);
  return top.length > 0 ? `Your strongest interest areas are ${joinNames(top)}.` : "We couldn't work out your top interest areas.";
};

const uniqueDegreeNames = (degrees: DegreeRecommendation[]): string[] => [
  ...new Set(degrees.map((degree) => degree.name.trim()).filter((name) => name !== "")),
];

/** Orders degrees by their best-fit major's match score where known, else their screening score. */
export const orderDegreesByFit = (
  degrees: DegreeRecommendation[],
  majorByDegree: Record<string, Recommendation>,
): DegreeRecommendation[] => {
  const fit = (degree: DegreeRecommendation) =>
    majorByDegree[degreeKey(degree.universityCode, degree.code)]?.matchScore ?? degree.matchScore;
  return [...degrees].sort((a, b) => fit(b) - fit(a));
};

/** Result shown after the 18 general + 2 closing questions, before any drill-down. */
export const buildInitialQuizResult = (
  rankedCategoryIds: string[],
  degrees: DegreeRecommendation[],
  labels: RiasecLabels,
): QuizResult => {
  const rankedCategories = categorySummaries(rankedCategoryIds, labels);
  return {
    stage: "initial",
    primaryInterest: rankedCategories[0]?.name ?? "Your interests",
    summary: summaryFor(rankedCategories),
    recommendedCourseKeywords: uniqueDegreeNames(degrees),
    rankedCategories,
    degreeRecommendations: degrees,
    suggestedMajor: null,
    suggestedMajorDegree: null,
    majorByDegree: {},
  };
};

/** Result after the optional drill-down: refined scores plus a best-fit major/stream per degree. */
export const buildPersonalisedQuizResult = (
  assessment: AssessmentResult,
  degrees: DegreeRecommendation[],
  majorByDegree: Record<string, Recommendation>,
  labels: RiasecLabels,
): QuizResult => {
  const rankedCategories = categorySummaries(assessment.rankedCategoryIds, labels, assessment.categoryScores);
  const ordered = orderDegreesByFit(degrees, majorByDegree);
  const suggestedMajor = assessment.recommendation;
  const suggestedMajorDegree = suggestedMajor
    ? ordered.find((degree) => majorByDegree[degreeKey(degree.universityCode, degree.code)]?.componentId === suggestedMajor.componentId)
    : undefined;
  return {
    stage: "personalised",
    primaryInterest: rankedCategories[0]?.name ?? "Your interests",
    summary: summaryFor(rankedCategories),
    recommendedCourseKeywords: uniqueDegreeNames(ordered),
    rankedCategories,
    degreeRecommendations: ordered,
    suggestedMajor,
    suggestedMajorDegree: suggestedMajorDegree
      ? { code: suggestedMajorDegree.code, name: suggestedMajorDegree.name, universityCode: suggestedMajorDegree.universityCode }
      : null,
    majorByDegree,
  };
};

export interface MajorSuggestion {
  universityCode: string;
  major: Recommendation;
}

/** Best-fit majors/streams for the offerings of a course card (personalised results only). */
export const majorSuggestionsFor = (result: QuizResult, course: CourseRecommendation): MajorSuggestion[] =>
  course.offerings.flatMap(({ university, degree }) => {
    const major = result.majorByDegree[degreeKey(university.code, degree.code)];
    return major ? [{ universityCode: university.code, major }] : [];
  });
