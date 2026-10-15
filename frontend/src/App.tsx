import { appUi } from "./components/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QuizPage } from "./pages/InterestQuizPage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";
import { NavLink } from "./components/NavLink";
import { LandingPage } from "./pages/LandingPage";
import { QuizResultPage } from "./pages/QuizResultPage";
import { CourseRecommendationsPage } from "./pages/CourseRecommendationsPage";
import { UniversityComparisonPage } from "./pages/UniversityComparisonPage";
import { DegreePage } from "./pages/DegreePage";
import { HomePage } from "./pages/HomePage";
import { DegreeSelectionPage } from "./pages/DegreeSelectionPage";
import type { BreadcrumbItem } from "./components/Breadcrumbs";
import { useQuizSession } from "./hooks/useQuizSession";
import type { DegreeMatchTarget } from "./api/quiz";
import type { QuizResult } from "./domain/quizRecommendation";
import type { CourseRecommendation } from "./domain/courseAggregation";
import type { University, DegreeSummary } from "./types/handbook";
import logo from "./components/ui/icons/Logo.png";

type Screen =
    { name: "landing" } |
    { name: "quiz" } |
    { name: "quizResult"; result: QuizResult } |
    { name: "courseRecommendation"; result: QuizResult } |
    { name: "allCourses" } |
    // `result` is null when the course was reached by browsing all courses, without the quiz.
    { name: "universityComparison"; result: QuizResult | null; course: CourseRecommendation } |
    { 
      name: "degree"; 
      result: QuizResult | null;
      course: CourseRecommendation;
      university: University; 
      degree: DegreeSummary; 
    } |
    // The handbook route: pick a university, then one of its degrees, without the quiz or the comparison.
    { name: "universities" } |
    { name: "degrees"; university: University } |
    { name: "handbookDegree"; university: University; degree: DegreeSummary }

/** A degree the quiz was launched from, so its result is matched to that degree and can return to it. */
interface QuizLaunchTarget {
  university: University;
  degree: DegreeSummary;
  returnTo: Screen;
}

/** Coordinates the quiz, course recommendation, comparison and degree screens within the shared navigation shell. */
const SCREEN_NAMES = new Set<string>(["landing", "quiz", "quizResult", "courseRecommendation", "allCourses", "universityComparison", "degree", "universities", "degrees", "handbookDegree"]);

/**
 * The screen saved in the current browser history entry, so a reload stays on the same screen.
 * Null for entries without one, such as those added by in-page links like "#how-it-works".
 */
const savedScreen = (): Screen | null => {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && SCREEN_NAMES.has((state as { name?: string }).name ?? "")
    ? state as Screen : null;
};

