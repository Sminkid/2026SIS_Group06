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
        <h2 id="courses-heading">Recommended courses</h2>
        {status === "loading" && <AsyncState kind="loading" label="Finding matching courses" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load course recommendations." />}
        {status === "ready" && courses.length === 0 && <AsyncState kind="empty" label="No matching courses found." />}
        {status === "ready" && (
          <div className={appUi.degreeList}>
            {courses.map((course) => (
              <button className={appUi.degreeRow} type="button" key={course.courseName} onClick={() => onSelectCourse(course)}>
                <span className={appUi.degreeRowName}>{course.courseName}</span>
                <span className={appUi.degreeRowCp}>{course.offerings.length} universities offer this</span>
                <span className={appUi.degreeRowArrow} aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};