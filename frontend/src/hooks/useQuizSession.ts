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
import type { AssessmentResult, DegreeRecommendation, QuestionRef, QuestionResponse, RiasecLabels } from "../types/quiz";

export type QuizStep =
  | { name: "intro" }
  | { name: "screening"; sessionId: string; questions: QuestionRef[] }
  | {
      name: "screeningResult";
      sessionId: string;
      rankedCategoryIds: string[];
      recommendation: DegreeRecommendation | null;
      closingQuestions: QuestionRef[];
    }
  | {
      name: "screeningRecommendation";
      sessionId: string;
      recommendation: DegreeRecommendation | null;
      closingQuestions: QuestionRef[];
    }
  | { name: "closing"; sessionId: string; questions: QuestionRef[] }
  | { name: "drillDown"; sessionId: string; questions: QuestionRef[] }
  | { name: "result"; result: AssessmentResult };

export type QuizStatus = "idle" | "submitting" | "error";

/** Owns the quiz session's step progression, in-flight status and RIASEC label lookup. */
export const useQuizSession = (matchTarget?: DegreeMatchTarget) => {
  const [step, setStep] = useState<QuizStep>({ name: "intro" });
  const [status, setStatus] = useState<QuizStatus>("idle");
  const [labels, setLabels] = useState<RiasecLabels | null>(null);
  // The degree recommended from screening-only (category-level) answers. Used as a fallback
  // match target for the final, fully-personalised result when the quiz wasn't launched with
  // an explicit degree already in context (e.g. from the global nav entry point).
  const [screeningRecommendation, setScreeningRecommendation] = useState<DegreeRecommendation | null>(null);

  const start = useCallback(async () => {
    setStatus("submitting");
    try {
      const [session, riasecLabels] = await Promise.all([startAssessmentSession(), fetchRiasecLabels()]);
      setLabels(riasecLabels);
      setScreeningRecommendation(null);
      setStep({ name: "screening", sessionId: session.sessionId, questions: session.questions });
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
        const result = await submitScreeningResponses(sessionId, responses);
        setScreeningRecommendation(result.recommendation);
        setStep({
          name: "screeningResult",
          sessionId,
          rankedCategoryIds: result.rankedCategoryIds,
          recommendation: result.recommendation,
          closingQuestions: result.closingQuestions,
        });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step],
  );

  const viewRecommendation = useCallback(() => {
    if (step.name !== "screeningResult") return;
    setStep({
      name: "screeningRecommendation",
      sessionId: step.sessionId,
      recommendation: step.recommendation,
      closingQuestions: step.closingQuestions,
    });
  }, [step]);

  const continueToClosing = useCallback(() => {
    if (step.name !== "screeningRecommendation") return;
    setStep({ name: "closing", sessionId: step.sessionId, questions: step.closingQuestions });
  }, [step]);

  const submitClosing = useCallback(
    async (responses: QuestionResponse[]) => {
      if (step.name !== "closing") return;
      const sessionId = step.sessionId;
      setStatus("submitting");
      try {
        await submitClosingResponses(sessionId, responses);
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
      const sessionId = step.sessionId;
      setStatus("submitting");
      try {
        const effectiveTarget: DegreeMatchTarget | undefined =
          matchTarget ??
          (screeningRecommendation
            ? {
                degreeCode: screeningRecommendation.code,
                university: screeningRecommendation.universityCode,
                year: screeningRecommendation.year,
              }
            : undefined);
        const result = await submitDrillDownResponses(sessionId, responses, effectiveTarget);
        setStep({ name: "result", result });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step, matchTarget, screeningRecommendation],
  );

  const restart = useCallback(() => {
    setStep({ name: "intro" });
    setStatus("idle");
    setLabels(null);
    setScreeningRecommendation(null);
  }, []);

  return {
    step,
    status,
    labels,
    start,
    submitScreening,
    viewRecommendation,
    continueToClosing,
    submitClosing,
    submitDrillDown,
    restart,
  };
};
