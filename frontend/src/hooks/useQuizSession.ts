import { useCallback, useState } from "react";
import {
  fetchAssessmentResult,
  fetchRiasecLabels,
  startAssessmentSession,
  startDrillDown,
  submitClosingResponses,
  submitDrillDownResponses,
  submitScreeningResponses,
  type DegreeMatchTarget,
} from "../api/quiz";
import { degreeKey, type QuizResult } from "../domain/quizRecommendation";
import { buildInitialQuizResult, buildPersonalisedQuizResult } from "../domain/quizResult";
import type {
  AssessmentResult,
  DegreeRecommendation,
  QuestionRef,
  QuestionResponse,
  Recommendation,
  RiasecLabels,
} from "../types/quiz";

const SCREENING_QUESTION_COUNT = 18;
const EMPTY_LABELS: RiasecLabels = { categories: [], subcategories: [] };

export type QuizStep =
  | { name: "intro" }
  // `phase` "generic" is the 18 general questions; once answered, the 2 closing questions
  // are appended and phase flips to "bonus" - still the same step, so the initial results
  // only appear once all 20 are done (see submitScreening below).
  | { name: "screening"; sessionId: string; questions: QuestionRef[]; phase: "generic" | "bonus" }
  // Initial results. A resting point: the student can look at course recommendations now and
  // come back to personalise later, as the drill-down questions are already fetched.
  | { name: "screeningResult"; sessionId: string; result: QuizResult; drillDownQuestions: QuestionRef[] }
  | { name: "drillDown"; sessionId: string; questions: QuestionRef[] }
  | { name: "result"; sessionId: string; result: QuizResult };

export type QuizStatus = "idle" | "submitting" | "error";

/** `ok` says whether the submission was accepted; `result` is set when it produced a result to show. */
export interface SubmitOutcome {
  ok: boolean;
  result?: QuizResult;
}

const FAILED: SubmitOutcome = { ok: false };

/**
 * For each recommended degree, asks the backend which major/stream fits best now that the
 * drill-down answers are in. Best-effort: a degree whose lookup fails simply has no suggestion.
 */
const collectMajorsByDegree = async (
  sessionId: string,
  assessment: AssessmentResult,
  target: DegreeMatchTarget | undefined,
  degrees: DegreeRecommendation[],
): Promise<Record<string, Recommendation>> => {
  const majors: Record<string, Recommendation> = {};
  if (target && assessment.recommendation) majors[degreeKey(target.university, target.degreeCode)] = assessment.recommendation;

  const pending = degrees.filter((degree) => !majors[degreeKey(degree.universityCode, degree.code)]);
  const settled = await Promise.allSettled(
    pending.map((degree) =>
      fetchAssessmentResult(sessionId, { degreeCode: degree.code, university: degree.universityCode, year: degree.year }),
    ),
  );
  settled.forEach((outcome, index) => {
    const recommendation = outcome.status === "fulfilled" ? outcome.value?.recommendation : null;
    const degree = pending[index];
    if (recommendation && degree) majors[degreeKey(degree.universityCode, degree.code)] = recommendation;
  });
  return majors;
};

/** Owns the quiz session's step progression, in-flight status and RIASEC label lookup. */
export const useQuizSession = (matchTarget?: DegreeMatchTarget) => {
  const [step, setStep] = useState<QuizStep>({ name: "intro" });
  const [status, setStatus] = useState<QuizStatus>("idle");
  const [labels, setLabels] = useState<RiasecLabels | null>(null);
  // Carried across the two-phase screening submission, then reused for the personalised result:
  // the screening recommendations are the degrees we pick a best-fit major/stream for, and the
  // top one stands in as the match target when the quiz wasn't launched from a specific degree.
  const [screeningRecommendations, setScreeningRecommendations] = useState<DegreeRecommendation[]>([]);
  const [pendingRankedCategoryIds, setPendingRankedCategoryIds] = useState<string[]>([]);

  const start = useCallback(async () => {
    setStatus("submitting");
    try {
      const [session, riasecLabels] = await Promise.all([startAssessmentSession(), fetchRiasecLabels()]);
      setLabels(riasecLabels);
      setScreeningRecommendations([]);
      setPendingRankedCategoryIds([]);
      setStep({ name: "screening", sessionId: session.sessionId, questions: session.questions, phase: "generic" });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  const submitScreening = useCallback(
    async (responses: QuestionResponse[]): Promise<SubmitOutcome> => {
      if (step.name !== "screening") return FAILED;
      const sessionId = step.sessionId;
      setStatus("submitting");
      try {
        if (step.phase === "generic") {
          const result = await submitScreeningResponses(sessionId, responses);
          setScreeningRecommendations(result.recommendations);
          setPendingRankedCategoryIds(result.rankedCategoryIds);
          setStep({
            name: "screening",
            sessionId,
            questions: [...step.questions, ...result.closingQuestions],
            phase: "bonus",
          });
          setStatus("idle");
          return { ok: true };
        }

        const bonusQuestionIds = new Set(step.questions.slice(SCREENING_QUESTION_COUNT).map((q) => q.id));
        const bonusResponses = responses.filter((r) => bonusQuestionIds.has(r.questionId));
        await submitClosingResponses(sessionId, bonusResponses);
        const drillDown = await startDrillDown(sessionId);
        const result = buildInitialQuizResult(pendingRankedCategoryIds, screeningRecommendations, labels ?? EMPTY_LABELS);
        setStep({ name: "screeningResult", sessionId, result, drillDownQuestions: drillDown.questions });
        setStatus("idle");
        return { ok: true, result };
      } catch {
        setStatus("error");
        return FAILED;
      }
    },
    [step, labels, pendingRankedCategoryIds, screeningRecommendations],
  );

  /** Moves from the initial results into the optional fine-tuning questions. */
  const continueToDrillDown = useCallback(() => {
    if (step.name !== "screeningResult") return;
    setStep({ name: "drillDown", sessionId: step.sessionId, questions: step.drillDownQuestions });
  }, [step]);

  const submitDrillDown = useCallback(
    async (responses: QuestionResponse[]): Promise<SubmitOutcome> => {
      if (step.name !== "drillDown") return FAILED;
      const sessionId = step.sessionId;
      setStatus("submitting");
      try {
        const topScreeningRecommendation = screeningRecommendations[0];
        const effectiveTarget: DegreeMatchTarget | undefined =
          matchTarget ??
          (topScreeningRecommendation
            ? {
                degreeCode: topScreeningRecommendation.code,
                university: topScreeningRecommendation.universityCode,
                year: topScreeningRecommendation.year,
              }
            : undefined);
        const assessment = await submitDrillDownResponses(sessionId, responses, effectiveTarget);
        const majorByDegree = await collectMajorsByDegree(sessionId, assessment, effectiveTarget, screeningRecommendations);
        const result = buildPersonalisedQuizResult(assessment, screeningRecommendations, majorByDegree, labels ?? EMPTY_LABELS);
        setStep({ name: "result", sessionId, result });
        setStatus("idle");
        return { ok: true, result };
      } catch {
        setStatus("error");
        return FAILED;
      }
    },
    [step, matchTarget, labels, screeningRecommendations],
  );

  const restart = useCallback(() => {
    setStep({ name: "intro" });
    setStatus("idle");
    setLabels(null);
    setScreeningRecommendations([]);
    setPendingRankedCategoryIds([]);
  }, []);

  return {
    step,
    status,
    start,
    submitScreening,
    continueToDrillDown,
    submitDrillDown,
    restart,
  };
};

export type QuizSession = ReturnType<typeof useQuizSession>;
