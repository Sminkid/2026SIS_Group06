import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocateSubcategoryQuestions,
  blendCategoryScore,
  normaliseScore,
  rankCategories,
  type QuestionRef,
} from "./assessment-scoring.js";

function makeItems(subcategoryId: string, n: number): QuestionRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${subcategoryId}-${i + 1}`,
    categoryId: "cat",
    subcategoryId,
  }));
}

test("normaliseScore maps 1-5 mean to 0-1", () => {
  assert.equal(normaliseScore([1, 1, 1]), 0);
  assert.equal(normaliseScore([5, 5, 5]), 1);
  assert.equal(normaliseScore([3, 3, 3]), 0.5);
});

test("rankCategories sorts descending by score", () => {
  const scores = new Map([
    ["a", 0.2],
    ["b", 0.9],
    ["c", 0.5],
  ]);
  assert.deepEqual(rankCategories(scores), ["b", "c", "a"]);
});

test("allocateSubcategoryQuestions covers every subcategory before giving any a 2nd item", () => {
  const bySubcategory = new Map([
    ["sub-a", makeItems("sub-a", 3)],
    ["sub-b", makeItems("sub-b", 3)],
    ["sub-c", makeItems("sub-c", 3)],
  ]);
  const picked = allocateSubcategoryQuestions(bySubcategory, 4);
  const countBySubcategory = new Map<string, number>();
  for (const q of picked) {
    countBySubcategory.set(q.subcategoryId!, (countBySubcategory.get(q.subcategoryId!) ?? 0) + 1);
  }
  assert.equal(picked.length, 4);
  assert.equal(countBySubcategory.size, 3, "all 3 subcategories should have at least 1 item");
  assert.equal([...countBySubcategory.values()].filter((c) => c === 2).length, 1, "exactly 1 subcategory gets a 2nd item");
});

test("allocateSubcategoryQuestions deprioritizes already-covered subcategories", () => {
  const bySubcategory = new Map([
    ["sub-a", makeItems("sub-a", 3)],
    ["sub-b", makeItems("sub-b", 3)],
  ]);
  const picked = allocateSubcategoryQuestions(bySubcategory, 1, new Set(["sub-a"]));
  assert.equal(picked.length, 1);
  assert.equal(picked[0]!.subcategoryId, "sub-b", "uncovered subcategory should be filled before the covered one");
});

test("allocateSubcategoryQuestions excludes already-asked question ids", () => {
  const items = makeItems("sub-a", 3);
  const bySubcategory = new Map([["sub-a", items]]);
  const alreadyAsked = new Set([items[0]!.id]);
  const picked = allocateSubcategoryQuestions(bySubcategory, 2, new Set(), alreadyAsked);
  assert.equal(picked.length, 2);
  assert.ok(picked.every((q) => q.id !== items[0]!.id));
});

test("blendCategoryScore weights stage1 and stage2 by item count", () => {
  assert.equal(blendCategoryScore(0.5, 3, 1, 6), (0.5 * 3 + 1 * 6) / 9);
  assert.equal(blendCategoryScore(0.5, 3, 0, 0), 0.5, "falls back to stage1 when no stage2 items");
});
