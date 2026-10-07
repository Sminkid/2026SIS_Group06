import { useEffect, useMemo, useState } from "react";
import { fetchSubjectAccessConditionsBatch } from "../../../api/subjects";
import { normalizeUsydEngineeringAccess } from "../../../domain/usydEngineeringAccessConditions";
import { validatePlanner } from "../../../domain/plannerValidation";
import { plannerItems } from "../../../domain/plannerSwap";
import type { RequirementGroup } from "../../../types/handbook";
import type { PlannerState } from "../../../types/planner";
import type { SubjectAccessConditions } from "../../../types/subject";

/** USYD access checks include holding-area subjects, so unassigning cannot conceal a prohibition. */
export function useUsydEngineeringValidation({ planner, requirements, selectedComponents, handbookYear, degreeCreditPoints }: {
  planner: PlannerState | null; requirements: RequirementGroup[]; selectedComponents: Record<string, string>; handbookYear: number; degreeCreditPoints: number | null;
}) {
  const codes = useMemo(() => [...new Set(planner ? [...plannerItems(planner), ...planner.unassignedItems].flatMap(item => item.subject ? [item.subject.code] : []) : [])].sort(), [planner]);
  const key = codes.join("|");
  const [loaded, setLoaded] = useState<{ key: string; access: Record<string, SubjectAccessConditions>; status: "ready" | "error" }>();
  useEffect(() => {
    if (!planner) { setLoaded(undefined); return; }
    const controller = new AbortController();
    const chunks: string[][] = [];
    for (let i = 0; i < codes.length; i += 500) chunks.push(codes.slice(i, i + 500));
    void Promise.all(chunks.map(subjectCodes => fetchSubjectAccessConditionsBatch(subjectCodes, "USYD", handbookYear, controller.signal)))
      .then(responses => { if (!controller.signal.aborted) setLoaded({ key, status: "ready", access: Object.fromEntries(Object.entries(Object.assign({}, ...responses) as Record<string, SubjectAccessConditions>).map(([code, access]) => [code, normalizeUsydEngineeringAccess(access)])) }); })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ key, status: "error", access: {} }); });
    return () => controller.abort();
  }, [Boolean(planner), key, handbookYear]);
  const status = !planner ? "idle" : loaded?.key === key ? loaded.status : "loading";
  const accessConditions = loaded?.key === key ? loaded.access : {};
  const validation = useMemo(() => planner && status === "ready"
    ? validatePlanner({ planner, requirements, selectedComponents, degreeCreditPoints, accessConditions }) : null,
  [planner, requirements, selectedComponents, degreeCreditPoints, status, accessConditions]);
  return { status, validation, accessConditions };
}
