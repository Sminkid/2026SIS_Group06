import { useMemo, useState } from "react";
import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useCourseRecommendations } from "../hooks/useCourseRecommendations";
import { AsyncState } from "../components/AsyncState";
import type { QuizResult } from "../domain/quizRecommendation";
import { filterCourses, type CourseRecommendation } from "../domain/courseAggregation";

interface Props {
  result: QuizResult;
  onSelectCourse: (course: CourseRecommendation) => void;
  onHome: () => void;
  onBackToQuizResult: () => void;
}

export const CourseRecommendationsPage = ({ result, onSelectCourse, onHome, onBackToQuizResult }: Props) => {
  const { courses, otherCourses, status } = useCourseRecommendations(result);
  const [query, setQuery] = useState("");
  const shownRecommended = useMemo(() => filterCourses(courses, query), [courses, query]);
  const shownOthers = useMemo(() => filterCourses(otherCourses, query), [otherCourses, query]);
  const hasQuery = query.trim() !== "";
 
  const renderCard = (course: CourseRecommendation) => (
    <div className={appUi.degreeCard} key={course.courseName}>
      <h3>{course.courseName}</h3>
      <div className={appUi.degreeRowArrow}>
        <button className={appUi.textButton} type="button" onClick={() => onSelectCourse(course)}>
          {course.offerings.length} {course.offerings.length === 1 ? "university offers" : "universities offer"} this →
        </button>
      </div>
    </div>
  );

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
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by code or degree name" />
          </label>
        </section>
        {status === "loading" && <AsyncState kind="loading" label="Finding matching courses" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load course recommendations." />}
        {status === "ready" && courses.length === 0 && <AsyncState kind="empty" label="No matching courses found." />}
        {status === "ready" && (courses.length > 0 || otherCourses.length > 0) && shownRecommended.length === 0 && shownOthers.length === 0 && (
          <AsyncState kind="empty" label={`No courses match “${query}”.`} />
        )}
        {status === "ready" && shownRecommended.length > 0 && (
          <div className={appUi.degreeGrid} aria-live="polite">{shownRecommended.map(renderCard)}</div>
        )}
        <section className={appUi.contentSection}></section>
        {status === "ready" && shownOthers.length > 0 && (
          <section aria-labelledby="other-courses-heading">
            <section className={appUi.degreeTools}>
              <h2 id="other-courses-heading">{hasQuery ? "Other matching courses" : "Other courses"}</h2>
            </section>
            <div className={appUi.degreeGrid}>{shownOthers.map(renderCard)}</div>
          </section>
        )}
      </section>
    </main>
  );
};