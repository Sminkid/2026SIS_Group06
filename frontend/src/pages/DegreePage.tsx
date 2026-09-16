import { appUi } from "../components/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegreeDetail } from "../api/degrees";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import type { DegreeDetailResponse, DegreeSummary, RequirementGroup, University } from "../types/handbook";
import { useComponentSelections } from "../hooks/useComponentSelections";
import { SubjectDetailsDialog } from "../components/SubjectDetailsDialog";
import { useSelectedComponentDetails } from "../hooks/useSelectedComponentDetails";
import { readableText } from "../domain/readableText";
import { DegreeStructureRenderer } from "../components/degree-structure/DegreeStructureRenderer";
import { StudyPlanRenderer } from "../components/study-plan/StudyPlanRenderer";

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

/** Combines the degree overview, formal requirements and separately allocated roadmap. */
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
    detail?.requirements ?? [],
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

  const hasSemanticOverview = detail?.completionSummary.some((summary) => summary.obligation === "OPTIONAL" || summary.obligation === "CONDITIONAL" || summary.obligation === "INFORMATIONAL") ?? false;

  return <main className={appUi.page} id="main-content">
    <Breadcrumbs items={[{ label: "Universities", onClick: onHome }, { label: university.code, onClick: onBack }, { label: degree.code }]} />
    {status === "loading" && <AsyncState kind="loading" label="Loading degree requirements" />}
    {status === "error" && <AsyncState kind="error" label="We couldn't load this degree's requirements." onRetry={retry} />}
    {status === "ready" && detail && <>
      <header className={appUi.degreeHero}>
        <p className={appUi.degreeHeroCode}>{detail.degree.code}</p><h1>{detail.degree.name}</h1>
        <div className={appUi.degreeFacts} aria-label="Degree information">
          <span><strong>{detail.degree.creditPoints ?? "—"}</strong> credit points</span>
          <span><strong>{detail.degree.handbookYear}</strong> handbook</span>
          <span><strong>{detail.degree.university.code}</strong> {detail.degree.university.name}</span>
        </div>
        {detail.degree.description && !hasSemanticOverview && <p className={appUi.degreeDescription}>{readableText(detail.degree.description)}</p>}
      </header>
      <DegreeStructureRenderer detail={detail} universityCode={university.code} handbookYear={degree.handbookYear}
        selections={selections} selectionNotice={selectionNotice} onSelectComponent={selectComponent} onOpenSubject={setSubjectCode} />
      <StudyPlanRenderer
        degreeCode={degree.code}
        universityCode={university.code}
        handbookYear={degree.handbookYear}
        selectedComponentCodes={selectedComponentCodes}
        onOpenSubject={setSubjectCode}
        degreeCreditPoints={detail.degree.creditPoints}
        requirements={detail.requirements}
        selectedComponents={selections}
        componentDetails={selectedComponentDetails.details}
        componentDetailsStatus={selectedComponentDetails.status}
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
