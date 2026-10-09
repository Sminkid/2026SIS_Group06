import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatScorePercent } from "../domain/quizResult";
import type { QuizResult } from "../domain/quizRecommendation";

interface Props {
  result: QuizResult;
  onViewCourses: () => void;
  /** Continues the same quiz session with the fine-tuning questions (initial results only). */
  onPersonalise: () => void;
  onRetake: () => void;
  onHome: () => void;
  /** Set when the quiz was launched from a degree page. */
  onBackToDegree?: () => void;
}

const TOP_DESCRIBED = 3;

/** Shows initial results first, then (optionally) the personalised result after fine-tuning. */
export const QuizResultPage = ({ result, onViewCourses, onPersonalise, onRetake, onHome, onBackToDegree }: Props) => {
  const personalised = result.stage === "personalised";

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Get Started", onClick: onHome }, { label: "Quiz Result" }]} />
      <section className={appUi.pageIntroCompact}>
        <p className={appUi.eyebrow}>{personalised ? "Your personalised result" : "Your initial result"}</p>
        <h1>{result.primaryInterest}</h1>
        <p className={appUi.lead}>{result.summary}</p>
      </section>

      <section className={appUi.quizResultSection}>
        <h2>Your top interest areas</h2>
        <ul className={appUi.quizScoreList} aria-label={personalised ? "RIASEC category scores" : "Ranked RIASEC categories"}>
          {result.rankedCategories.map((category, index) => (
            <li key={category.id}>
              {personalised && category.score !== null ? (
                <>
                  <strong>{category.name}</strong>
                  <span>{formatScorePercent(category.score)}</span>
                </>
              ) : (
                <div>
                  <strong>
                    #{index + 1} {category.name}
                  </strong>
                  {index < TOP_DESCRIBED && category.description && <p className={appUi.muted}>{category.description}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>

        {personalised && result.suggestedMajor && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Suggested major or stream</p>
            <h2>{result.suggestedMajor.name}</h2>
            <p className={appUi.muted}>
              {result.suggestedMajor.code} · {result.suggestedMajor.type}
              {result.suggestedMajorDegree &&
                ` · within ${result.suggestedMajorDegree.name} (${result.suggestedMajorDegree.universityCode})`}
            </p>
          </div>
        )}

        {!personalised && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Want a more precise match?</p>
            <p>
              These results are based on your general answers. Answer some more questions about your specific
              interests to refine them and find the best major or stream within your matched courses. You can view
              course recommendations now and come back to this whenever you like.
            </p>
            <div>
              <button className={appUi.backButton} type="button" onClick={onPersonalise}>
                Personalise further
              </button>
            </div>
          </div>
        )}

        <div className={appUi.buttonContainer}>
          <button className={appUi.backButton} type="button" onClick={onRetake}>
            Retake quiz
          </button>
          <button className={appUi.primaryButton} type="button" onClick={onViewCourses}>
            View course recommendations
          </button>
        </div>
        {onBackToDegree && (
          <div>
            <button className={appUi.textButton} type="button" onClick={onBackToDegree}>
              ← Back to degree
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
