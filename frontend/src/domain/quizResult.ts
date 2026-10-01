import { readableText } from "./readableText";
import type { AssessmentResult, RiasecLabels } from "../types/quiz";

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
