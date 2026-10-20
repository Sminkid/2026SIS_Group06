import { appUi, cn } from "../components/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegrees, fetchLatestHandbook } from "../api/universities";
import { AsyncState } from "../components/AsyncState";
import { StudyPlanCoverageNotice } from "../components/StudyPlanCoverageNotice";
import { Breadcrumbs } from "../components/Breadcrumbs";
import type { DegreeSummary, HandbookSummary, University } from "../types/handbook";

interface Props { 
  university: University; 
  onHome: () => void; 
  onBack: () => void; 
  onSelectDegree: (degree: DegreeSummary) => void;
  onStartQuiz: () => void; }

/** Filters the selected university handbook without changing the saved planner. */
export const DegreeSelectionPage = ({ university, onHome, onBack, onSelectDegree, onStartQuiz }: Props) => {
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
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Home", onClick: onHome }, { label: "University Handbooks", onClick: onBack }, { label: university.code }]} />
      <section className={appUi.pageIntroCompact}>
        <p className={appUi.eyebrow}>{university.name}</p><h1>Choose a degree</h1>
        <p className={appUi.lead}>Search the latest handbook and open a degree to explore its formal requirements.</p>
        <StudyPlanCoverageNotice />
        <div className={appUi.quizRecommendationCard}>
          <p className={appUi.eyebrow}>Not sure what to study?</p>
          <p>Take the interest quiz to see which of these degrees best match you.</p>
          <div>
            <button className={appUi.backButton} type="button" onClick={onStartQuiz}>
              Take the interest quiz
            </button>
          </div>
        </div>
      </section>
      <section aria-labelledby="degrees-heading">
        <div className={appUi.degreeTools}>
          <h2 id="degrees-heading">Degrees</h2>
          <label className={appUi.searchField}><span className={appUi.srOnly}>Search degrees by code or name</span><span aria-hidden="true">⌕</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by code or degree name" />
          </label>
        </div>
        {status === "loading" && <AsyncState kind="loading" label="Loading degrees" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load degrees from the handbook." onRetry={retry} />}
        {status === "ready" && degrees.length === 0 && <AsyncState kind="empty" label="No degrees are available in this handbook." />}
        {status === "ready" && degrees.length > 0 && filteredDegrees.length === 0 && <AsyncState kind="empty" label={`No degrees match “${query}”.`} />}
        {status === "ready" && filteredDegrees.length > 0 && (
          <div>
            <p className={appUi.resultSummary}>Showing {filteredDegrees.length} of {degrees.length} degrees</p>
            <div className={appUi.degreeGrid} aria-live="polite">
              
              {filteredDegrees.map((degree) => (
                <button className={cn(appUi.listCard, "degree-row")} type="button" key={degree.id} onClick={() => onSelectDegree(degree)}>
                  <span className={appUi.listCardCode}>{degree.code}</span>
                  <span className={appUi.listCardName}>{degree.name}</span>
                  <span className={appUi.listCardMeta}>{degree.creditPoints === null ? "Credit points not listed" : `${degree.creditPoints} credit points`}</span>
                  <span className={appUi.listCardAction} aria-hidden="true">View study plan →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
};
