import { appUi } from "./components/ui";
import { useState } from "react";
import type { DegreeSummary, University } from "./types/handbook";
import { DegreePage } from "./pages/DegreePage";
import { DegreeSelectionPage } from "./pages/DegreeSelectionPage";
import { HomePage } from "./pages/HomePage";
import { QuizPage } from "./pages/QuizPage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";

type Screen =
  | { name: "universities" }
  | { name: "degrees"; university: University }
  | { name: "degree"; university: University; degree: DegreeSummary }
  | { name: "quiz"; university?: University; degree?: DegreeSummary };

/** Coordinates the university, degree and handbook screens within the shared navigation shell. */
export const App = () => {
  const [screen, setScreen] = useState<Screen>({
    name: "universities",
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
            onClick={() => setScreen({ name: "universities" })}
            aria-label="Degree planner home"
          >
            <span className={appUi.brandMark} aria-hidden="true">
              DP
            </span>
            <span>Degree planner</span>
          </button>

          <span className={appUi.siteHeaderNote}>
            University handbook explorer
          </span>

          <nav className={appUi.siteHeaderNav} aria-label="Primary">
            <button
              className={appUi.textButton}
              type="button"
              onClick={() => setScreen({ name: "universities" })}
            >
              Universities
            </button>
            <button
              className={appUi.textButton}
              type="button"
              onClick={() => setScreen({ name: "quiz" })}
            >
              Interest quiz
            </button>
          </nav>
        </header>

        <main id="main-content" className="min-w-0">
          {screen.name === "universities" && (
            <HomePage
              onSelectUniversity={(university) =>
                setScreen({ name: "degrees", university })
              }
            />
          )}

          {screen.name === "degrees" && (
            <DegreeSelectionPage
              university={screen.university}
              onBack={() => setScreen({ name: "universities" })}
              onSelectDegree={(degree) =>
                setScreen({
                  name: "degree",
                  university: screen.university,
                  degree,
                })
              }
            />
          )}

          {screen.name === "degree" && (
            <DegreePage
              university={screen.university}
              degree={screen.degree}
              onBack={() =>
                setScreen({
                  name: "degrees",
                  university: screen.university,
                })
              }
              onHome={() => setScreen({ name: "universities" })}
              onStartQuiz={() =>
                setScreen({
                  name: "quiz",
                  university: screen.university,
                  degree: screen.degree,
                })
              }
            />
          )}

          {screen.name === "quiz" && (
            <QuizPage
              university={screen.university}
              degree={screen.degree}
              onBack={() =>
                screen.university && screen.degree
                  ? setScreen({
                      name: "degree",
                      university: screen.university,
                      degree: screen.degree,
                    })
                  : setScreen({ name: "universities" })
              }
              onHome={() => setScreen({ name: "universities" })}
            />
          )}
        </main>
      </div>

      <GlossaryChatWidget />
    </div>
  );
};
