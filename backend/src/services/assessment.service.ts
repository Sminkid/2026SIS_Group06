import { randomUUID } from "node:crypto";
import { ApiError } from "../utils/api-error.js";
import * as repo from "../repositories/assessment.repository.js";
import {
  allocateDrillDownQuestions,
  blendCategoryScore,
  computeScoresByKey,
  normaliseScore,
  pickFreeTierClosingQuestions,
  pickScreeningQuestions,
  rankCategories,
  rankComponentCandidates,
  type ComponentCandidate,
  type QuestionRef,
} from "./assessment-scoring.js";

interface ResponseInput {
  questionId: string;
  value: number;
}

const groupByCategory = (questions: QuestionRef[]): Map<string, QuestionRef[]> => {
  const map = new Map<string, QuestionRef[]>();
  for (const q of questions) map.set(q.categoryId, [...(map.get(q.categoryId) ?? []), q]);
  return map;
};

const groupBySubcategory = (questions: QuestionRef[]): Map<string, QuestionRef[]> => {
  const map = new Map<string, QuestionRef[]>();
  for (const q of questions) {
    if (!q.subcategoryId) continue;
    map.set(q.subcategoryId, [...(map.get(q.subcategoryId) ?? []), q]);
  }
  return map;
};

const groupByCategoryThenSubcategory = (questions: QuestionRef[]): Map<string, Map<string, QuestionRef[]>> => {
  const map = new Map<string, Map<string, QuestionRef[]>>();
  for (const q of questions) {
    if (!q.subcategoryId) continue;
    const bySub = map.get(q.categoryId) ?? new Map<string, QuestionRef[]>();
    bySub.set(q.subcategoryId, [...(bySub.get(q.subcategoryId) ?? []), q]);
    map.set(q.categoryId, bySub);
  }
  return map;
};

export const getRiasecLabels = () => repo.findRiasecLabels();

const SCREENING_RECOMMENDATION_COUNT = 4;

const getScreeningRecommendations = async (categoryScores: Map<string, number>, topCategoryId: string) => {
  const degrees = await repo.findAllDegreeCandidates();
  const candidates: ComponentCandidate[] = degrees.map((degree) => ({
    id: degree.id,
    code: degree.code,
    name: degree.name,
    type: "DEGREE",
    categoryScores: new Map(degree.RiasecScore.map((s) => [s.categoryId, s.score])),
    subcategoryScores: new Map(),
  }));
  const ranked = rankComponentCandidates(categoryScores, new Map(), topCategoryId, candidates);
  const degreeById = new Map(degrees.map((d) => [d.id, d]));
  return ranked.slice(0, SCREENING_RECOMMENDATION_COUNT).map((match) => {
    const degree = degreeById.get(match.candidate.id)!;
    return {
      degreeId: degree.id,
      code: degree.code,
      name: degree.name,
      description: degree.description,
      universityCode: degree.HandbookVersion.University.code,
      year: degree.HandbookVersion.year,
      matchScore: match.matchScore,
    };
  });
};

const requireSession = async (sessionId: string) => {
  const session = await repo.findSession(sessionId);
  if (!session) throw new ApiError(404, `Assessment session '${sessionId}' not found`);
  if (session.expiresAt < new Date()) throw new ApiError(410, `Assessment session '${sessionId}' has expired`);
  return session;
};

export const startSession = async () => {
  const id = randomUUID();
  await repo.createSession(id);
  const screeningQuestions = await repo.findScreeningQuestions();
  const questions = pickScreeningQuestions(groupByCategory(screeningQuestions));
  return { sessionId: id, questions };
};

export const submitScreeningResponses = async (sessionId: string, responses: ResponseInput[]) => {
  const session = await requireSession(sessionId);
  if (session.stage !== "SCREENING") throw new ApiError(409, "Session is not awaiting screening responses");

  await repo.upsertResponses(sessionId, responses);
  const answered = await repo.findResponsesForSession(sessionId);
  const screeningAnswers = answered.filter((r) => r.Question.stage === "SCREENING");

  const byCategory = new Map<string, { questionId: string; value: number }[]>();
  for (const r of screeningAnswers) {
    byCategory.set(r.Question.categoryId, [...(byCategory.get(r.Question.categoryId) ?? []), r]);
  }
  const categoryScores = computeScoresByKey(byCategory);
  const rankedCategoryIds = rankCategories(categoryScores);
  const rank1CategoryId = rankedCategoryIds[0];
  if (!rank1CategoryId) throw new ApiError(500, "Unable to determine a top-ranked category");

  await repo.updateSessionStage(sessionId, "SCREENING", rankedCategoryIds);

  const drillDownQuestions = await repo.findDrillDownQuestions();
  const rank1Subcategories = groupBySubcategory(drillDownQuestions.filter((q) => q.categoryId === rank1CategoryId));
  const closingQuestions = pickFreeTierClosingQuestions(rank1Subcategories);

  const recommendations = await getScreeningRecommendations(categoryScores, rank1CategoryId);

  return { rankedCategoryIds, closingQuestions, recommendations };
};

export const submitClosingResponses = async (sessionId: string, responses: ResponseInput[]) => {
  await requireSession(sessionId);
  await repo.upsertResponses(sessionId, responses);
  return { ok: true as const };
};

