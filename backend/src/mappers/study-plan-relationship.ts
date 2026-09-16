import type { StudyPlanSummary } from "../types/study-plan.js";

export interface MajorEvidence {
  id: string;
  code: string;
  name: string;
  subjectIds: string[];
}

/** Legacy imports lack a plan/component foreign key. Require both the exact
 * major field in the source title and corroborating subject relationships.
 * Expose the resolved stable ID; never choose a component by a partial name. */
export const attachMajorRelationships = (plans: StudyPlanSummary[], majors: MajorEvidence[]): StudyPlanSummary[] =>
  plans.map((plan) => {
    const majorName = /^(.*?) major(?:,|$)/i.exec(plan.title)?.[1]?.trim().toLowerCase();
    const subjectIds = new Set(plan.years.flatMap((year) => year.periods.flatMap((period) =>
      period.items.flatMap((item) => item.subject ? [item.subject.id] : []))));
    const matches = majors.filter((major) => major.name.trim().toLowerCase() === majorName
      && major.subjectIds.some((id) => subjectIds.has(id)));
    const major = matches.length === 1 ? matches[0] : undefined;
    return {
      ...plan,
      major: major ? { id: major.id, code: major.code, name: major.name } : null,
      relationshipBasis: major ? "SOURCE_TITLE_AND_SUBJECT_IDS" : null,
      commencement: /\b(Autumn|Spring|Summer) commencing\b/i.exec(plan.title)?.[1]?.toUpperCase() ?? null,
      attendance: /\b(full|part)[ -]time\b/i.exec(plan.title)?.[1]?.toUpperCase() ?? null,
    };
  });
