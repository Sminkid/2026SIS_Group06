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
  <main className="page" id="main-content">
    <Breadcrumbs items={[{ label: "Get Started", onClick: onHome }, 
                         { label: "Quiz Result", onClick: onBackToQuizResult }, 
                         { label: "Recommendations", onClick: onBackToRecommendations }, 
                         { label: "Comparison" }]} />
    <section className="content-section" aria-labelledby="compare-heading">
      <h2 id="compare-heading">Compare universities for {course.courseName}</h2>
      <div className="university-grid">
        {course.offerings.map(({ university, degree }) => (
          <button
            className="university-card"
            type="button"
            key={university.id}
            onClick={() => onSelectUniversity(university, degree)}
          >
            <span className="university-card__code">{university.code}</span>
            <span className="university-card__name">{university.name}</span>
            <p>{degree.name}</p>
            <p>{degree.creditPoints === null ? "CP not listed" : `${degree.creditPoints} CP`}</p>
            <span className="card-action" aria-hidden="true">View study plan →</span>
          </button>
        ))}
      </div>
    </section>
  </main>
);