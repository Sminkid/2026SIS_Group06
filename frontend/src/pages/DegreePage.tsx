import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegreeDetail } from "../api/degrees";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { RequirementAccordion } from "../components/RequirementAccordion";
import type { DegreeDetailResponse, DegreeSummary, RequirementGroup, University } from "../types/handbook";
import { useComponentSelections } from "../hooks/useComponentSelections";
import { StudyPlansSection } from "../components/StudyPlansSection";
import { SubjectDetailsDialog } from "../components/SubjectDetailsDialog";
import { useSelectedComponentDetails } from "../hooks/useSelectedComponentDetails";
import { DegreeCompletionOverview } from "../components/DegreeCompletionOverview";

interface Props { university: University; degree: DegreeSummary; onBack: () => void; onHome: () => void; }
const componentIndex = (groups: RequirementGroup[]) => {
  const index = new Map<string, { id: string; code: string }>();
  const visit = (requirements: RequirementGroup[]) => requirements.forEach((group) => {
    group.items.forEach((item) => { if (item.component) index.set(item.component.code, item.component); });
    visit(group.children);
  });
  visit(groups);
  return index;
};

export const DegreePage = ({ university, degree, onBack, onHome }: Props) => {
  const [detail, setDetail] = useState<DegreeDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [subjectCode, setSubjectCode] = useState<string | null>(null);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  const { selections, selectionNotice, selectComponent, revalidateSelections } = useComponentSelections(
    university.code,
    degree.handbookYear,
    degree.code,
  );
  const selectedComponentCodes = useMemo(
    () => [...new Set(Object.values(selections).filter((value) => !value.startsWith("GROUP:") && !value.startsWith("PATHWAY:")))].sort(),
    [selections],
  );
  const selectedComponentReferences = useMemo(() => {
    const index = componentIndex(detail?.requirements ?? []);
    return selectedComponentCodes.flatMap((code) => {
      const component = index.get(code);
      return component ? [component] : [];
    });
  }, [detail?.requirements, selectedComponentCodes]);
  const selectedComponentDetails = useSelectedComponentDetails(
    selectedComponentReferences,
    selectedComponentCodes,
    university.code,
    degree.handbookYear,
  );

  useEffect(() => {
    if (!detail || (selectedComponentCodes.length > 0 && selectedComponentDetails.status !== "ready")) return;
    revalidateSelections([
      ...detail.requirements,
      ...Object.values(selectedComponentDetails.details).flatMap((component) => component.requirements),
    ]);
  }, [detail, revalidateSelections, selectedComponentCodes.length, selectedComponentDetails.details, selectedComponentDetails.status]);

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

  const pathwayRequirements = detail?.requirements.filter((group) => group.pathways.length > 0) ?? [];
  const compulsoryRequirements = detail?.requirements.filter((group) => group.pathways.length === 0) ?? [];
  const hasSemanticOverview = detail?.completionSummary.some((summary) => summary.obligation === "OPTIONAL" || summary.obligation === "CONDITIONAL" || summary.obligation === "INFORMATIONAL") ?? false;

  return <main className="page degree-page" id="main-content">
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
        {detail.degree.description && !hasSemanticOverview && <p className="degree-description">{detail.degree.description}</p>}
      </header>
      <section className="requirements-section" aria-labelledby="requirements-heading">
        <div className="section-heading"><div><p className="step-label">Step 3 of 3</p><h2 id="requirements-heading">Course structure</h2></div><span className="result-count">{detail.requirements.length} sections</span></div>
        <p className="section-note">{hasSemanticOverview ? "Start with what is required, then decide whether optional or conditional rules apply to you." : "Open each section to see its formal handbook requirements."}</p>
        {selectionNotice && <p className="selection-notice" role="status">A saved choice is no longer available for this handbook. Please choose it again.</p>}
        {detail.requirements.length === 0 ? <AsyncState kind="empty" label="No formal requirement structure is available for this degree." /> : hasSemanticOverview ? <DegreeCompletionOverview
          totalCreditPoints={detail.degree.creditPoints} summaries={detail.completionSummary} requirements={detail.requirements}
          universityCode={university.code} handbookYear={degree.handbookYear} selections={selections} onSelectComponent={selectComponent} onOpenSubject={setSubjectCode}
        /> :
          <div className="requirements-list">{pathwayRequirements.length > 0 && <><h3 className="requirement-section-label">Compulsory requirements</h3>{compulsoryRequirements.map((group) => (
            <RequirementAccordion
              group={group}
              key={group.id}
              universityCode={university.code}
              handbookYear={degree.handbookYear}
              selections={selections}
              onSelectComponent={selectComponent}
              onOpenSubject={setSubjectCode}
            />
          ))}<h3 className="requirement-section-label">Choose one {pathwayRequirements[0]?.requiredCreditPoints ?? ""} CP option</h3>{pathwayRequirements.map((group) => <RequirementAccordion
            group={group} key={group.id} universityCode={university.code} handbookYear={degree.handbookYear} selections={selections}
            onSelectComponent={selectComponent} onOpenSubject={setSubjectCode} />)}</>}{pathwayRequirements.length === 0 && detail.requirements.map((group) => (
            <RequirementAccordion group={group} key={group.id} universityCode={university.code} handbookYear={degree.handbookYear}
              selections={selections} onSelectComponent={selectComponent} onOpenSubject={setSubjectCode} />
          ))}</div>}
      </section>
      <StudyPlansSection
        degreeCode={degree.code}
        universityCode={university.code}
        handbookYear={degree.handbookYear}
        selectedComponentCodes={selectedComponentCodes}
        onOpenSubject={setSubjectCode}
        degreeCreditPoints={detail.degree.creditPoints}
        requirements={detail.requirements}
        selectedComponents={selections}
        componentDetails={selectedComponentDetails.details}
        degreeName={detail.degree.name}
        onSelectComponent={selectComponent}
      />
      <SubjectDetailsDialog
        subjectCode={subjectCode}
        universityCode={university.code}
        handbookYear={degree.handbookYear}
        onClose={() => setSubjectCode(null)}
      />
    </>}
  </main>;
};
