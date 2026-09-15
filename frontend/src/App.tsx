import { appUi } from "./components/ui";
import { useState } from "react";
import type { DegreeSummary, University } from "./types/handbook";
import { DegreePage } from "./pages/DegreePage";
import { DegreeSelectionPage } from "./pages/DegreeSelectionPage";
import { HomePage } from "./pages/HomePage";
import { GlossaryChatWidget } from "./components/GlossaryChatWidget";
import { GetStartedPage } from "./pages/GetStartedPage";
import logo from "./components/ui/icons/Logo.png";

type Screen =
    { name: "getStarted" }
    // { name: "universities" }
  // | { name: "degrees"; university: University }
  // | { name: "degree"; university: University; degree: DegreeSummary };

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

      <div className="min-w-0">
        {screen.name === "getStarted" && (
          <GetStartedPage onStart={() => setScreen({ name: "getStarted" })} />
        )}

        {/* {screen.name === "universities" && (
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
        )} */}
      </div>

      <GlossaryChatWidget />
    </div>
  );
};
