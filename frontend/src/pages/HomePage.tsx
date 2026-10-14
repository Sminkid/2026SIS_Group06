import { appUi, cn } from "../components/ui";
import { useCallback, useEffect, useState } from "react";
import { fetchUniversities } from "../api/universities";
import { AsyncState } from "../components/AsyncState";
import type { University } from "../types/handbook";
import { Breadcrumbs } from "../components/Breadcrumbs";

interface HomePageProps { onHome: () => void; onSelectUniversity: (university: University) => void; }

/** Lists available universities with accessible loading, retry and empty states. */
export const HomePage = ({ onHome, onSelectUniversity }: HomePageProps) => {
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
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Home", onClick: onHome }, { label: "University Handbooks" }]} />
      <section className={appUi.pageIntroCompact}>
        <p className={appUi.eyebrow}>University handbooks</p>
        <h1>Choose a university</h1>
        <p className={appUi.lead}>Explore official handbook requirements and understand how your degree is structured, one section at a time.</p>
      </section>
      <section aria-labelledby="universities-heading">
        <div className={appUi.degreeTools}>
          <h2 id="universities-heading">Available universities</h2>
          {status === "ready" && universities.length > 0 && (
            <p className={appUi.resultSummary}>Showing {universities.length} {universities.length === 1 ? "university" : "universities"}</p>
          )}
        </div>
        {status === "loading" && <AsyncState kind="loading" label="Loading universities" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load universities. Check that the backend is running." onRetry={retry} />}
        {status === "ready" && universities.length === 0 && <AsyncState kind="empty" label="No universities are available yet." />}
        {status === "ready" && universities.length > 0 && (
          <div className={appUi.degreeGrid}>
            {universities.map((university) => (
              <button className={cn(appUi.listCard, "university-card")} key={university.id} type="button" onClick={() => onSelectUniversity(university)}>
                <span className={appUi.listCardCode}>{university.code}</span>
                <span className={appUi.listCardName}>{university.name}</span>
                <span className={appUi.listCardAction} aria-hidden="true">Explore degrees →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
