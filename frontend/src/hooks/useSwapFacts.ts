import { useEffect, useMemo, useState } from "react";
import { fetchSubjectAccessConditionsBatch, fetchSubjectDetail } from "../api/subjects";
import { isCustomPosition, plannerItems, type SwapFacts } from "../domain/plannerSwap";
import { offeredPeriodsFrom } from "../domain/subjectOfferings";
import type { PlannerState } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";

/**
 * Loads facts for potential targets before displaying the filtered list.
 * Failed requests remain unknown and receive the existing validation warnings.
 */
export function useSwapFacts(planner: PlannerState, universityCode: string, handbookYear: number,
  adaptAccess?: (access: SubjectAccessConditions) => SubjectAccessConditions,
  includeFixed = false, offeringSubjectCodes?: string[]): { facts: SwapFacts; loading: boolean } {
  const [result, setResult] = useState<{ facts: SwapFacts; loading: boolean }>({ facts: { accessConditions: {} }, loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ facts: { accessConditions: {} }, loading: true });
    const items = includeFixed ? [...plannerItems(planner), ...planner.unassignedItems] : plannerItems(planner);
    const codes = [...new Set(items.flatMap(item => item.subject ? [item.subject.code] : []))];
    const customCodes = offeringSubjectCodes ?? [...new Set(items.filter(item => includeFixed || isCustomPosition(item)).flatMap(item => item.subject ? [item.subject.code] : []))];
    void Promise.all([
      fetchSubjectAccessConditionsBatch(codes, universityCode, handbookYear, controller.signal).catch(() => ({})),
      Promise.all(customCodes.map(async code => {
        try {
          const detail = await fetchSubjectDetail(code, universityCode, handbookYear, controller.signal);
          return [code, offeredPeriodsFrom(detail.offerings, handbookYear)] as const;
        } catch { return [code, undefined] as const; }
      })),
    ]).then(([accessConditions, offerings]) => {
      if (!controller.signal.aborted) setResult({ loading: false, facts: { accessConditions,
        offeredPeriods: Object.fromEntries(offerings.flatMap(([code, periods]) => periods === undefined ? [] : [[code, periods]])),
      } });
    });
    return () => controller.abort();
  }, [planner, universityCode, handbookYear, includeFixed, offeringSubjectCodes?.join("|")]);
  return useMemo(() => adaptAccess ? { ...result, facts: { ...result.facts,
    accessConditions: Object.fromEntries(Object.entries(result.facts.accessConditions).map(([code, access]) => [code, adaptAccess(access)])),
  } } : result, [result, adaptAccess]);
}
