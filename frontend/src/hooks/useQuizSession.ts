import { useCallback, useState } from "react";
import {
  fetchRiasecLabels,
  startAssessmentSession,
  startDrillDown,
  submitClosingResponses,
  submitDrillDownResponses,
  submitScreeningResponses,
  type DegreeMatchTarget,
} from "../api/quiz";
import { buildQuizResult, type QuizResult } from "../domain/quizRecommendation";
import type { DegreeRecommendation, QuestionRef, QuestionResponse, RiasecLabels } from "../types/quiz";

const SCREENING_QUESTION_COUNT = 18;

export type QuizStep =
  | { name: "intro" }
  // `phase` "generic" is the initial 18 questions; once answered, the 2 bonus/closing
  // questions are appended and phase flips to "bonus" - still the same step, so the
  // drill-down only starts once all 20 are done (see submitScreening below).
  | { name: "screening"; sessionId: string; questions: QuestionRef[]; phase: "generic" | "bonus" }
  | { name: "drillDown"; sessionId: string; questions: QuestionRef[] };

export type QuizStatus = "idle" | "submitting" | "error";

/**
 * Owns the quiz session's step progression and in-flight status. Results are not shown here:
 * once the drill-down is submitted, the finished QuizResult is handed to `onComplete` so the
 * app's result -> recommendations -> comparison flow takes over.
 */
export const useQuizSession = (onComplete: (result: QuizResult) => void, matchTarget?: DegreeMatchTarget) => {
  const [step, setStep] = useState<QuizStep>({ name: "intro" });
  const [status, setStatus] = useState<QuizStatus>("idle");
  const [labels, setLabels] = useState<RiasecLabels | null>(null);
  // Kept from the screening submission: the top-ranked degree stands in as the match target for
  // the final, fully-personalised result when the quiz wasn't launched with a degree in context,
  // and the whole list seeds the course keywords on the result page.
  const [screeningRecommendations, setScreeningRecommendations] = useState<DegreeRecommendation[]>([]);

  const start = useCallback(async () => {
    setStatus("submitting");
    try {
      const [session, riasecLabels] = await Promise.all([startAssessmentSession(), fetchRiasecLabels()]);
      setLabels(riasecLabels);
      setScreeningRecommendations([]);
      setStep({ name: "screening", sessionId: session.sessionId, questions: session.questions, phase: "generic" });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  const submitScreening = useCallback(
    async (responses: QuestionResponse[]) => {
      if (step.name !== "screening") return;
      const sessionId = step.sessionId;
      setStatus("submitting");
      try {
        if (step.phase === "generic") {
          const result = await submitScreeningResponses(sessionId, responses);
          setScreeningRecommendations(result.recommendations);
          setStep({
            name: "screening",
            sessionId,
            questions: [...step.questions, ...result.closingQuestions],
            phase: "bonus",
          });
          setStatus("idle");
          return;
        }

        const bonusQuestionIds = new Set(step.questions.slice(SCREENING_QUESTION_COUNT).map((q) => q.id));
        const bonusResponses = responses.filter((r) => bonusQuestionIds.has(r.questionId));
        await submitClosingResponses(sessionId, bonusResponses);
        const drillDown = await startDrillDown(sessionId);
        setStep({ name: "drillDown", sessionId, questions: drillDown.questions });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step],
  );

  const submitDrillDown = useCallback(
    async (responses: QuestionResponse[]) => {
      if (step.name !== "drillDown") return;
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
        const assessment = await submitDrillDownResponses(step.sessionId, responses, effectiveTarget);
        setStatus("idle");
        onComplete(buildQuizResult(assessment, labels ?? { categories: [], subcategories: [] }, screeningRecommendations));
      } catch {
        setStatus("error");
      }
    },
    [step, matchTarget, screeningRecommendations, labels, onComplete],
  );

  return { step, status, start, submitScreening, submitDrillDown };
};