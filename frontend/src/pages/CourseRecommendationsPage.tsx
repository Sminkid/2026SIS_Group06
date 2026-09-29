import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useCourseRecommendations } from "../hooks/useCourseRecommendations";
import { AsyncState } from "../components/AsyncState";
import type { QuizResult } from "../domain/quizRecommendation";
import type { CourseRecommendation } from "../domain/courseAggregation";

interface Props {
  result: QuizResult;
  onSelectCourse: (course: CourseRecommendation) => void;
  onHome: () => void;
  onBackToQuizResult: () => void;
}

export const CourseRecommendationsPage = ({ result, onSelectCourse, onHome, onBackToQuizResult }: Props) => {
  const { courses, status } = useCourseRecommendations(result);

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Get Started", onClick: onHome }, 
                            { label: "Quiz Result", onClick: onBackToQuizResult }, 
                            { label: "Recommendations" }]} />
      <section className={appUi.pageIntroCompact} aria-labelledby="courses-heading">
        <p className={appUi.eyebrow}>Choose a course</p>
        <h1>Courses</h1>
        <section className={appUi.degreeTools}>
          <h2 id="courses-heading">Recommended courses</h2>
          <label className={appUi.searchField}><span className={appUi.srOnly}>Search degrees by code or name</span><span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Search by code or degree name" />
          </label>
        </section>
        {status === "loading" && <AsyncState kind="loading" label="Finding matching courses" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load course recommendations." />}
        {status === "ready" && courses.length === 0 && <AsyncState kind="empty" label="No matching courses found." />}
        {status === "ready" && (
          <div className={appUi.degreeGrid}>
            {courses.map((course) => (
              <div className={appUi.degreeCard}>
                <h3>{course.courseName}</h3>
                <div className={appUi.degreeRowArrow}>
                  <button className={appUi.textButton} type="button" key={course.courseName} onClick={() => onSelectCourse(course)} aria-hidden="true">
                    {course.offerings.length} universities offer this →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <section className={appUi.contentSection}></section>
      </section>
    </main>
  );
};