export const startDrillDown = async (sessionId: string) => {
  const session = await requireSession(sessionId);
  if (session.topCategoryIds.length === 0) throw new ApiError(409, "Screening must be completed before drill-down");

  const answered = await repo.findResponsesForSession(sessionId);
  const rank1CategoryId = session.topCategoryIds[0]!;
  const rank1ClosingAnswers = answered.filter(
    (r) => r.Question.stage === "DRILL_DOWN" && r.Question.categoryId === rank1CategoryId,
  );

  const allDrillDownQuestions = await repo.findDrillDownQuestions();
  const questionsBySubcategoryByCategory = groupByCategoryThenSubcategory(allDrillDownQuestions);

  const questions = allocateDrillDownQuestions({
    rankedCategoryIds: session.topCategoryIds,
    questionsBySubcategoryByCategory,
    rank1AlreadyCoveredSubcategoryIds: new Set(
      rank1ClosingAnswers.map((r) => r.Question.subcategoryId).filter((id): id is string => id !== null),
    ),
    rank1AlreadyAskedQuestionIds: new Set(rank1ClosingAnswers.map((r) => r.questionId)),
  });

  await repo.updateSessionStage(sessionId, "DRILL_DOWN");
  return { questions };
};

const STAGE1_ITEM_COUNT = 3;

export const submitDrillDownResponses = async (
  sessionId: string,
  responses: ResponseInput[],
  degreeCode?: string,
  universityCode?: string,
  year?: number,
) => {
  const session = await requireSession(sessionId);
  await repo.upsertResponses(sessionId, responses);
  await repo.updateSessionStage(sessionId, "COMPLETED");
  return computeResult(session.topCategoryIds, sessionId, degreeCode, universityCode, year);
};

export const getResult = async (sessionId: string, degreeCode?: string, universityCode?: string, year?: number) => {
  const session = await requireSession(sessionId);
  if (session.stage !== "COMPLETED") throw new ApiError(409, "Assessment is not yet completed");
  return computeResult(session.topCategoryIds, sessionId, degreeCode, universityCode, year);
};

const computeResult = async (
  rankedCategoryIds: string[],
  sessionId: string,
  degreeCode?: string,
  universityCode?: string,
  year?: number,
) => {
  const allAnswers = await repo.findResponsesForSession(sessionId);

  const stage1ByCategory = new Map<string, { questionId: string; value: number }[]>();
  const stage2ByCategory = new Map<string, { questionId: string; value: number }[]>();
  const bySubcategory = new Map<string, { questionId: string; value: number }[]>();

  for (const r of allAnswers) {
    if (r.Question.stage === "SCREENING") {
      stage1ByCategory.set(r.Question.categoryId, [...(stage1ByCategory.get(r.Question.categoryId) ?? []), r]);
    } else {
      stage2ByCategory.set(r.Question.categoryId, [...(stage2ByCategory.get(r.Question.categoryId) ?? []), r]);
      if (r.Question.subcategoryId) {
        bySubcategory.set(r.Question.subcategoryId, [...(bySubcategory.get(r.Question.subcategoryId) ?? []), r]);
      }
    }
  }

  const categoryScores = new Map<string, number>();
  for (const categoryId of rankedCategoryIds) {
    const stage1 = stage1ByCategory.get(categoryId) ?? [];
    const stage2 = stage2ByCategory.get(categoryId) ?? [];
    const stage1Score = normaliseScore(stage1.map((r) => r.value));
    const stage2Score = normaliseScore(stage2.map((r) => r.value));
    categoryScores.set(categoryId, blendCategoryScore(stage1Score, stage1.length || STAGE1_ITEM_COUNT, stage2Score, stage2.length));
  }
  const subcategoryScores = computeScoresByKey(bySubcategory);

  let recommendation = null;
  if (degreeCode && universityCode && year) {
    const degree = await repo.findDegreeByCode(degreeCode, universityCode, year);
    if (degree) {
      const links = await repo.findComponentCandidatesForDegree(degree.id);
      const candidates: ComponentCandidate[] = links
        .filter((l): l is typeof l & { Component: NonNullable<(typeof l)["Component"]> } => l.Component !== null)
        .map((l) => ({
          id: l.Component.id,
          code: l.Component.code,
          name: l.Component.name,
          type: l.Component.type,
          categoryScores: new Map(l.Component.RiasecScore.map((s) => [s.categoryId, s.score])),
          subcategoryScores: new Map(l.Component.RiasecSubcategoryScore.map((s) => [s.subcategoryId, s.score])),
        }));
      const ranked = rankComponentCandidates(categoryScores, subcategoryScores, rankedCategoryIds[0]!, candidates);
      const top = ranked[0];
      if (top) {
        recommendation = {
          componentId: top.candidate.id,
          code: top.candidate.code,
          name: top.candidate.name,
          type: top.candidate.type,
          matchScore: top.matchScore,
          usedSubcategoryData: top.usedSubcategoryData,
        };
      }
    }
  }

  return {
    rankedCategoryIds,
    categoryScores: Object.fromEntries(categoryScores),
    subcategoryScores: Object.fromEntries(subcategoryScores),
    recommendation,
  };
};
