import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import type { QuizResult } from "../domain/quizRecommendation";

interface Props { result: QuizResult; onViewCourses: () => void; onHome: () => void; }

export const QuizResultPage = ({ result, onViewCourses, onHome }: Props) => (
  <main className={appUi.page} id="main-content">
    <Breadcrumbs items={[{ label: "Get Started", onClick: onHome }, { label: "Quiz Result" }]} />
    <section className={appUi.pageIntroCompact}>
      <p className={appUi.eyebrow}>Your result</p>
      <h1>{result.primaryInterest}</h1>
      <p className={appUi.lead}>{result.summary}</p>
      <button className={appUi.primaryButton} type="button" onClick={onViewCourses}>
        View course recommendations
      </button>
    </section>
  </main>
);