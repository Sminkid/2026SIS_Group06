export interface QuizResult {
  primaryInterest: string;         // e.g. "Technology"
  recommendedCourseKeywords: string[]; // e.g. ["Computer Science", "Information Technology"]
  summary: string;
}

// Placeholder until the real quiz exists — swap this out for actual
// answer-scoring logic without touching any page component.
export const buildPlaceholderQuizResult = (): QuizResult => ({
  primaryInterest: "Engineering",
  recommendedCourseKeywords: ["Computer Science", "Engineering"],
  summary:
    "You enjoy solving problems and building things — courses in computing and IT are a strong match.",
});