export const App = () => {
  const [screen, setScreenState] = useState<Screen>(() => savedScreen() ?? { name: "landing" });
  // Every screen change is a browser history entry, so the browser's back and forward buttons
  // move between screens the same way the breadcrumbs do.
  const setScreen = useCallback((next: Screen) => {
    window.history.pushState(next, "");
    setScreenState(next);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (!savedScreen()) window.history.replaceState({ name: "landing" } satisfies Screen, "");
    // In-page links keep the current screen, so only entries with a saved screen change it.
    const restore = () => { const saved = savedScreen(); if (saved) setScreenState(saved); };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const [quizTarget, setQuizTarget] = useState<QuizLaunchTarget | undefined>();
  const matchTarget = useMemo<DegreeMatchTarget | undefined>(
    () =>
      quizTarget
        ? { degreeCode: quizTarget.degree.code, university: quizTarget.university.code, year: quizTarget.degree.handbookYear }
        : undefined,
    [quizTarget],
  );
  // The quiz session lives here rather than in QuizPage so a student can look at their initial
  // results and course recommendations, then come back and continue the same session to
  // personalise further without having to start over.
  const quiz = useQuizSession(matchTarget);

  const goHome = () => setScreen({ name: "landing" });

  /** Back to wherever the course list was opened from: the recommendations, or the full list. */
  const backToCourses = (result: QuizResult | null): Screen =>
    result ? { name: "courseRecommendation", result } : { name: "allCourses" };
  const backToQuizResult = (result: QuizResult | null) =>
    result ? () => setScreen({ name: "quizResult", result }) : undefined;

  const startNewQuiz = (target?: QuizLaunchTarget) => {
    setQuizTarget(target);
    quiz.restart();
    setScreen({ name: "quiz" });
  };

  const continuePersonalising = () => {
    quiz.continueToDrillDown();
    setScreen({ name: "quiz" });
  };

  return (
    <div className={appUi.appShell}>
      <a className={appUi.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={appUi.siteHeader}>
        <button
          className={appUi.brand}
          type="button"
          onClick={goHome}
          aria-label="UniXPrep home"
        >
          <img src={logo} className={appUi.brandMark}/>
        </button>

        <nav className={appUi.siteHeaderNav} aria-label="Primary">
          <NavLink
            label="Interest Quiz"
            description="Answer 20 quick questions to find your Holland Code, then see which courses suit your interests."
            onClick={() => startNewQuiz()}
          />
          <NavLink
            label="View All Courses"
            description="Browse every course offered by UNSW, USYD and UTS, and compare the universities that offer it."
            onClick={() => setScreen({ name: "allCourses" })}
          />
          <NavLink
            label="University Handbooks"
            description="Choose a university to explore its official handbook: its degrees, their requirements and study plans."
            onClick={() => setScreen({ name: "universities" })}
          />
        </nav>
      </header>

      <main className={appUi.appMain}>
        {screen.name === "landing" && (
          // The landing page has no <main> of its own, so this wrapper is the skip link's target.
          <div className="min-w-0 flex-1" id="main-content">
            <LandingPage
              onStartQuiz={() => startNewQuiz()}
              // A comparison is always for one course, so both routes start by choosing a course.
              onPlan={() => setScreen({ name: "allCourses" })}
              onBrowseCourses={() => setScreen({ name: "allCourses" })}
            />
          </div>
        )}

        {screen.name === "quiz" && (
          <QuizPage
            session={quiz}
            onHome={goHome}
            onBackToDegree={quizTarget ? () => setScreen(quizTarget.returnTo) : undefined}
            onComplete={(result) => setScreen({ name: "quizResult", result })}
          />
        )}

        {screen.name === "quizResult" && (
          <QuizResultPage 
            result={screen.result}
            onViewCourses={() => setScreen({ name: "courseRecommendation", result: screen.result })}
            onPersonalise={continuePersonalising}
            onRetake={() => startNewQuiz(quizTarget)}
            onHome={goHome}
            onBackToDegree={quizTarget ? () => setScreen(quizTarget.returnTo) : undefined}
          />
        )}

        {screen.name === "courseRecommendation" && (
          <CourseRecommendationsPage 
            result={screen.result}
            onSelectCourse={(course) => setScreen({ name: "universityComparison", result: screen.result, course })}
            onHome={goHome}
            onBackToQuizResult={() => setScreen({ name: "quizResult", result: screen.result})}
            onPersonalise={continuePersonalising}
            />
        )}

        {screen.name === "allCourses" && (
          <CourseRecommendationsPage
            result={null}
            onSelectCourse={(course) => setScreen({ name: "universityComparison", result: null, course })}
            onHome={goHome}
            onStartQuiz={() => startNewQuiz()}
          />
        )}

        {screen.name === "universityComparison" && (
          <UniversityComparisonPage key={screen.course.courseKey}
            course={screen.course} 
            onSelectUniversity={(university, degree) =>
              setScreen({ name: "degree", result: screen.result, course: screen.course, university, degree })
            }
            onHome={goHome}
            onBackToQuizResult={backToQuizResult(screen.result)}
            onBackToRecommendations={() => setScreen(backToCourses(screen.result))}
            recommendationsLabel={screen.result ? undefined : "All Courses"}
          />
        )}

        {screen.name === "degree" && (
          <DegreePage 
            university={screen.university} degree={screen.degree}
            breadcrumbs={[
              { label: "Home", onClick: goHome },
              ...(screen.result ? [{ label: "Quiz Result", onClick: backToQuizResult(screen.result) }] : []),
              { label: screen.result ? "Recommendations" : "All Courses", onClick: () => setScreen(backToCourses(screen.result)) },
              { label: "Comparison", onClick: () => setScreen({ name: "universityComparison", result: screen.result, course: screen.course }) },
            ] satisfies BreadcrumbItem[]}
            onStartQuiz={() =>
              startNewQuiz({ university: screen.university, degree: screen.degree, returnTo: screen })
            }
          />
        )}

        {screen.name === "universities" && (
          <HomePage onHome={goHome} onSelectUniversity={(university) => setScreen({ name: "degrees", university })} />
        )}

        {screen.name === "degrees" && (
          <DegreeSelectionPage
            university={screen.university}
            onHome={goHome}
            onBack={() => setScreen({ name: "universities" })}
            onSelectDegree={(degree) => setScreen({ name: "handbookDegree", university: screen.university, degree })}
          />
        )}

        {screen.name === "handbookDegree" && (
          <DegreePage
            university={screen.university} degree={screen.degree}
            breadcrumbs={[
              { label: "Home", onClick: goHome },
              { label: "University Handbooks", onClick: () => setScreen({ name: "universities" }) },
              { label: screen.university.code, onClick: () => setScreen({ name: "degrees", university: screen.university }) },
            ]}
            onStartQuiz={() =>
              startNewQuiz({ university: screen.university, degree: screen.degree, returnTo: screen })
            }
          />
        )}
      </main>
      
      <GlossaryChatWidget />
    </div>
  );
};
