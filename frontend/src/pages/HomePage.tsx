import { appUi } from "../components/ui";
import { useCallback, useEffect, useState } from "react";
import { fetchUniversities } from "../api/universities";
import { AsyncState } from "../components/AsyncState";
import type { University } from "../types/handbook";

interface HomePageProps { onSelectUniversity: (university: University) => void; }

/** Lists available universities with accessible loading, retry and empty states. */
export const HomePage = ({ onSelectUniversity }: HomePageProps) => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchUniversities(controller.signal)
      .then((data) => { setUniversities(data); setStatus("ready"); })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <main className={appUi.pageLanding} id="main-content">
      <section className={appUi.pageIntro}>
        <p className={appUi.eyebrow}>Build a clearer path through university</p>
        <h1>Choose your university</h1>
        <p className={appUi.lead}>Explore official handbook requirements and understand how your degree is structured, one section at a time.</p>
      </section>
      <section className={appUi.contentSection} aria-labelledby="universities-heading">
        <div className={appUi.sectionHeading}>
          <div><p className={appUi.stepLabel}>Step 1 of 3</p><h2 id="universities-heading">Available universities</h2></div>
          {status === "ready" && universities.length > 0 && <span className={appUi.resultCount}>{universities.length} available</span>}
        </div>
        {status === "loading" && <AsyncState kind="loading" label="Loading universities" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load universities. Check that the backend is running." onRetry={retry} />}
        {status === "ready" && universities.length === 0 && <AsyncState kind="empty" label="No universities are available yet." />}
        {status === "ready" && universities.length > 0 && (
          <div className={appUi.universityGrid}>
            {universities.map((university) => (
              <button className={appUi.universityCard} key={university.id} type="button" onClick={() => onSelectUniversity(university)}>
                <span className={appUi.universityCardCode}>{university.code}</span>
                <span className={appUi.universityCardName}>{university.name}</span>
                <span className={appUi.cardAction} aria-hidden="true">Explore degrees →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
