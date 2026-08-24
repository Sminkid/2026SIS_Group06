import { useEffect, useMemo, useState } from "react";
import { fetchSubjectAccessConditionsBatch } from "../api/subjects";
import { validatePlanner } from "../domain/plannerValidation";
import type { ComponentSelections } from "./useComponentSelections";
import type { RequirementGroup } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";

interface Args {
  planner: PlannerState | null;
  degreeCreditPoints: number | null;
  requirements: RequirementGroup[];
  selectedComponents: ComponentSelections;
  universityCode: string;
  handbookYear: number;
}

export const usePlannerValidation = ({
  planner,
  degreeCreditPoints,
  requirements,
  selectedComponents,
  universityCode,
  handbookYear,
}: Args) => {
  const subjectCodes = useMemo(() => {
    if (!planner) return [];
    const codes = planner.years.flatMap((year) =>
      year.periods.flatMap((period) =>
        period.items.flatMap((item) => item.subject ? [item.subject.code] : [])));
    return [...new Set(codes)].sort();
  }, [planner]);
  const subjectCodeKey = subjectCodes.join("|");
  const hasPlanner = planner !== null;
  const [accessConditions, setAccessConditions] = useState<
    Record<string, SubjectAccessConditions>
  >({});
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!hasPlanner) {
      setAccessConditions({}); setStatus("idle");
      return;
    }
    if (subjectCodes.length === 0) {
      setAccessConditions({}); setStatus("ready");
      return;
    }

    const controller = new AbortController();
    const chunks: string[][] = [];
    for (let index = 0; index < subjectCodes.length; index += 500) {
      chunks.push(subjectCodes.slice(index, index + 500));
    }
    setStatus("loading");
    void Promise.all(chunks.map((codes) =>
      fetchSubjectAccessConditionsBatch(
        codes,
        universityCode,
        handbookYear,
        controller.signal,
      )))
      .then((responses) => {
        setAccessConditions(Object.assign({}, ...responses));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccessConditions({}); setStatus("error");
        }
      });
    return () => controller.abort();
  }, [handbookYear, hasPlanner, subjectCodeKey, universityCode]);

  const validation = useMemo(() => {
    if (!planner || status !== "ready") return null;
    return validatePlanner({
      degreeCreditPoints,
      requirements,
      selectedComponents,
      planner,
      accessConditions,
    });
  }, [accessConditions, degreeCreditPoints, planner, requirements, selectedComponents, status]);

  return { validation, status };
};
