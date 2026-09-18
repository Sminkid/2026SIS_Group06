import type { StudyPlan } from "../types/handbook";

export type UsydCommencement = "STANDARD" | "MID_YEAR";
export type UsydPlanVariantKind = "BASE" | "STREAM_SPECIALISATION" | "BREADTH_SPECIALISATION" | "OTHER";

export interface UsydPlanVariant {
  kind: UsydPlanVariantKind;
  label: string;
  plan: StudyPlan;
}

export interface UsydPlanCommencementGroup {
  id: UsydCommencement;
  label: string;
  variants: UsydPlanVariant[];
}

export interface UsydPlanStreamGroup {
  pathway: string;
  commencements: UsydPlanCommencementGroup[];
}

const commencement = (title: string): UsydCommencement => /\(mid-year\)/i.test(title) ? "MID_YEAR" : "STANDARD";

const variant = (plan: StudyPlan): UsydPlanVariant => {
  const suffix = plan.title.split(":").slice(1).join(":").trim().replace(/^\d+\.\s*/, "");
  if (!suffix) return { kind: "BASE", label: "Base plan", plan };
  if (/^Stream Specialisation in /i.test(suffix)) {
    return { kind: "STREAM_SPECIALISATION", label: suffix, plan };
  }
  if (/^Breadth Specialisation in /i.test(suffix)) {
    return { kind: "BREADTH_SPECIALISATION", label: suffix, plan };
  }
  return { kind: "OTHER", label: suffix, plan };
};

const kindOrder: Record<UsydPlanVariantKind, number> = {
  BASE: 0,
  STREAM_SPECIALISATION: 1,
  BREADTH_SPECIALISATION: 2,
  OTHER: 3,
};

/** Uses StudyPlan.pathway as stream identity; titles provide variant metadata only. */
export const groupUsydStudyPlans = (plans: StudyPlan[]): UsydPlanStreamGroup[] => {
  const byStream = new Map<string, StudyPlan[]>();
  plans.forEach((plan) => {
    const pathway = plan.pathway?.trim();
    if (!pathway) return;
    byStream.set(pathway, [...(byStream.get(pathway) ?? []), plan]);
  });

  return [...byStream.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([pathway, streamPlans]) => ({
    pathway,
    commencements: (["STANDARD", "MID_YEAR"] as const).flatMap((id) => {
      const variants = streamPlans.filter((plan) => commencement(plan.title) === id).map(variant)
        .sort((left, right) => kindOrder[left.kind] - kindOrder[right.kind] || left.label.localeCompare(right.label));
      return variants.length ? [{ id, label: id === "STANDARD" ? "Standard commencement" : "Mid-year commencement", variants }] : [];
    }),
  }));
};
