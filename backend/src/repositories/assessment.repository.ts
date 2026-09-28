import { getPrisma } from "../db/prisma.js";
import type { QuestionRef } from "../services/assessment-scoring.js";

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export const findScreeningQuestions = () =>
  getPrisma().question.findMany({
    where: { stage: "SCREENING" },
    select: { id: true, categoryId: true, subcategoryId: true, text: true },
  });

export const findDrillDownQuestions = () =>
  getPrisma().question.findMany({
    where: { stage: "DRILL_DOWN" },
    select: { id: true, categoryId: true, subcategoryId: true, text: true },
  });

export const findQuestionsByIds = (ids: string[]) =>
  getPrisma().question.findMany({
    where: { id: { in: ids } },
    select: { id: true, categoryId: true, subcategoryId: true, text: true, stage: true },
  });

export const findRiasecLabels = async () => {
  const prisma = getPrisma();
  const [categories, subcategories] = await Promise.all([
    prisma.riasecCategory.findMany({ select: { id: true, name: true } }),
    prisma.riasecSubcategory.findMany({ select: { id: true, name: true, categoryId: true } }),
  ]);
  return { categories, subcategories };
};

export const createSession = (id: string) =>
  getPrisma().assessmentSession.create({
    data: { id, stage: "SCREENING", topCategoryIds: [], expiresAt: new Date(Date.now() + SESSION_TTL_MS), updatedAt: new Date() },
  });

export const findSession = (id: string) => getPrisma().assessmentSession.findUnique({ where: { id } });

export const updateSessionStage = (id: string, stage: "SCREENING" | "DRILL_DOWN" | "COMPLETED", topCategoryIds?: string[]) =>
  getPrisma().assessmentSession.update({
    where: { id },
    data: { stage, ...(topCategoryIds ? { topCategoryIds } : {}), updatedAt: new Date() },
  });

export const upsertResponses = async (sessionId: string, responses: { questionId: string; value: number }[]) => {
  const prisma = getPrisma();
  await Promise.all(
    responses.map((r) =>
      prisma.assessmentResponse.upsert({
        where: { sessionId_questionId: { sessionId, questionId: r.questionId } },
        update: { value: r.value, updatedAt: new Date() },
        create: { id: crypto.randomUUID(), sessionId, questionId: r.questionId, value: r.value, updatedAt: new Date() },
      }),
    ),
  );
};

export const findResponsesForSession = (sessionId: string) =>
  getPrisma().assessmentResponse.findMany({
    where: { sessionId },
    select: { questionId: true, value: true, Question: { select: { categoryId: true, subcategoryId: true, stage: true } } },
  });

export const findDegreeByCode = (degreeCode: string, universityCode: string, year: number) =>
  getPrisma().degree.findFirst({
    where: { code: degreeCode, HandbookVersion: { year, University: { code: universityCode } } },
    select: { id: true },
  });

export const findComponentCandidatesForDegree = (degreeId: string) =>
  getPrisma().degreeComponent.findMany({
    where: {
      degreeId,
      Component: { type: { in: ["MAJOR", "STREAM", "SPECIALISATION"] } },
    },
    orderBy: { Component: { code: "asc" } },
    select: {
      Component: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          RiasecScore: { select: { categoryId: true, score: true } },
          RiasecSubcategoryScore: { select: { subcategoryId: true, score: true } },
        },
      },
    },
  });

export const findAllDegreeCandidates = () =>
  getPrisma().degree.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      HandbookVersion: { select: { year: true, University: { select: { code: true, name: true } } } },
      RiasecScore: { select: { categoryId: true, score: true } },
    },
  });

export type { QuestionRef };
