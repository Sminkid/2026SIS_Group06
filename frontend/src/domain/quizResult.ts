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

export const topSubcategoryLabels = (result: AssessmentResult, labels: RiasecLabels, limit = 5): ScoredLabel[] => {
  const nameById = new Map(labels.subcategories.map((subcategory) => [subcategory.id, subcategory.name]));
  return Object.entries(result.subcategoryScores)
    .map(([id, score]) => ({ id, name: nameById.get(id) ?? id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const formatScorePercent = (score: number): string => `${Math.round(score * 100)}%`;
