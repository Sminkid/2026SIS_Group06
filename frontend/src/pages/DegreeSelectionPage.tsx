import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegrees, fetchLatestHandbook } from "../api/universities";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import type { DegreeSummary, HandbookSummary, University } from "../types/handbook";

interface Props { university: University; onBack: () => void; onSelectDegree: (degree: DegreeSummary) => void; }

export const DegreeSelectionPage = ({ university, onBack, onSelectDegree }: Props) => {
  const [degrees, setDegrees] = useState<DegreeSummary[]>([]);
  const [handbook, setHandbook] = useState<HandbookSummary | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchLatestHandbook(university.code, controller.signal)
      .then(async (latest) => {
        const result = await fetchDegrees(university.code, latest.year, controller.signal);
        setHandbook(latest); setDegrees(result); setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [reloadKey, university.code]);

  const filteredDegrees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return degrees;
    return degrees.filter((degree) => degree.code.toLowerCase().includes(normalized) || degree.name.toLowerCase().includes(normalized));
  }, [degrees, query]);

  return (
    <main className="page" id="main-content">
      <Breadcrumbs items={[{ label: "Universities", onClick: onBack }, { label: university.code }]} />
      <section className="page-intro page-intro--compact">
        <p className="eyebrow">{university.name}</p><h1>Choose a degree</h1>
        <p className="lead">Search the latest handbook and open a degree to explore its formal requirements.</p>
      </section>
      <section className="content-section" aria-labelledby="degrees-heading">
        <div className="section-heading degree-tools">
          <div><p className="step-label">Step 2 of 3</p><h2 id="degrees-heading">Degrees {handbook && <span className="muted">· {handbook.year}</span>}</h2></div>
          <label className="search-field"><span className="sr-only">Search degrees by code or name</span><span aria-hidden="true">⌕</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by code or degree name" />
          </label>
        </div>
        {status === "loading" && <AsyncState kind="loading" label="Loading degrees" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load degrees from the handbook." onRetry={retry} />}
        {status === "ready" && degrees.length === 0 && <AsyncState kind="empty" label="No degrees are available in this handbook." />}
        {status === "ready" && degrees.length > 0 && filteredDegrees.length === 0 && <AsyncState kind="empty" label={`No degrees match “${query}”.`} />}
        {status === "ready" && filteredDegrees.length > 0 && (
          <div className="degree-list" aria-live="polite">
            <p className="result-summary">Showing {filteredDegrees.length} of {degrees.length} degrees</p>
            {filteredDegrees.map((degree) => (
              <button className="degree-row" type="button" key={degree.id} onClick={() => onSelectDegree(degree)}>
                <span className="degree-row__code">{degree.code}</span><span className="degree-row__name">{degree.name}</span>
                <span className="degree-row__cp">{degree.creditPoints === null ? "CP not listed" : `${degree.creditPoints} CP`}</span>
                <span className="degree-row__arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
