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
      
      <div className={appUi.tableWrapper}>
        <table className={appUi.comparisonTable}>
          <thead>
            <tr>
              <th></th>
              {course.offerings.map(({ university }) => (
                <th key={university.id}><div className={appUi.universityCard}>{university.name}</div></th>
              ))}
              <th><button className={appUi.secondaryButton} type="button">Add university</button></th>
            </tr>
          </thead>
          <tbody>
            <tr id="course-code">
              <th className={appUi.uniInfo}>Course code</th>
              {course.offerings.map(({ university, degree }) => (
                <td key={university.id}><div className={appUi.uniInfo}>{degree.code}</div></td>
              ))}
            </tr>
            <tr id="duration">
              <th className={appUi.uniInfoAlt}>Duration</th>
              {course.offerings.map(({ university }) => (
                <td key={university.id}><div className={appUi.uniInfoAlt}>unknown</div></td>
              ))}
            </tr>
            <tr id="tuition-fee">
              <th className={appUi.uniInfo}>Annual tuition fee</th>
              {course.offerings.map(({ university }) => (
                <td key={university.id}><div className={appUi.uniInfo}>unknown</div></td>
              ))}
            </tr>
            <tr id="ranking">
              <th className={appUi.uniInfoAlt}>Ranking</th>
              {course.offerings.map(({ university }) => (
                <td key={university.id}><div className={appUi.uniInfoAlt}>unknown</div></td>
              ))}
            </tr>
            <tr id="location">
              <th className={appUi.uniInfo}>Campus location</th>
              {course.offerings.map(({ university }) => (
                <td key={university.id}><div className={appUi.uniInfo}>unknown</div></td>
              ))}
            </tr>
            <tr id="employment-rate">
              <th className={appUi.uniInfoAlt}>Employment rate</th>
              {course.offerings.map(({ university }) => (
                <td key={university.id}><div className={appUi.uniInfoAlt}>unknown</div></td>
              ))}
            </tr>
            <tr>
              <td></td>
              {course.offerings.map(({ university, degree }) => (
                <td key={university.id}>
                  <button className={appUi.viewPlanButton} type="button" onClick={() => onSelectUniversity(university, degree)}>
                    View Study Plan
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      
    </section>
  </main>
);