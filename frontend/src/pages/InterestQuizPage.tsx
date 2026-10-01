import { useState } from "react";
import { appUi } from "../components/ui";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useQuizSession } from "../hooks/useQuizSession";
import type { QuizResult } from "../domain/quizRecommendation";
import type { QuestionRef, QuestionResponse } from "../types/quiz";

interface Props { onComplete: (result: QuizResult) => void; onBack: () => void; }

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
  onAnswer: (questionId: string, value: number) => void;
  onContinue: (responses: QuestionResponse[]) => void;
}

/** Shows exactly one question at a time, tracking position locally so it resets per step. */
const QuestionStep = ({
  progressLabel,
  questions,
  answers,
  status,
  continueLabel,
  onAnswer,
  onContinue,
}: QuestionStepProps) => {
  const [index, setIndex] = useState(0);
  const question = questions[index];
  const isLast = index === questions.length - 1;
  const hasAnswer = question ? answers[question.id] !== undefined : false;

  const goNext = () => {
    if (isLast) onContinue(questions.map((q) => ({ questionId: q.id, value: answers[q.id]! })));
    // Always advance, even on the last question: if this step's question list is about to
    // grow (e.g. screening's 2 bonus questions arriving after the initial 18), the index
    // needs to already be pointing past the old last item so the new one renders next. If
    // the step is instead about to transition away entirely, this is a harmless no-op.
    setIndex((current) => current + 1);
  };

  if (!question) {
    // Between finishing the last currently-known question and the next batch (or the result)
    // arriving. If that request failed, offer a way back to the last question to resubmit.
    return (
      <section className={appUi.contentSection}>
        {status === "error" ? (
          <AsyncState
            kind="error"
            label="We couldn't submit your answers."
            onRetry={() => setIndex(Math.max(0, questions.length - 1))}
          />
        ) : (
          <AsyncState kind="loading" label="Saving your answers" />
        )}
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
            onClick={goNext}
          >
            {isLast ? continueLabel : "Next"}
          </button>
        </div>
      </div>
    </section>
  );
};

/** Walks a student through the RIASEC interest quiz, then hands the matched result to the app flow. */
export const InterestQuizPage = ({ onComplete, onBack }: Props) => {
  const { step, status, start, submitScreening, submitDrillDown } = useQuizSession(onComplete);
  // Question ids are unique across steps, so answers are kept (not cleared) when a submit
  // fails and the student needs to resend them.
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const setAnswer = (questionId: string, value: number) =>
    setAnswers((current) => ({ ...current, [questionId]: value }));

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Get Started", onClick: onBack }, { label: "Quiz" }]} />

      {step.name === "intro" && (
        <section className={appUi.pageIntroCompact}>
          <p className={appUi.eyebrow}>Interest quiz</p>
          <h1>Find degrees that match your interests</h1>
          <div className={appUi.quizIntro}>
            <p className={appUi.lead}>
              Answer a short set of questions about what you enjoy, and we&apos;ll match your interest profile
              against real majors and streams.
            </p>
            {status === "error" && <AsyncState kind="error" label="We couldn't start the quiz." onRetry={start} />}
            <button
              className={appUi.primaryButton}
              type="button"
              onClick={start}
              disabled={status === "submitting"}
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
          continueLabel="Continue"
          onAnswer={setAnswer}
          onContinue={submitScreening}
        />
      )}

      {step.name === "drillDown" && (
        <QuestionStep
          progressLabel="Fine-tuning your match"
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel="See my result"
          onAnswer={setAnswer}
          onContinue={submitDrillDown}
        />
      )}
    </main>
  );
};
