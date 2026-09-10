import { useCallback, useEffect, useState } from "react";
import { fetchUniversities } from "../api/universities";
import { AsyncState } from "../components/AsyncState";
import type { University } from "../types/handbook";

interface HomePageProps { onSelectUniversity: (university: University) => void; }

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
    <main className="page page--landing" id="main-content">
      <section className="page-intro">
        <p className="eyebrow">Build a clearer path through university</p>
        <h1>Choose your university</h1>
        <p className="lead">Explore official handbook requirements and understand how your degree is structured, one section at a time.</p>
      </section>
      <section className="content-section" aria-labelledby="universities-heading">
        <div className="section-heading">
          <div><p className="step-label">Step 1 of 3</p><h2 id="universities-heading">Available universities</h2></div>
          {status === "ready" && universities.length > 0 && <span className="result-count">{universities.length} available</span>}
        </div>
        {status === "loading" && <AsyncState kind="loading" label="Loading universities" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load universities. Check that the backend is running." onRetry={retry} />}
        {status === "ready" && universities.length === 0 && <AsyncState kind="empty" label="No universities are available yet." />}
        {status === "ready" && universities.length > 0 && (
          <div className="university-grid">
            {universities.map((university) => (
              <button className="university-card" key={university.id} type="button" onClick={() => onSelectUniversity(university)}>
                <span className="university-card__code">{university.code}</span>
                <span className="university-card__name">{university.name}</span>
                <span className="card-action" aria-hidden="true">Explore degrees →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
