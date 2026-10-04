import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDegreeStudyPlans } from "../../../api/degrees";
import {
  resolveUsydEngineeringStudyPlanPreview,
  suggestUsydEngineeringStudyPlanPreview,
  usydEngineeringAcademicSelection,
  type UsydCommencement,
} from "../../../domain/usydStudyPlan";
import type { ComponentDetailResponse, RequirementGroup, StudyPlan } from "../../../types/handbook";
import type { ComponentSelections } from "../../../hooks/useComponentSelections";
import { UsydEngineeringStudyPlans } from "./UsydEngineeringStudyPlans";
import { UsydEngineeringPersonalPlan } from "./UsydEngineeringPersonalPlan";

interface Props {
  degreeCode: string;
  degreeName: string;
  universityCode: string;
  handbookYear: number;
  onOpenSubject: (subjectCode: string) => void;
  requirements: RequirementGroup[];
  selectedComponents: ComponentSelections;
  componentDetails: Record<string, ComponentDetailResponse>;
  componentDetailsStatus: "idle" | "loading" | "ready" | "error";
  degreeCreditPoints: number | null;
}

/** Owns the local USYD CUSP preview; it never writes into Course Structure selections. */
export const UsydEngineeringStudyPlanController = ({
  degreeCode,
  degreeName,
  universityCode,
  handbookYear,
  onOpenSubject,
  requirements,
  selectedComponents,
  componentDetails,
  degreeCreditPoints,
}: Props) => {
  const preferencesKey = `usyd:study-path:${universityCode}:${handbookYear}:${degreeCode}`;
  const [saved] = useState(() => { try { return JSON.parse(localStorage.getItem(preferencesKey) ?? "null") as { stream?: string; specialisation?: string; commencement?: UsydCommencement; planId?: string } | null; } catch { return null; } });
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [stream, setStream] = useState(typeof saved?.stream === "string" ? saved.stream : "");
  const [specialisation, setSpecialisation] = useState(typeof saved?.specialisation === "string" ? saved.specialisation : "");
  const [commencement, setCommencement] = useState<UsydCommencement | "">(["STANDARD", "MID_YEAR"].includes(saved?.commencement ?? "") ? saved!.commencement! : "");
  const [planId, setPlanId] = useState(typeof saved?.planId === "string" ? saved.planId : "");
  const pathWasEdited = useRef(Boolean(saved?.stream));
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchDegreeStudyPlans(degreeCode, universityCode, handbookYear, controller.signal)
      .then((result) => {
        setPlans(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [degreeCode, handbookYear, reloadKey, universityCode]);

  const academicSelection = useMemo(() => usydEngineeringAcademicSelection(
    requirements, selectedComponents, componentDetails,
  ), [componentDetails, requirements, selectedComponents]);
  const suggestion = useMemo(
    () => suggestUsydEngineeringStudyPlanPreview(academicSelection, plans),
    [academicSelection, plans],
  );

  useEffect(() => {
    if (!suggestion || pathWasEdited.current) return;
    setStream(suggestion.stream);
    setSpecialisation(suggestion.specialisation);
    setPlanId("");
  }, [suggestion]);

  const preview = useMemo(() => resolveUsydEngineeringStudyPlanPreview({
    stream,
    specialisation,
    commencement,
    planId,
    plans,
  }), [commencement, planId, plans, specialisation, stream]);
  useEffect(() => {
    if (status !== "ready" || !preview.selectedPlan) return;
    try { localStorage.setItem(preferencesKey, JSON.stringify({ stream: preview.selectedStream, specialisation: preview.selectedSpecialisation,
      commencement: preview.selectedCommencement, planId: preview.selectedPlan.id })); } catch { /* Session selection remains available. */ }
  }, [status, preferencesKey, preview]);
  const visiblePlan = preview.selectedPlan
    ? { ...preview.selectedPlan, years: preview.selectedPlan.years.filter((year) => !/^Year 0$/i.test(year.name.trim())) }
    : null;
  const isCourseStructureSuggestion = Boolean(suggestion
    && preview.selectedStream === suggestion.stream
    && preview.selectedSpecialisation === suggestion.specialisation);

  return (
    <UsydEngineeringStudyPlans
      status={status}
      hasPlans={plans.length > 0}
      degreeName={degreeName}
      preview={preview}
      isCourseStructureSuggestion={isCourseStructureSuggestion}
      visiblePlan={visiblePlan}
      onRetry={retry}
      onStreamChange={(value) => {
        pathWasEdited.current = true;
        setStream(value);
        setSpecialisation("BASE");
        setPlanId("");
      }}
      onSpecialisationChange={(value) => {
        pathWasEdited.current = true;
        setSpecialisation(value);
        setPlanId("");
      }}
      onCommencementChange={(value) => {
        pathWasEdited.current = true;
        setCommencement(value);
        setPlanId("");
      }}
      onPlanChange={value => { pathWasEdited.current = true; setPlanId(value); }}
      onOpenSubject={onOpenSubject}
      personalPlan={status === "ready" && visiblePlan ? <UsydEngineeringPersonalPlan key={`${universityCode}:${handbookYear}:${degreeCode}:${visiblePlan.id}`}
        plan={visiblePlan} requirements={requirements} handbookYear={handbookYear} degreeCode={degreeCode} degreeCreditPoints={degreeCreditPoints}
        specialisationName={preview.specialisations.find(choice => choice.id === preview.selectedSpecialisation)?.name ?? null} /> : undefined}
    />
  );
};
