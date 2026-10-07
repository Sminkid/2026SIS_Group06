import type { ChoiceScope } from "./studyPathChoiceScope";
import type { ComponentDetailResponse, RequirementCandidateSourceSummary, RequirementGroup, RequirementSubject, StudyPlanItem } from "../types/handbook";
import { usydGroups } from "./usydEngineeringPlanner";
import { usydEngineeringSpecialisations } from "./usydEngineeringSpecialisations";

export interface UsydFocusedSubject { subject: RequirementSubject; eligibleGroupIds: string[]; }
export interface UsydFocusSection { group: RequirementGroup; rows: UsydFocusedSubject[]; }
export interface UsydSourceMembership { sourceId: string; subjects: RequirementSubject[]; }

export function usydFocusInputs(slot: StudyPlanItem | null, scope: ChoiceScope, stream?: ComponentDetailResponse, focus?: ComponentDetailResponse) {
  const formal = usydEngineeringSpecialisations(stream).find(option => option.component.code === focus?.component.code
    && option.component.id === focus?.component.id);
  if (!slot || scope.kind !== "FORMAL" || !scope.union || !focus || !formal
    || focus.component.university.code !== "USYD" || focus.component.handbookYear !== stream?.component.handbookYear) return null;
  const groups = (scope.groups ?? []).filter(group => scope.selectableGroupIds?.includes(group.id)
    && (formal.kind !== "BREADTH_SPECIALISATION" || group.candidateSources.some(source => source.tableName === "Table S") || /free electives/i.test(group.title ?? "")));
  const requirements = usydGroups(focus.requirements).filter(group => group.items.some(item => item.subject));
  const subjects = [...new Map(requirements.flatMap(group => group.items.flatMap(item => item.subject ? [item.subject] : [])).map(subject => [subject.code, subject])).values()];
  const sources = [...new Map(groups.flatMap(group => usydGroups([group]).flatMap(member => member.candidateSources)).map(source => [source.id, source])).values()];
  return { groups, requirements, subjects, sources, capacity: slot.choiceOrigin?.maximumCreditPoints ?? slot.choiceOrigin?.creditPoints ?? slot.creditPoints };
}

/** Formal membership AND proven slot membership. These sections never become allocation pools. */
export function usydFocusedSections(inputs: NonNullable<ReturnType<typeof usydFocusInputs>>, memberships: UsydSourceMembership[] = []): UsydFocusSection[] {
  const seen = new Set<string>();
  return inputs.requirements.map(group => ({ group, rows: group.items.flatMap(item => {
    const subject = item.subject;
    if (!subject || seen.has(subject.code) || subject.creditPoints === null || subject.creditPoints <= 0
      || (inputs.capacity !== null && subject.creditPoints > inputs.capacity)) return [];
    const eligibleGroupIds = inputs.groups.filter(pool => usydGroups([pool]).some(member =>
      member.items.some(candidate => candidate.subject?.id === subject.id && candidate.subject.code === subject.code && candidate.subject.creditPoints === subject.creditPoints)
      || member.candidateSources.some(source => memberships.some(proof => proof.sourceId === source.id
        && proof.subjects.some(candidate => candidate.id === subject.id && candidate.code === subject.code && candidate.creditPoints === subject.creditPoints))))).map(pool => pool.id);
    if (!eligibleGroupIds.length) return [];
    seen.add(subject.code);
    return [{ subject, eligibleGroupIds }];
  }) })).filter(section => section.rows.length);
}

export type UsydMembershipLookup = (source: RequirementCandidateSourceSummary, subject: RequirementSubject, signal: AbortSignal) => Promise<RequirementSubject | null>;

/** Small exact-code lookups only; never page through an entire candidate table. */
export async function verifyUsydFocusMembership(inputs: NonNullable<ReturnType<typeof usydFocusInputs>>, lookup: UsydMembershipLookup, signal: AbortSignal) {
  const jobs = inputs.sources.flatMap(source => inputs.subjects.map(subject => ({ source, subject })));
  const result = new Map<string, RequirementSubject[]>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (next < jobs.length) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { source, subject } = jobs[next++]!;
      const found = await lookup(source, subject, signal);
      if (found?.id === subject.id && found.code === subject.code && found.creditPoints === subject.creditPoints) {
        result.set(source.id, [...(result.get(source.id) ?? []), found]);
      }
    }
  }));
  return [...result].map(([sourceId, subjects]) => ({ sourceId, subjects }));
}
