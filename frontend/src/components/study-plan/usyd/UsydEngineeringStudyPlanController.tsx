import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegreeStudyPlans } from "../../../api/degrees";
import {
  groupUsydStudyPlans,
  type UsydCommencement,
} from "../../../domain/usydStudyPlan";
import type { StudyPlan } from "../../../types/handbook";
import { UsydEngineeringStudyPlans } from "./UsydEngineeringStudyPlans";

interface Props {
  degreeCode: string;
  universityCode: string;
  handbookYear: number;
  onOpenSubject: (subjectCode: string) => void;
}

/** Owns USYD Engineering CUSP selection policy and hands resolved state to the read-only view. */
export const UsydEngineeringStudyPlanController = ({
  degreeCode,
  universityCode,
  handbookYear,
  onOpenSubject,
}: Props) => {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [stream, setStream] = useState("");
  const [commencement, setCommencement] = useState<UsydCommencement | "">("");
  const [planId, setPlanId] = useState("");
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
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [degreeCode, handbookYear, reloadKey, universityCode]);

  const groups = useMemo(() => groupUsydStudyPlans(plans), [plans]);
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const visiblePlan = selectedPlan
    ? {
        ...selectedPlan,
        years: selectedPlan.years.filter((year) => !/^Year 0$/i.test(year.name.trim())),
      }
    : null;

  return (
    <UsydEngineeringStudyPlans
      status={status}
      hasPlans={plans.length > 0}
      groups={groups}
      stream={stream}
      commencement={commencement}
      planId={planId}
      visiblePlan={visiblePlan}
      onRetry={retry}
      onStreamChange={(value) => {
        setStream(value);
        setCommencement("");
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
