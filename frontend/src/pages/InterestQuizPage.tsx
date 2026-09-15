import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import type { QuizResult } from "../domain/quizRecommendation.ts";
import { buildPlaceholderQuizResult } from "../domain/quizRecommendation";

interface Props { onComplete: (result: QuizResult) => void; onBack: () => void; }

export const InterestQuizPage = ({ onComplete, onBack }: Props) => (
  <main className={appUi.page} id="main-content">
    <Breadcrumbs items={[{ label: "Get Started", onClick: onBack }, { label: "Quiz" }]} />
    <section className={appUi.pageIntroCompact}>
      <p className={appUi.eyebrow}>Interest quiz</p>
      <h1>Quiz questions go here</h1>
      <p className={appUi.lead}>This step is a placeholder — wire up real questions later.</p>
      <button
        className={appUi.primaryButton}
        type="button"
        onClick={() => onComplete(buildPlaceholderQuizResult())}
      >
        See my results
      </button>
    </section>
  </main>
);