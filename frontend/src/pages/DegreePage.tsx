import { useCallback, useEffect, useState } from "react";
import { fetchDegreeDetail } from "../api/degrees";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { RequirementAccordion } from "../components/RequirementAccordion";
import type { DegreeDetailResponse, DegreeSummary, University } from "../types/handbook";
import { useComponentSelections } from "../hooks/useComponentSelections";
import { StudyPlansSection } from "../components/StudyPlansSection";

interface Props { university: University; degree: DegreeSummary; onBack: () => void; onHome: () => void; }

export const DegreePage = ({ university, degree, onBack, onHome }: Props) => {
  const [detail, setDetail] = useState<DegreeDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  const { selections, selectComponent } = useComponentSelections(
    university.code,
    degree.handbookYear,
    degree.code,
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchDegreeDetail(degree.code, university.code, degree.handbookYear, controller.signal)
      .then((data) => { setDetail(data); setStatus("ready"); })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [degree.code, degree.handbookYear, reloadKey, university.code]);

  return <main className="page degree-page">
    <Breadcrumbs items={[{ label: "Universities", onClick: onHome }, { label: university.code, onClick: onBack }, { label: degree.code }]} />
    {status === "loading" && <AsyncState kind="loading" label="Loading degree requirements" />}
    {status === "error" && <AsyncState kind="error" label="We couldn't load this degree's requirements." onRetry={retry} />}
    {status === "ready" && detail && <>
      <header className="degree-hero">
        <p className="degree-hero__code">{detail.degree.code}</p><h1>{detail.degree.name}</h1>
        <div className="degree-facts" aria-label="Degree information">
          <span><strong>{detail.degree.creditPoints ?? "—"}</strong> credit points</span>
          <span><strong>{detail.degree.handbookYear}</strong> handbook</span>
          <span><strong>{detail.degree.university.code}</strong> {detail.degree.university.name}</span>
        </div>
        {detail.degree.description && <p className="degree-description">{detail.degree.description}</p>}
      </header>
      <section className="requirements-section" aria-labelledby="requirements-heading">
        <div className="section-heading"><div><p className="step-label">Step 3 of 3</p><h2 id="requirements-heading">Course structure</h2></div><span className="result-count">{detail.requirements.length} sections</span></div>
        <p className="section-note">Open each section to see its formal handbook requirements.</p>
        {detail.requirements.length === 0 ? <AsyncState kind="empty" label="No formal requirement structure is available for this degree." /> :
          <div className="requirements-list">{detail.requirements.map((group) => (
            <RequirementAccordion
              group={group}
              key={group.id}
              universityCode={university.code}
              handbookYear={degree.handbookYear}
              selections={selections}
              onSelectComponent={selectComponent}
            />
          ))}</div>}
      </section>
      <StudyPlansSection degreeCode={degree.code} universityCode={university.code} handbookYear={degree.handbookYear} />
    </>}
  </main>;
};
