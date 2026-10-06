import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRequirementCandidateSubjects } from "../../../api/requirementCandidateSources";
import { usydFocusedSections, usydFocusInputs, verifyUsydFocusMembership } from "../../../domain/usydEngineeringChoiceFocus";
import type { UsydSourceMembership } from "../../../domain/usydEngineeringChoiceFocus";
import type { ChoiceScope } from "../../../domain/studyPathChoiceScope";
import type { ComponentDetailResponse, RequirementSubject, StudyPlanItem } from "../../../types/handbook";
import type { FocusedChoiceView } from "../../SubjectChoiceDialog";

const cache = new Map<string, RequirementSubject | null>();

export function useUsydChoiceFocus(slot: StudyPlanItem | null, scope: ChoiceScope, stream?: ComponentDetailResponse, focus?: ComponentDetailResponse): FocusedChoiceView | undefined {
  const inputs = useMemo(() => usydFocusInputs(slot, scope, stream, focus), [slot, scope, stream, focus]);
  const [verified, setVerified] = useState<{ inputs: typeof inputs; status: "loading" | "ready" | "error"; memberships: UsydSourceMembership[] }>();
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!inputs) { setVerified(undefined); return; }
    const controller = new AbortController();
    setVerified({ inputs, status: "loading", memberships: [] });
    void verifyUsydFocusMembership(inputs, async (source, subject, signal) => {
      const key = `${focus!.component.handbookYear}:${source.id}:${subject.code}`;
      if (cache.has(key)) return cache.get(key)!;
      const page = await fetchRequirementCandidateSubjects({ sourceId: source.id, query: subject.code, page: 1, limit: 20, signal });
      // The API query also searches names: only an exact canonical subject is proof.
      const exact = page.subjects.find(candidate => candidate.code === subject.code && candidate.id === subject.id) ?? null;
      if (!exact && page.pagination.totalPages > 1) throw new Error("Exact-code membership could not be verified from this response.");
      if (!signal.aborted) { cache.set(key, exact); if (cache.size > 2000) cache.delete(cache.keys().next().value!); }
      return exact;
    }, controller.signal).then(memberships => {
      if (!controller.signal.aborted) setVerified({ inputs, status: "ready", memberships });
    }).catch(() => { if (!controller.signal.aborted) setVerified({ inputs, status: "error", memberships: [] }); });
    return () => controller.abort();
  }, [inputs, attempt, focus?.component.handbookYear]);
  if (!inputs || !focus) return undefined;
  const current = verified?.inputs === inputs ? verified : undefined;
  const status = current?.status ?? "loading";
  const sections = usydFocusedSections(inputs, status === "ready" ? current?.memberships : []);
  const shown = new Set(sections.flatMap(section => section.rows.map(row => row.subject.code)));
  const unavailable = inputs.subjects.filter(subject => !shown.has(subject.code)).map(subject => subject.code);
  return { id: `focus:${focus.component.code}`, label: focus.component.name, status, retry,
    sections, notice: status === "ready" && unavailable.length
      ? `Not verified for this slot: ${unavailable.join(", ")}. Only the intersection with this slot's eligible pools is shown; check formal requirements for other allocations.` : undefined };
}
