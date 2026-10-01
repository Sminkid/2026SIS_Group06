import { useMemo, useState } from "react";
import { appUi } from "../components/ui";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { briefDescription, formatScorePercent, rankedCategoryLabels } from "../domain/quizResult";
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
    // Between finishing the last currently-known question and the next batch (if any)
    // being appended - e.g. the screening step's 2 bonus questions arriving mid-quiz.
    return (
      <section className={appUi.contentSection}>
        <AsyncState kind="loading" label="Loading next question" />
      </section>
    );
  }

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
    viewRecommendations,
    skipToDrillDown,
    continueToDrillDown,
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
              Answer a short set of 20 questions about what you enjoy, and we&apos;ll match your interest profile
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
            {step.rankedCategoryIds.map((categoryId, index) => {
              const category = labels.categories.find((c) => c.id === categoryId);
              return (
                <li key={categoryId}>
                  <div>
                    <strong>
                      #{index + 1} {category?.name ?? categoryId}
                    </strong>
                    {index < 3 && category?.description && <p className={appUi.muted}>{category.description}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className={appUi.quizFormFooter}>
            <button className={appUi.secondaryButton} type="button" onClick={skipToDrillDown}>
              Skip to personalise further
            </button>
            <button className={appUi.primaryButton} type="button" onClick={viewRecommendations}>
              View course recommendations
            </button>
          </div>
        </section>
      )}

      {step.name === "screeningRecommendation" && (
        <section className={appUi.quizResultSection}>
          <div>
            <p className={appUi.eyebrow}>Based on your general answers</p>
            <h1>Courses that might suit you</h1>
          </div>
          {step.recommendations.length > 0 ? (
            <div className={appUi.quizCourseList}>
              {step.recommendations.map((recommendation) => (
                <div className={appUi.quizRecommendationCard} key={recommendation.degreeId}>
                  <h2>{recommendation.name}</h2>
                  <p className={appUi.muted}>
                    {recommendation.code} · {recommendation.universityCode} · {recommendation.year}
                  </p>
                  {recommendation.description && <p>{briefDescription(recommendation.description)}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className={appUi.muted}>We couldn&apos;t find a course match yet — a few more questions will help.</p>
          )}
          <p className={appUi.lead}>
            Want a more precise match? A few more questions about your specific interests will refine this and
            suggest the best major or stream within your matched course.
          </p>
          <div className={appUi.quizFormFooter}>
            <button className={appUi.primaryButton} type="button" onClick={continueToDrillDown}>
              Personalise further
            </button>
          </div>
        </section>
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
