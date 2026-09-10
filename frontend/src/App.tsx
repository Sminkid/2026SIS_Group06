import { useState } from "react";
import type { DegreeSummary, University } from "./types/handbook";
import { DegreePage } from "./pages/DegreePage";
import { DegreeSelectionPage } from "./pages/DegreeSelectionPage";
import { HomePage } from "./pages/HomePage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";

type Screen =
  | { name: "universities" }
  | { name: "degrees"; university: University }
  | { name: "degree"; university: University; degree: DegreeSummary };

export const App = () => {
  const [screen, setScreen] = useState<Screen>({
    name: "universities",
  });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <button
          className="brand"
          type="button"
          onClick={() => setScreen({ name: "universities" })}
          aria-label="Degree planner home"
        >
          <span className="brand__mark" aria-hidden="true">
            DP
          </span>
          <span>Degree planner</span>
        </button>

        <span className="site-header__note">
          University handbook explorer
        </span>
      </header>

      <main id="main-content">
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
          />
        )}
      </main>

      <GlossaryChatWidget />
    </div>
  );
};