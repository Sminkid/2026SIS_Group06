import { test } from "node:test";
import assert from "node:assert/strict";
import { rankComponentCandidates, type ComponentCandidate } from "../services/assessment-scoring.js";

function candidate(
  id: string,
  categoryScores: Record<string, number>,
  subcategoryScores: Record<string, number> = {},
): ComponentCandidate {
  return {
    id,
    code: id,
    name: id,
    type: "MAJOR",
    categoryScores: new Map(Object.entries(categoryScores)),
    subcategoryScores: new Map(Object.entries(subcategoryScores)),
  };
}

test("rankComponentCandidates ranks the closer subcategory profile first", () => {
  const studentCategoryScores = new Map([["riasec-artistic", 0.8]]);
  const studentSubcategoryScores = new Map([
    ["sub-1", 0.9],
    ["sub-2", 0.2],
  ]);
  const close = candidate("close", {}, { "sub-1": 0.85, "sub-2": 0.25 });
  const far = candidate("far", {}, { "sub-1": 0.1, "sub-2": 0.9 });

  const ranked = rankComponentCandidates(studentCategoryScores, studentSubcategoryScores, "riasec-artistic", [
    far,
    close,
  ]);

  assert.equal(ranked[0]!.candidate.id, "close");
  assert.ok(ranked[0]!.matchScore > ranked[1]!.matchScore);
  assert.ok(ranked.every((r) => r.usedSubcategoryData));
});

test("rankComponentCandidates distinguishes close-vs-far profiles even when all scores are near zero (regression)", () => {
  // Before the fix, a multiplicative similarity collapsed every one of these
  // to ~0 regardless of actual closeness, since student scores are all ~0.05.
  const studentCategoryScores = new Map<string, number>();
  const studentSubcategoryScores = new Map([
    ["sub-1", 0.05],
    ["sub-2", 0.05],
  ]);
  const veryClose = candidate("very-close", {}, { "sub-1": 0.03, "sub-2": 0.03 });
  const moderate = candidate("moderate", {}, { "sub-1": 0.5, "sub-2": 0.5 });
  const far = candidate("far", {}, { "sub-1": 0.95, "sub-2": 0.95 });

  const ranked = rankComponentCandidates(studentCategoryScores, studentSubcategoryScores, "unused", [
    moderate,
    far,
    veryClose,
  ]);

  const scores = ranked.map((r) => r.matchScore);
  assert.notEqual(scores[0], scores[1]);
  assert.notEqual(scores[1], scores[2]);
  assert.deepEqual(
    ranked.map((r) => r.candidate.id),
    ["very-close", "moderate", "far"],
  );
});

test("rankComponentCandidates falls back to category-level comparison when no subcategories overlap", () => {
  const studentCategoryScores = new Map([["riasec-social", 0.75]]);
  const studentSubcategoryScores = new Map([["student-only-sub", 0.6]]);
  const near = candidate("near", { "riasec-social": 0.8 }, { "candidate-only-sub": 0.4 });
  const distant = candidate("distant", { "riasec-social": 0.2 }, { "candidate-only-sub": 0.4 });

  const ranked = rankComponentCandidates(studentCategoryScores, studentSubcategoryScores, "riasec-social", [
    distant,
    near,
  ]);

  assert.ok(ranked.every((r) => !r.usedSubcategoryData));
  assert.equal(ranked[0]!.candidate.id, "near");
});

test("rankComponentCandidates returns an empty array for no candidates", () => {
  assert.deepEqual(rankComponentCandidates(new Map(), new Map(), "riasec-realistic", []), []);
});
