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
import type { AssessmentResult, QuestionRef, QuestionResponse, RiasecLabels } from "../types/quiz";

export type QuizStep =
  | { name: "intro" }
  | { name: "screening"; sessionId: string; questions: QuestionRef[] }
  | { name: "closing"; sessionId: string; questions: QuestionRef[] }
  | { name: "drillDown"; sessionId: string; questions: QuestionRef[] }
  | { name: "result"; result: AssessmentResult };

export type QuizStatus = "idle" | "submitting" | "error";

/** Owns the quiz session's step progression, in-flight status and RIASEC label lookup. */
export const useQuizSession = (matchTarget?: DegreeMatchTarget) => {
  const [step, setStep] = useState<QuizStep>({ name: "intro" });
  const [status, setStatus] = useState<QuizStatus>("idle");
  const [labels, setLabels] = useState<RiasecLabels | null>(null);

  const start = useCallback(async () => {
    setStatus("submitting");
    try {
      const [session, riasecLabels] = await Promise.all([startAssessmentSession(), fetchRiasecLabels()]);
      setLabels(riasecLabels);
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
        setStep({ name: "closing", sessionId, questions: result.closingQuestions });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step],
  );

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
        const result = await submitDrillDownResponses(sessionId, responses, matchTarget);
        setStep({ name: "result", result });
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [step, matchTarget],
  );

  const restart = useCallback(() => {
    setStep({ name: "intro" });
    setStatus("idle");
    setLabels(null);
  }, []);

  return { step, status, labels, start, submitScreening, submitClosing, submitDrillDown, restart };
};
