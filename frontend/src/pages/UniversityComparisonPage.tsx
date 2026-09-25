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
      <table className="w-full h-full table-fixed text-center border-separate border-spacing-5">
        <thead>
          <th></th>
          <th className={appUi.universityCard}>University one</th>
          <th className={appUi.universityCard}>University two</th>
          <th><button className={appUi.secondaryButton}>Add univeristy</button></th>
        </thead>
        <tbody>
          <tr id="course-code">
            <th className="border">course code</th>
            <td>unknown</td>
            <td>unknown</td>
          </tr>
          <tr id="duration">
            <th className="border">duration</th>
            <td>unknown</td>
            <td>unknown</td>
          </tr>
          <tr id="tuition-fee">
            <th className="border">Annual tuition fee</th>
            <td>unknown</td>
            <td>unknown</td>
          </tr>
          <tr id="ranking">
            <th className="border">Ranking</th>
            <td>unknown</td>
            <td>unknown</td>
          </tr>
          <tr id="location">
            <th className="border">Campus location</th>
            <td>unknown</td>
            <td>unknown</td>
          </tr>
          <tr id="employment-rate">
            <th className="border">Employment rate</th>
            <td>unknown</td>
            <td>unknown</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
);