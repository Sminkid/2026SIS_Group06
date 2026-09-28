export interface QuestionRef {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  text: string;
}

export interface QuestionResponse {
  questionId: string;
  value: number;
}

export interface Recommendation {
  componentId: string;
  code: string;
  name: string;
  type: string;
  matchScore: number;
  usedSubcategoryData: boolean;
}

export interface AssessmentResult {
  rankedCategoryIds: string[];
  categoryScores: Record<string, number>;
  subcategoryScores: Record<string, number>;
  recommendation: Recommendation | null;
}

export interface DegreeRecommendation {
  degreeId: string;
  code: string;
  name: string;
  universityCode: string;
  year: number;
  matchScore: number;
}

export interface RiasecLabels {
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; categoryId: string }[];
}
