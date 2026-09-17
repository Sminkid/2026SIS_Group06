import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import type { CourseRecommendation } from "../domain/courseAggregation";
import type { University, DegreeSummary } from "../types/handbook";

interface Props {
  course: CourseRecommendation;
  onSelectUniversity: (university: University, degree: DegreeSummary) => void;
  onHome: () => void;
  onBackToQuizResult: () => void;
  onBackToRecommendations: () => void;
}

export const UniversityComparisonPage = ({ course, onSelectUniversity, onHome, onBackToQuizResult, onBackToRecommendations }: Props) => (
  <main className={appUi.page} id="main-content">
    <Breadcrumbs items={[{ label: "Get Started", onClick: onHome }, 
                         { label: "Quiz Result", onClick: onBackToQuizResult }, 
                         { label: "Recommendations", onClick: onBackToRecommendations }, 
                         { label: "Comparison" }]} />
    <section className={appUi.pageIntroCompact} aria-labelledby="compare-heading">
      <p className={appUi.eyebrow}>Explore universities</p>
      <h1>Compare</h1>
      <h2 id="compare-heading">Compare universities for {course.courseName}</h2>
      <div className={appUi.universityGrid}>
        {course.offerings.map(({ university, degree }) => (
          <button
            className={appUi.universityCard}
            type="button"
            key={university.id}
            onClick={() => onSelectUniversity(university, degree)}
          >
            <span className={appUi.universityCardCode}>{university.code}</span>
            <span className={appUi.universityCardName}>{university.name}</span>
            <p>{degree.name}</p>
            <p>{degree.creditPoints === null ? "CP not listed" : `${degree.creditPoints} CP`}</p>
            <span className={appUi.cardAction} aria-hidden="true">View study plan →</span>
          </button>
        ))}
      </div>
    </section>
  </main>
);