import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatScorePercent } from "../domain/quizResult";
import type { QuizResult } from "../domain/quizRecommendation";

interface Props { result: QuizResult; onViewCourses: () => void; onHome: () => void; onRetakeQuiz?: () => void; }

export const QuizResultPage = ({ result, onViewCourses, onHome, onRetakeQuiz }: Props) => (
  <main className={appUi.page} id="main-content">
    <Breadcrumbs items={[{ label: "Get Started", onClick: onHome }, { label: "Quiz Result" }]} />
    <section className={appUi.pageIntroCompact}>
      <p className={appUi.eyebrow}>Your result</p>
      <h1>{result.primaryInterest}</h1>
      <p className={appUi.lead}>{result.summary}</p>

      {result.rankedInterests && result.rankedInterests.length > 0 && (
        <ul className={appUi.quizScoreList} aria-label="Interest scores">
          {result.rankedInterests.map((interest) => (
            <li key={interest.id}>
              <strong>{interest.name}</strong>
              <span>{formatScorePercent(interest.score)}</span>
            </li>
          ))}
        </ul>
      )}

      {result.suggestedMajor && (
        <div className={appUi.quizRecommendationCard}>
          <p className={appUi.eyebrow}>Suggested match</p>
          <h2>{result.suggestedMajor.name}</h2>
          <p className={appUi.muted}>{result.suggestedMajor.code} · {result.suggestedMajor.type}</p>
        </div>
      )}

      <div className={appUi.buttonContainer}>
        {onRetakeQuiz && (
          <button className={appUi.backButton} type="button" onClick={onRetakeQuiz}>
            Retake quiz
          </button>
        )}
        <button className={appUi.primaryButton} type="button" onClick={onViewCourses}>
          View course recommendations
        </button>
      </div>
    </section>
  </main>
);