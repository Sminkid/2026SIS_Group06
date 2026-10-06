import { appUi } from "./components/ui";
import { useMemo, useState } from "react";
import { QuizPage } from "./pages/InterestQuizPage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";
import { GetStartedPage } from "./pages/GetStartedPage";
import { QuizResultPage } from "./pages/QuizResultPage";
import { CourseRecommendationsPage } from "./pages/CourseRecommendationsPage";
import { UniversityComparisonPage } from "./pages/UniversityComparisonPage";
import { DegreePage } from "./pages/DegreePage";
import { useQuizSession } from "./hooks/useQuizSession";
import type { DegreeMatchTarget } from "./api/quiz";
import type { QuizResult } from "./domain/quizRecommendation";
import type { CourseRecommendation } from "./domain/courseAggregation";
import type { University, DegreeSummary } from "./types/handbook";
import logo from "./components/ui/icons/Logo.png";

type Screen =
    { name: "getStarted" } |
    { name: "quiz" } |
    { name: "quizResult"; result: QuizResult } |
    { name: "courseRecommendation"; result: QuizResult } |
    { name: "universityComparison"; result: QuizResult; course: CourseRecommendation } |
    { 
      name: "degree"; 
      result: QuizResult;
      course: CourseRecommendation;
      university: University; 
      degree: DegreeSummary; 
    }

/** A degree the quiz was launched from, so its result is matched to that degree and can return to it. */
interface QuizLaunchTarget {
  university: University;
  degree: DegreeSummary;
  returnTo: Screen;
}

/** Coordinates the quiz, course recommendation, comparison and degree screens within the shared navigation shell. */
export const App = () => {
  const [screen, setScreen] = useState<Screen>({
    name: "getStarted",
  });
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

  const goHome = () => setScreen({ name: "getStarted" });

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
          aria-label="Degree planner home"
        >
          <img src={logo} className={appUi.brandMark}/>
        </button>

          <span className={appUi.siteHeaderNote}>
            University handbook explorer
          </span>

          <nav className={appUi.siteHeaderNav} aria-label="Primary">
            <button
              className={appUi.textButton}
              type="button"
              onClick={() => startNewQuiz()}
            >
              Interest quiz
            </button>
          </nav>
      </header>

      <main className={appUi.appMain}>
        {screen.name === "getStarted" && (
          <GetStartedPage onStart={() => startNewQuiz()} />
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

        {screen.name === "universityComparison" && (
          <UniversityComparisonPage 
            course={screen.course} 
            onSelectUniversity={(university, degree) =>
              setScreen({ name: "degree", result: screen.result, course: screen.course, university, degree })
            }
            onHome={goHome}
            onBackToQuizResult={() => setScreen({ name: "quizResult", result: screen.result })}
            onBackToRecommendations={() => setScreen({ name: "courseRecommendation", result: screen.result })}
          />
        )}

        {screen.name === "degree" && (
          <DegreePage 
            university={screen.university} degree={screen.degree}
            onHome={goHome}
            onBackToQuizResult={() => setScreen({ name: "quizResult", result: screen.result })}
            onBackToRecommendations={() => setScreen({ name: "courseRecommendation", result: screen.result })}
            onBackToComparison={() => setScreen({ name: "universityComparison", result: screen.result, course: screen.course })}
          />
        )}
      </main>
      
      <GlossaryChatWidget />
    </div>
  );
};
