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
          className={value === likertValue ? appUi.quizLikertButtonSelected : appUi.quizLikertButtonIdle}
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
  const question = questions[index]!;
  const isLast = index === questions.length - 1;
  const hasAnswer = answers[question.id] !== undefined;

  const goNext = () => {
    if (isLast) {
      onContinue(questions.map((q) => ({ questionId: q.id, value: answers[q.id]! })));
    } else {
      setIndex((current) => current + 1);
    }
  };

  return (
    <section className={appUi.contentSection}>
      <p className={appUi.quizProgress}>
        {progressLabel} · Question {index + 1} of {questions.length}
      </p>
      <LikertQuestion question={question} value={answers[question.id]} onChange={(value) => onAnswer(question.id, value)} />
      {status === "error" && <AsyncState kind="error" label="We couldn't submit your answers. Please try again." />}
      <div className={appUi.quizFormFooter}>
        <button
          className={appUi.secondaryButton}
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
  const {
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
  } = useQuizSession(matchTarget);
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
          progressLabel="General interests"
          questions={step.questions}
          answers={answers}
          status={status}
          continueLabel="See my initial results"
          onAnswer={setAnswer}
          onContinue={continueWith(submitScreening)}
        />
      )}

      {step.name === "screeningResult" && labels && (
        <section className={appUi.quizResultSection}>
          <div>
            <p className={appUi.eyebrow}>Initial results</p>
            <h1>Your top interest areas</h1>
          </div>
          <ul className={appUi.quizScoreList} aria-label="Ranked RIASEC categories">
            {step.rankedCategoryIds.map((categoryId, index) => (
              <li key={categoryId}>
                <strong>
                  #{index + 1} {labels.categories.find((category) => category.id === categoryId)?.name ?? categoryId}
                </strong>
              </li>
            ))}
          </ul>
          <div className={appUi.quizFormFooter}>
            <button className={appUi.primaryButton} type="button" onClick={viewRecommendation}>
              View course recommendations
            </button>
          </div>
        </section>
      )}

      {step.name === "screeningRecommendation" && (
        <section className={appUi.quizResultSection}>
          <div>
            <p className={appUi.eyebrow}>Based on your general answers</p>
            <h1>A course that might suit you</h1>
          </div>
          {step.recommendation ? (
            <div className={appUi.quizRecommendationCard}>
              <p className={appUi.eyebrow}>Suggested course</p>
              <h2>{step.recommendation.name}</h2>
              <p className={appUi.muted}>
                {step.recommendation.code} · {step.recommendation.universityCode} · {step.recommendation.year}
              </p>
            </div>
          ) : (
            <p className={appUi.muted}>We couldn&apos;t find a course match yet — a few more questions will help.</p>
          )}
          <p className={appUi.lead}>
            Want a more precise match? A few more questions about your specific interests will refine this
            recommendation and suggest the best major or stream within it.
          </p>
          <div className={appUi.quizFormFooter}>
            <button className={appUi.primaryButton} type="button" onClick={continueToClosing}>
              Personalise further
            </button>
          </div>
        </section>
      )}

      {step.name === "closing" && (
        <QuestionStep
          progressLabel="A closer look"
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
          progressLabel="Fine-tuning your match"
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
