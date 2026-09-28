import { useMemo, useState } from "react";
import { appUi } from "../components/ui";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatScorePercent, rankedCategoryLabels, topSubcategoryLabels } from "../domain/quizResult";
import { useQuizSession } from "../hooks/useQuizSession";
import type { DegreeSummary, University } from "../types/handbook";
import type { QuestionRef, QuestionResponse } from "../types/quiz";

interface Props {
  university?: University;
  degree?: DegreeSummary;
  onBack: () => void;
  onHome: () => void;
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
    <div className={appUi.quizLikertRow} role="radiogroup" aria-label={question.text}>
      {LIKERT_VALUES.map((likertValue) => (
        <button
          key={likertValue}
          type="button"
          role="radio"
          aria-checked={value === likertValue}
          className={
            value === likertValue
              ? `${appUi.quizLikertButton} ${appUi.quizLikertButtonSelected}`
              : appUi.quizLikertButton
          }
          onClick={() => onChange(likertValue)}
        >
          {likertValue}
        </button>
      ))}
    </div>
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

const QuestionStep = ({
  progressLabel,
  questions,
  answers,
  status,
  continueLabel,
  onAnswer,
  onContinue,
}: QuestionStepProps) => {
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  return (
    <section className={appUi.contentSection}>
      <p className={appUi.quizProgress}>{progressLabel}</p>
      <div className={appUi.quizQuestionList}>
        {questions.map((question) => (
          <LikertQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) => onAnswer(question.id, value)}
          />
        ))}
      </div>
      {status === "error" && <AsyncState kind="error" label="We couldn't submit your answers. Please try again." />}
      <div className={appUi.quizFormFooter}>
        <span className={appUi.muted}>
          {answeredCount} of {questions.length} answered
        </span>
        <button
          className={appUi.primaryButton}
          type="button"
          disabled={status === "submitting" || answeredCount < questions.length}
          onClick={() => onContinue(questions.map((question) => ({ questionId: question.id, value: answers[question.id]! })))}
        >
          {continueLabel}
        </button>
      </div>
    </section>
  );
};

/** Walks a student through the RIASEC interest quiz and shows their matched result. */
export const QuizPage = ({ university, degree, onBack, onHome }: Props) => {
  const matchTarget = useMemo(
    () =>
      university && degree
        ? { degreeCode: degree.code, university: university.code, year: degree.handbookYear }
        : undefined,
    [university, degree],
  );
  const { step, status, labels, start, submitScreening, submitClosing, submitDrillDown, restart } =
    useQuizSession(matchTarget);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const setAnswer = (questionId: string, value: number) =>
    setAnswers((current) => ({ ...current, [questionId]: value }));

  const continueWith = (submit: (responses: QuestionResponse[]) => void) => (responses: QuestionResponse[]) => {
    submit(responses);
    setAnswers({});
  };

  const breadcrumbItems = [
    { label: "Universities", onClick: onHome },
    ...(university ? [{ label: university.code, onClick: onBack }] : []),
    { label: "Interest quiz" },
  ];

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={breadcrumbItems} />

      {step.name === "intro" && (
        <section className={appUi.pageIntroCompact}>
          <p className={appUi.eyebrow}>Career interest quiz</p>
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
          progressLabel="Step 1 of 3 · About your interests"
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel="Continue"
          onAnswer={setAnswer}
          onContinue={continueWith(submitScreening)}
        />
      )}

      {step.name === "closing" && (
        <QuestionStep
          progressLabel="Step 2 of 3 · A closer look"
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel="Continue"
          onAnswer={setAnswer}
          onContinue={continueWith(submitClosing)}
        />
      )}

      {step.name === "drillDown" && (
        <QuestionStep
          progressLabel="Step 3 of 3 · Fine-tuning your match"
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel="See my result"
          onAnswer={setAnswer}
          onContinue={continueWith(submitDrillDown)}
        />
      )}

      {step.name === "result" && labels && (
        <section className={appUi.quizResultSection}>
          <div>
            <p className={appUi.eyebrow}>Your result</p>
            <h1>Your top interest areas</h1>
          </div>

          <ul className={appUi.quizScoreList} aria-label="RIASEC category scores">
            {rankedCategoryLabels(step.result, labels).map((category) => (
              <li key={category.id}>
                <strong>{category.name}</strong>
                <span>{formatScorePercent(category.score)}</span>
              </li>
            ))}
          </ul>

          <div>
            <p className={appUi.eyebrow}>Top specific interests</p>
            <ul className={appUi.quizScoreList} aria-label="Top RIASEC subcategory scores">
              {topSubcategoryLabels(step.result, labels).map((subcategory) => (
                <li key={subcategory.id}>
                  <strong>{subcategory.name}</strong>
                  <span>{formatScorePercent(subcategory.score)}</span>
                </li>
              ))}
            </ul>
          </div>

          {step.result.recommendation && (
            <div className={appUi.quizRecommendationCard}>
              <p className={appUi.eyebrow}>Suggested match</p>
              <h2>{step.result.recommendation.name}</h2>
              <p className={appUi.muted}>
                {step.result.recommendation.code} · {step.result.recommendation.type}
              </p>
            </div>
          )}

          <div className={appUi.quizFormFooter}>
            <button className={appUi.secondaryButton} type="button" onClick={restart}>
              Retake quiz
            </button>
            {university && degree ? (
              <button className={appUi.primaryButton} type="button" onClick={onBack}>
                Back to degree
              </button>
            ) : (
              <button className={appUi.primaryButton} type="button" onClick={onHome}>
                Done
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
};
