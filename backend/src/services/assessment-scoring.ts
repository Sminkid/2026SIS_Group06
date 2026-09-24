// Pure RIASEC quiz allocation/scoring logic - no Prisma/DB access, so it can be
// unit tested with plain data. See assessment.service.ts for the I/O layer that
// fetches questions/records responses and calls into this module.

export interface QuestionRef {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
}

export interface ResponseRef {
  questionId: string;
  value: number; // 1-5
}

const PAID_TIER_ALLOCATION = [8, 6, 5, 3, 2, 1] as const;

export function normaliseScore(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return (mean - 1) / 4;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

function pickRandom<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

/** Pick 3 of each category's 4 screening items, shuffled across all 6 categories. */
export function pickScreeningQuestions(questionsByCategory: Map<string, QuestionRef[]>): QuestionRef[] {
  const picked: QuestionRef[] = [];
  for (const items of questionsByCategory.values()) {
    picked.push(...pickRandom(items, Math.min(3, items.length)));
  }
  return shuffle(picked);
}

/** Rank category ids descending by score (rank-1 first). */
export function rankCategories(categoryScores: Map<string, number>): string[] {
  return [...categoryScores.entries()].sort((a, b) => b[1] - a[1]).map(([categoryId]) => categoryId);
}

/**
 * Pick 2 free-tier closing items for the rank-1 category: one item from each
 * of 2 distinct random subcategories in that category.
 */
export function pickFreeTierClosingQuestions(questionsBySubcategory: Map<string, QuestionRef[]>): QuestionRef[] {
  const subcategoryIds = pickRandom([...questionsBySubcategory.keys()], Math.min(2, questionsBySubcategory.size));
  return subcategoryIds
    .map((subcategoryId) => {
      const items = questionsBySubcategory.get(subcategoryId) ?? [];
      return items.length > 0 ? pickRandom(items, 1)[0] : undefined;
    })
    .filter((q): q is QuestionRef => q !== undefined);
}

/**
 * Allocate a category's drill-down question count across its subcategories,
 * coverage-first: every subcategory gets 1 item before any gets a 2nd/3rd.
 * Subcategories already covered by the free tier (alreadyCoveredSubcategoryIds,
 * only relevant for the rank-1 category) are deprioritized until every other
 * subcategory has at least 1.
 */
export function allocateSubcategoryQuestions(
  questionsBySubcategory: Map<string, QuestionRef[]>,
  count: number,
  alreadyCoveredSubcategoryIds: Set<string> = new Set(),
  alreadyAskedQuestionIds: Set<string> = new Set(),
): QuestionRef[] {
  const available = new Map(
    [...questionsBySubcategory.entries()].map(([subcategoryId, items]) => [
      subcategoryId,
      items.filter((q) => !alreadyAskedQuestionIds.has(q.id)),
    ]),
  );

  const uncovered = shuffle([...available.keys()].filter((id) => !alreadyCoveredSubcategoryIds.has(id)));
  const covered = shuffle([...available.keys()].filter((id) => alreadyCoveredSubcategoryIds.has(id)));
  const priorityOrder = [...uncovered, ...covered];

  const picked: QuestionRef[] = [];
  let remaining = count;

  // Pass 1: one item per subcategory, uncovered ones first.
  for (const subcategoryId of priorityOrder) {
    if (remaining <= 0) break;
    const items = available.get(subcategoryId) ?? [];
    if (items.length === 0) continue;
    const [item, ...rest] = shuffle(items);
    picked.push(item!);
    available.set(subcategoryId, rest);
    remaining -= 1;
  }

  // Pass 2+: leftover count goes to random subcategories with items still available.
  while (remaining > 0) {
    const candidates = [...available.entries()].filter(([, items]) => items.length > 0);
    if (candidates.length === 0) break;
    const [subcategoryId, items] = candidates[Math.floor(Math.random() * candidates.length)]!;
    const [item, ...rest] = shuffle(items);
    picked.push(item!);
    available.set(subcategoryId, rest);
    remaining -= 1;
  }

  return picked;
}

export interface DrillDownAllocationInput {
  rankedCategoryIds: string[];
  questionsBySubcategoryByCategory: Map<string, Map<string, QuestionRef[]>>;
  rank1AlreadyCoveredSubcategoryIds: Set<string>;
  rank1AlreadyAskedQuestionIds: Set<string>;
}

/** Allocate all 25 paid-tier questions across the 6 ranked categories (8/6/5/3/2/1). */
export function allocateDrillDownQuestions(input: DrillDownAllocationInput): QuestionRef[] {
  const { rankedCategoryIds, questionsBySubcategoryByCategory, rank1AlreadyCoveredSubcategoryIds, rank1AlreadyAskedQuestionIds } = input;
  const picked: QuestionRef[] = [];

  rankedCategoryIds.forEach((categoryId, rankIndex) => {
    const count = PAID_TIER_ALLOCATION[rankIndex] ?? 0;
    const questionsBySubcategory = questionsBySubcategoryByCategory.get(categoryId) ?? new Map();
    const isRank1 = rankIndex === 0;
    picked.push(
      ...allocateSubcategoryQuestions(
        questionsBySubcategory,
        count,
        isRank1 ? rank1AlreadyCoveredSubcategoryIds : new Set(),
        isRank1 ? rank1AlreadyAskedQuestionIds : new Set(),
      ),
    );
  });

  return shuffle(picked);
}

/** final = (stage1_score * w1 + stage2_score * n2) / (w1 + n2) */
export function blendCategoryScore(stage1Score: number, stage1Count: number, stage2Score: number, stage2Count: number): number {
  if (stage2Count === 0) return stage1Score;
  return (stage1Score * stage1Count + stage2Score * stage2Count) / (stage1Count + stage2Count);
}

export function computeScoresByKey(responsesByKey: Map<string, ResponseRef[]>): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [key, responses] of responsesByKey) {
    scores.set(key, normaliseScore(responses.map((r) => r.value)));
  }
  return scores;
}

export interface ComponentCandidate {
  id: string;
  code: string;
  name: string;
  type: string;
  categoryScores: Map<string, number>;
  subcategoryScores: Map<string, number>;
}

export interface ComponentMatch {
  candidate: ComponentCandidate;
  matchScore: number;
  usedSubcategoryData: boolean;
}

/**
 * Rank candidate majors/streams by similarity to a student's profile.
 * Prefers comparing subcategory scores where both sides have data for the
 * student's top-ranked category; falls back to a category-level comparison
 * otherwise (see the plan's fallback rule for low-rank categories).
 */
export function rankComponentCandidates(
  studentCategoryScores: Map<string, number>,
  studentSubcategoryScores: Map<string, number>,
  topCategoryId: string,
  candidates: ComponentCandidate[],
): ComponentMatch[] {
  return candidates
    .map((candidate): ComponentMatch => {
      const relevantSubcategoryIds = [...studentSubcategoryScores.keys()].filter((id) =>
        candidate.subcategoryScores.has(id),
      );
      if (relevantSubcategoryIds.length > 0) {
        const matchScore =
          relevantSubcategoryIds.reduce(
            (sum, id) => sum + studentSubcategoryScores.get(id)! * candidate.subcategoryScores.get(id)!,
            0,
          ) / relevantSubcategoryIds.length;
        return { candidate, matchScore, usedSubcategoryData: true };
      }

      const candidateCategoryScore = candidate.categoryScores.get(topCategoryId) ?? 0;
      const studentCategoryScore = studentCategoryScores.get(topCategoryId) ?? 0;
      return { candidate, matchScore: candidateCategoryScore * studentCategoryScore, usedSubcategoryData: false };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
