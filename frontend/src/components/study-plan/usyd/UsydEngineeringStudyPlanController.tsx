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
}: Props) => {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [stream, setStream] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [commencement, setCommencement] = useState<UsydCommencement | "">("");
  const [planId, setPlanId] = useState("");
  const pathWasEdited = useRef(false);
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
        setCommencement(value);
        setPlanId("");
      }}
      onPlanChange={setPlanId}
      onOpenSubject={onOpenSubject}
    />
  );
};
