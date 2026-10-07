import { useState } from "react";
import { appUi } from "../components/ui";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { LoadingDialog } from "../components/LoadingDialog";
import type { QuizResult } from "../domain/quizRecommendation";
import type { QuizSession } from "../hooks/useQuizSession";
import type { QuestionRef, QuestionResponse } from "../types/quiz";

interface Props {
  session: QuizSession;
  onHome: () => void;
  /** Set when the quiz was launched from a degree page, so the student can step back to it. */
  onBackToDegree?: () => void;
  /** Called with the initial results (after the 20 screening questions) or the personalised result. */
  onComplete: (result: QuizResult) => void;
}

const LIKERT_VALUES = [1, 2, 3, 4, 5] as const;

interface LikertQuestionProps {
  question: QuestionRef;
  value: number | undefined;
  onChange: (value: number) => void;
}

const LikertQuestion = ({ question, value, onChange }: LikertQuestionProps) => (
  <div className={appUi.quizQuestionCard}>
    <p className={appUi.quizQuestionText}>{question.text}</p>
    <p className={appUi.description}>Select how this fits you: 1 / Not at all --- 5 / Love it</p>
    <div className={appUi.quizLikertRow} role="radiogroup" aria-label={question.text}>
      {LIKERT_VALUES.map((likertValue) => (
        <button
          key={likertValue}
          type="button"
          role="radio"
          aria-checked={value === likertValue}
          className={value === likertValue ? appUi.quizLikertButtonSelected : appUi.quizLikertButtonIdle}
          onClick={() => onChange(likertValue)}
        >
          {likertValue}
        </button>
      ))}
    </div>
    <p className={appUi.description}>There are no right or wrong answers — answer honestly based on what you naturally enjoy to get the most
accurate academic and career recommendations.</p>
  </div>
);

interface QuestionStepProps {
  progressLabel: string;
  questions: QuestionRef[];
  answers: Record<string, number>;
  status: "idle" | "submitting" | "error";
  continueLabel: string;
  /** Shown in a pop-up while this step's answers are being submitted. */
  loadingLabel: string;
  onAnswer: (questionId: string, value: number) => void;
  onContinue: (responses: QuestionResponse[]) => Promise<boolean>;
}

/** Shows exactly one question at a time, tracking position locally so it resets per step. */
const QuestionStep = ({
  progressLabel,
  questions,
  answers,
  status,
  continueLabel,
  loadingLabel,
  onAnswer,
  onContinue,
}: QuestionStepProps) => {
  const [index, setIndex] = useState(0);
  const question = questions[index];
  const isLast = index === questions.length - 1;
  const hasAnswer = question ? answers[question.id] !== undefined : false;

  const goNext = async () => {
    if (!isLast) {
      setIndex((current) => current + 1);
      return;
    }
    const accepted = await onContinue(questions.map((q) => ({ questionId: q.id, value: answers[q.id]! })));
    if (accepted) setIndex((current) => current + 1);
  };

  if (!question) {
    return (
      <section className={appUi.contentSection}>
        <AsyncState kind="loading" label="Loading next question" />
      </section>
    );
  }

  return (
    <section className={appUi.contentSection}>
      <div className={appUi.quizQuestionWrapper}>
        <p className={appUi.quizProgress}>
          {progressLabel} · Question {index + 1} of {questions.length}
        </p>
        <LikertQuestion question={question} value={answers[question.id]} onChange={(value) => onAnswer(question.id, value)} />
        {status === "error" && <AsyncState kind="error" label="We couldn't submit your answers. Please try again." />}
        {status === "submitting" && <LoadingDialog label={loadingLabel} />}
        <div className={appUi.buttonContainer}>
          <button
            className={appUi.backButton}
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            Back
          </button>
          <button
            className={appUi.primaryButton}
            type="button"
            disabled={status === "submitting" || !hasAnswer}
            onClick={() => void goNext()}
          >
            {isLast ? continueLabel : "Next"}
          </button>
        </div>
      </div>
    </section>
  );
};

/**
 * Walks a student through the RIASEC interest quiz. The 18 general questions and 2 closing
 * questions produce their initial results; the optional fine-tuning questions then produce a
 * personalised one. Results are handed to the app, which shows them on the Quiz Result page.
 */
export const QuizPage = ({ session, onHome, onBackToDegree, onComplete }: Props) => {
  const { step, status, start, submitScreening, submitDrillDown } = session;
  // Question ids are unique across stages, so answers are kept for the page's lifetime and
  // never need clearing between the screening and drill-down steps.
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const setAnswer = (questionId: string, value: number) =>
    setAnswers((current) => ({ ...current, [questionId]: value }));

  const continueWith =
    (submit: (responses: QuestionResponse[]) => Promise<{ ok: boolean; result?: QuizResult }>) =>
    async (responses: QuestionResponse[]): Promise<boolean> => {
      const outcome = await submit(responses);
      if (outcome.result) onComplete(outcome.result);
      return outcome.ok;
    };

  const breadcrumbItems = [
    { label: "Get Started", onClick: onHome },
    ...(onBackToDegree ? [{ label: "Study Plan", onClick: onBackToDegree }] : []),
    { label: "Quiz" },
  ];

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={breadcrumbItems} />

      {step.name === "intro" && (
        <section className={appUi.pageIntroCompact}>
          <p className={appUi.eyebrow}>Interest quiz</p>
          <h1>Find degrees that match your interests</h1>
          <div className={appUi.quizIntro}>
            <p className={appUi.lead}>
              Answer 20 short questions about what you enjoy and we&apos;ll show your initial results and the
              courses that might suit you. After that, you can choose whether to answer some more specific
              questions for a more personalised recommendation.
            </p>
            {status === "error" && <AsyncState kind="error" label="We couldn't start the quiz." onRetry={() => void start()} />}
            {status === "submitting" && <LoadingDialog label="Preparing your quiz questions…" />}
            <button
              className={appUi.primaryButton}
              type="button"
              onClick={() => void start()}
              disabled={status === "submitting"}
              aria-busy={status === "submitting"}
            >
              Start quiz
            </button>
          </div>
        </section>
      )}

      {step.name === "screening" && (
        <QuestionStep
          progressLabel={step.phase === "generic" ? "General interests" : "A closer look"}
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel={step.phase === "generic" ? "Continue to a closer look" : "See my initial results"}
          loadingLabel={step.phase === "generic"
            ? "Saving your answers and preparing a few more questions…"
            : "Working out your initial results. This may take a moment…"}
          onAnswer={setAnswer}
          onContinue={continueWith(submitScreening)}
        />
      )}

      {step.name === "drillDown" && (
        <QuestionStep
          progressLabel="Fine-tuning your match"
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel="See my personalised result"
          loadingLabel="Personalising your recommendations. This may take a moment…"
          onAnswer={setAnswer}
          onContinue={continueWith(submitDrillDown)}
        />
      )}

      {(step.name === "screeningResult" || step.name === "result") && (
        <section className={appUi.contentSection}>
          <AsyncState kind="loading" label="Loading your results" />
        </section>
      )}
    </main>
  );
};
