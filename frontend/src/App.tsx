import { appUi } from "./components/ui";
import { useState } from "react";
import { DegreeSelectionPage } from "./pages/DegreeSelectionPage";
import { HomePage } from "./pages/HomePage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";
import { GetStartedPage } from "./pages/GetStartedPage";
import { InterestQuizPage } from "./pages/InterestQuizPage";
import { QuizResultPage } from "./pages/QuizResultPage";
import { CourseRecommendationsPage } from "./pages/CourseRecommendationsPage";
import { UniversityComparisonPage } from "./pages/UniversityComparisonPage";
import { DegreePage } from "./pages/DegreePage";
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
    };

/** Coordinates the university, degree and handbook screens within the shared navigation shell. */
export const App = () => {
  const [screen, setScreen] = useState<Screen>({
    name: "getStarted",
  });

  return (
    <div className={appUi.appShell}>
      <a className={appUi.skipLink} href="#main-content">
        Skip to main content
      </a>

      <div className={appUi.appMain}>
        <header className={appUi.siteHeader}>
          <button
            className={appUi.brand}
            type="button"
            onClick={() => setScreen({ name: "getStarted" })}
            aria-label="Degree planner home"
          >
            <img src={logo} className={appUi.brandMark}/>
          </button>

            <span className={appUi.siteHeaderNote}>
              University handbook explorer
            </span>
        </header>

        <main className="min-w-0">
          {screen.name === "getStarted" && (
            <GetStartedPage onStart={() => setScreen({ name: "quiz" })} />
          )}

          {screen.name === "quiz" && (
            <InterestQuizPage 
              onComplete={(result) => setScreen({ name: "quizResult", result })}
              onBack={() => setScreen({ name: "getStarted" })} 
            />
          )}

          {screen.name === "quizResult" && (
            <QuizResultPage 
              result={screen.result}
              onViewCourses={() => setScreen({ name: "courseRecommendation", result: screen.result })}
              onHome={() => setScreen({ name: "getStarted" })}
            />
          )}

          {screen.name === "courseRecommendation" && (
            <CourseRecommendationsPage 
              result={screen.result}
              onSelectCourse={(course) => setScreen({ name: "universityComparison", result: screen.result, course })}
              onHome={() => setScreen({ name: "getStarted" })}
              onBackToQuizResult={() => setScreen({ name: "quizResult", result: screen.result})}
              />
          )}

          {screen.name === "universityComparison" && (
            <UniversityComparisonPage 
              course={screen.course} 
              onSelectUniversity={(university, degree) =>
                setScreen({ name: "degree", result: screen.result, course: screen.course, university, degree })
              }
              onHome={() => setScreen({ name: "getStarted" })}
              onBackToQuizResult={() => setScreen({ name: "quizResult", result: screen.result })}
              onBackToRecommendations={() => setScreen({ name: "courseRecommendation", result: screen.result })}
            />
          )}

          {screen.name === "degree" && (
            <DegreePage 
              university={screen.university} degree={screen.degree}
              onHome={() => setScreen({ name: "getStarted" })}
              onBackToQuizResult={() => setScreen({ name: "quizResult", result: screen.result })}
              onBackToRecommendations={() => setScreen({ name: "courseRecommendation", result: screen.result })}
              onBackToComparison={() => setScreen({ name: "universityComparison", result: screen.result, course: screen.course })}
            />
          )}

        </main>
      </div>

      <GlossaryChatWidget />
    </div>
  );
};
