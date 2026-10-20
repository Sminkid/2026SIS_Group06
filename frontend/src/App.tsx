import { appUi } from "./components/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuizPage } from "./pages/InterestQuizPage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";
import { NavLink } from "./components/NavLink";
import { LeaveDegreeDialog } from "./components/LeaveDegreeDialog";
import { clearDegreeProgress } from "./domain/degreeReset";
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
import logo from "./components/ui/icons/unixprep-logo.svg";

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
/** Where the current entry sits in this tab's history, as numbered by the app; null for entries it didn't add. */
const historyIndex = (): number | null => {
  const index = (window.history.state as { historyIndex?: unknown } | null)?.historyIndex;
  return typeof index === "number" ? index : null;
};

/** The study plan pages, which reset when the user leaves or refreshes them. */
const isDegreeScreen = (screen: Screen) => screen.name === "degree" || screen.name === "handbookDegree";

const savedScreen = (): Screen | null => {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && SCREEN_NAMES.has((state as { name?: string }).name ?? "")
    ? state as Screen : null;
};

export const App = () => {
  const [screen, setScreenState] = useState<Screen>(() => savedScreen() ?? { name: "landing" });
  const screenRef = useRef(screen);
  screenRef.current = screen;
  // Each entry this app adds to the tab's history is numbered, so a Back/Forward away from a degree page can be
  // undone while the user decides, without adding extra entries.
  const indexRef = useRef(historyIndex() ?? 0);
  // The next popstate is the app's own move: back to the degree page, or on to the destination the user confirmed.
  const ownMoveRef = useRef<"return" | "leave" | null>(null);
  // Leaving a degree page waits for the user to confirm the reset. `delta` is set when the browser moved (Back/Forward).
  const [pendingLeave, setPendingLeave] = useState<{ next: Screen; delta: number | null } | null>(null);
  // Every screen change is a browser history entry, so the browser's back and forward buttons
  // move between screens the same way the breadcrumbs do.
  const goTo = useCallback((next: Screen) => {
    indexRef.current += 1;
    window.history.pushState({ ...next, historyIndex: indexRef.current }, "");
    setScreenState(next);
    window.scrollTo(0, 0);
  }, []);
  const setScreen = useCallback((next: Screen) => {
    if (isDegreeScreen(screenRef.current)) setPendingLeave({ next, delta: null });
    else goTo(next);
  }, [goTo]);
  useEffect(() => {
    if (!savedScreen()) window.history.replaceState({ name: "landing", historyIndex: 0 }, "");
    else if (historyIndex() === null) window.history.replaceState({ ...window.history.state, historyIndex: 0 }, "");
    const restore = () => {
      const saved = savedScreen();
      const index = historyIndex();
      if (ownMoveRef.current === "return") { ownMoveRef.current = null; return; }
      // In-page links keep the current screen, so only entries with a saved screen change it.
      if (!saved) return;
      if (ownMoveRef.current === "leave") {
        ownMoveRef.current = null;
        indexRef.current = index ?? indexRef.current;
        setScreenState(saved);
        window.scrollTo(0, 0);
        return;
      }
      const delta = index === null ? null : index - indexRef.current;
      if (isDegreeScreen(screenRef.current) && delta !== null) {
        // Coming back from an in-page link's entry lands on the same degree page; nothing changes.
        if (delta === 0) return;
        // The browser has already moved; step back to the degree page until the user confirms.
        ownMoveRef.current = "return";
        window.history.go(-delta);
        setPendingLeave({ next: saved, delta });
        return;
      }
      indexRef.current = index ?? indexRef.current;
      setScreenState(saved);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  // Refreshing or closing the tab can't show our own pop-up, so the browser shows its built-in "Leave site?"
  // warning instead; the page is reset only if the user goes ahead.
  const onDegreePage = isDegreeScreen(screen);
  useEffect(() => {
    if (!onDegreePage) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", clearDegreeProgress);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", clearDegreeProgress);
    };
  }, [onDegreePage]);

  const confirmLeave = () => {
    if (!pendingLeave) return;
    clearDegreeProgress();
    if (pendingLeave.delta === null) goTo(pendingLeave.next);
    else {
      // Redo the Back/Forward step the user took.
      ownMoveRef.current = "leave";
      window.history.go(pendingLeave.delta);
    }
    setPendingLeave(null);
  };
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
      
      {pendingLeave && <LeaveDegreeDialog onConfirm={confirmLeave} onStay={() => setPendingLeave(null)} />}
      <GlossaryChatWidget />
    </div>
  );
};
