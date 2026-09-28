import type { RequirementCandidateSourceSummary, RequirementSubject } from "../types/handbook";

export interface CandidateSubject extends RequirementSubject {
  eligibilitySources: RequirementCandidateSourceSummary[];
}

export interface CandidateSubjectPage {
  source: RequirementCandidateSourceSummary;
  subjects: RequirementSubject[];
}

/** Merges only loaded pages, preserving why each canonical subject is eligible. */
export const mergeCandidateSubjectPages = (pages: CandidateSubjectPage[]): CandidateSubject[] => {
  const subjects = new Map<string, CandidateSubject>();
  for (const page of pages) {
    for (const subject of page.subjects) {
      const existing = subjects.get(subject.id);
      if (existing) {
        if (!existing.eligibilitySources.some((source) => source.id === page.source.id)) {
          existing.eligibilitySources.push(page.source);
        }
      } else {
        subjects.set(subject.id, { ...subject, eligibilitySources: [page.source] });
      }
    }
  }
  return [...subjects.values()].sort((left, right) => left.code.localeCompare(right.code)
    || left.name.localeCompare(right.name)
    || left.id.localeCompare(right.id));
};
