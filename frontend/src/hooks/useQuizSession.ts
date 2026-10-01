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

const SCREENING_QUESTION_COUNT = 18;

export type QuizStep =
  | { name: "intro" }
  // `phase` "generic" is the initial 18 questions; once answered, the 2 bonus/closing
  // questions are appended and phase flips to "bonus" - still the same step, so results
  // only ever appear once all 20 are done (see submitScreening below).
  | { name: "screening"; sessionId: string; questions: QuestionRef[]; phase: "generic" | "bonus" }
  | {
      name: "screeningResult";
      sessionId: string;
      rankedCategoryIds: string[];
      recommendations: DegreeRecommendation[];
      drillDownQuestions: QuestionRef[];
    }
  | {
      name: "screeningRecommendation";
      sessionId: string;
      recommendations: DegreeRecommendation[];
      drillDownQuestions: QuestionRef[];
    }
  | { name: "drillDown"; sessionId: string; questions: QuestionRef[] }
  | { name: "result"; result: AssessmentResult };

export type QuizStatus = "idle" | "submitting" | "error";

/** Owns the quiz session's step progression, in-flight status and RIASEC label lookup. */
export const useQuizSession = (matchTarget?: DegreeMatchTarget) => {
  const [step, setStep] = useState<QuizStep>({ name: "intro" });
  const [status, setStatus] = useState<QuizStatus>("idle");
  const [labels, setLabels] = useState<RiasecLabels | null>(null);
  // Carried across the two-phase screening submission, then used as the fallback match
  // target for the final, fully-personalised result when the quiz wasn't launched with an
  // explicit degree already in context (e.g. from the global nav entry point) - the
  // top-ranked screening recommendation stands in for a pre-picked degree.
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
    async (responses: QuestionResponse[]) => {
      if (step.name !== "screening") return;
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
          return;
        }

        const bonusQuestionIds = new Set(step.questions.slice(SCREENING_QUESTION_COUNT).map((q) => q.id));
        const bonusResponses = responses.filter((r) => bonusQuestionIds.has(r.questionId));
        await submitClosingResponses(sessionId, bonusResponses);
        const drillDown = await startDrillDown(sessionId);
        setStep({
          name: "screeningResult",
          sessionId,
          rankedCategoryIds: pendingRankedCategoryIds,
          recommendations: screeningRecommendations,
          drillDownQuestions: drillDown.questions,
        });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step, pendingRankedCategoryIds, screeningRecommendations],
  );

  const viewRecommendations = useCallback(() => {
    if (step.name !== "screeningResult") return;
    setStep({
      name: "screeningRecommendation",
      sessionId: step.sessionId,
      recommendations: step.recommendations,
      drillDownQuestions: step.drillDownQuestions,
    });
  }, [step]);

  const skipToDrillDown = useCallback(() => {
    if (step.name !== "screeningResult") return;
    setStep({ name: "drillDown", sessionId: step.sessionId, questions: step.drillDownQuestions });
  }, [step]);

  const continueToDrillDown = useCallback(() => {
    if (step.name !== "screeningRecommendation") return;
    setStep({ name: "drillDown", sessionId: step.sessionId, questions: step.drillDownQuestions });
  }, [step]);

  const submitDrillDown = useCallback(
    async (responses: QuestionResponse[]) => {
      if (step.name !== "drillDown") return;
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
        const result = await submitDrillDownResponses(sessionId, responses, effectiveTarget);
        setStep({ name: "result", result });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step, matchTarget, screeningRecommendations],
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
    labels,
    start,
    submitScreening,
    viewRecommendations,
    skipToDrillDown,
    continueToDrillDown,
    submitDrillDown,
    restart,
  };
};
