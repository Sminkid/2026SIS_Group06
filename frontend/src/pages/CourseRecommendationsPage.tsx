import { useMemo, useState } from "react";
import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useCourseRecommendations } from "../hooks/useCourseRecommendations";
import { AsyncState } from "../components/AsyncState";
import type { QuizResult } from "../domain/quizRecommendation";
import { majorSuggestionsFor } from "../domain/quizResult";
import { filterCourses, universityCount, type CourseRecommendation } from "../domain/courseAggregation";

interface Props {
  result: QuizResult | null;
  onSelectCourse: (course: CourseRecommendation) => void;
  onHome: () => void;
  onBackToQuizResult?: () => void;
  onPersonalise?: () => void;
  onStartQuiz?: () => void;
}

export const CourseRecommendationsPage = ({ result, onSelectCourse, onHome, onBackToQuizResult, onPersonalise, onStartQuiz }: Props) => {
  const browsing = result === null;
  const { courses, otherCourses, status } = useCourseRecommendations(result);
  const [query, setQuery] = useState("");
  const shownRecommended = useMemo(() => filterCourses(courses, query), [courses, query]);
  const shownOthers = useMemo(() => filterCourses(otherCourses, query), [otherCourses, query]);
  const hasQuery = query.trim() !== "";
 
  const renderCard = (course: CourseRecommendation) => {
    const count = universityCount(course);
    return (
      <div className={appUi.degreeCard} key={course.courseKey}>
        <h3>{course.courseName}</h3>
        <div className={appUi.degreeRowArrow}>
          <button className={appUi.textButton} type="button" onClick={() => onSelectCourse(course)}>
            {count} {count === 1 ? "university offers" : "universities offer"} this →
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={browsing
        ? [{ label: "Get Started", onClick: onHome }, { label: "All Courses" }]
        : [{ label: "Get Started", onClick: onHome },
           { label: "Quiz Result", onClick: onBackToQuizResult },
           { label: "Recommendations" }]} />
      <section className={appUi.pageIntroCompact} aria-labelledby="courses-heading">
        <p className={appUi.eyebrow}>Choose a course</p>
        <h1>Courses</h1>
        {browsing && onStartQuiz && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Not sure what to study?</p>
            <p>Take the interest quiz to see which of these courses best match you.</p>
            <div>
              <button className={appUi.backButton} type="button" onClick={onStartQuiz}>
                Take the interest quiz
              </button>
            </div>
          </div>
        )}
        {result?.stage === "initial" && onPersonalise && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Based on your general answers</p>
            <p>
              Want these recommendations to be more personalised? Answer some more specific questions to refine
              your matches and see the best-fit major or stream for each course.
            </p>
            <button className={appUi.primaryButton} type="button" onClick={onPersonalise}>
              Personalise further
            </button>
          </div>
        )}
        <section className={appUi.degreeTools}>
          <h2 id="courses-heading">{browsing ? "" : "Recommended courses"}</h2>
          <label className={appUi.searchField}><span className={appUi.srOnly}>Search degrees by code or name</span><span aria-hidden="true">⌕</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by code or degree name" />
          </label>
        </section>
        {status === "loading" && <AsyncState kind="loading" label="Finding matching courses" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load course recommendations." />}
        {status === "ready" && !browsing && courses.length === 0 && <AsyncState kind="empty" label="No matching courses found." />}
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
              <h2 id="other-courses-heading">{browsing ? (hasQuery ? "Matching courses" : "Browse all courses") : hasQuery ? "Other matching courses" : "Other courses"}</h2>
              <p className={appUi.resultSummary}>Showing {shownOthers.length} courses</p>
            </section>
            <div className={appUi.degreeGrid}>{shownOthers.map(renderCard)}</div>
          </section>
        )}
      </section>
    </main>
  );
};