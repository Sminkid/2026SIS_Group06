import type { StudyPlan } from "../types/handbook";

/** Pure, one-way reconciliation. Explicit variant actions update the major in
 * the same event; rendering never writes component state back through effects. */
export const reconcileStudyPlan = (plans: StudyPlan[], currentId: string, majorCode?: string) => {
  const current = plans.find((plan) => plan.id === currentId);
  if (!majorCode) return { plan: current ?? plans[0], reason: "" };
  const candidates = plans.filter((plan) => plan.major?.code === majorCode);
  if (current?.major?.code === majorCode) return { plan: current, reason: "" };
  const exact = candidates.filter((plan) => plan.commencement === current?.commencement && plan.attendance === current?.attendance);
  const mode = candidates.filter((plan) => plan.attendance === current?.attendance);
  const shortlist = exact.length ? exact : mode.length ? mode : candidates;
  // Multiple specialisations have no safe implicit default.
  const plan = shortlist.length === 1 ? shortlist[0] : undefined;
  return { plan, reason: !candidates.length ? "No mapped official study plan is available for this major."
    : !plan ? "Choose an official variant for the selected major."
    : exact.length ? "" : "The previous commencement or attendance mode is unavailable; the only matching alternative is shown." };
};
