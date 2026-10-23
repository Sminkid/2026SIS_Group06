import assert from "node:assert/strict";
import test from "node:test";
import { buildInitialQuizResult } from "./quizResult";
import type { DegreeRecommendation } from "../types/quiz";

const degree = (name: string, code: string): DegreeRecommendation => ({
  degreeId: code, code, name, description: null, universityCode: "UNSW", year: 2026, matchScore: 0.9,
});

const keywordsFor = (degrees: DegreeRecommendation[]) =>
  buildInitialQuizResult([], degrees, { categories: [], subcategories: [] }).recommendedCourseKeywords;

test("a recommended UNSW engineering specialisation becomes its Bachelor of Engineering (Honours) course", () => {
  assert.deepEqual(
    keywordsFor([degree("Mechanical Engineering", "MECHAH"), degree("Bachelor of Engineering (Honours) / Bachelor of Surveying", "3776")]),
    ["Bachelor of Engineering (Honours)", "Bachelor of Engineering (Honours) / Bachelor of Surveying"],
  );
});

test("specialisations of the same course are only listed once", () => {
  assert.deepEqual(
    keywordsFor([degree("Mechanical Engineering", "MECHAH"), degree("Civil Engineering", "CVENAH")]),
    ["Bachelor of Engineering (Honours)"],
  );
});
