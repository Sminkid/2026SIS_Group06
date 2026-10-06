import type { ComponentDetailResponse, RequirementComponent, RequirementGroup } from "../types/handbook";

export type UsydSpecialisationKind = "STREAM_SPECIALISATION" | "BREADTH_SPECIALISATION";
export interface UsydFormalSpecialisation {
  component: RequirementComponent;
  kind: UsydSpecialisationKind;
  requirementGroupId: string;
}

const groups = (requirements: RequirementGroup[]): RequirementGroup[] =>
  requirements.flatMap(group => [group, ...groups(group.children)]);

/** Availability belongs to the selected stream's formal requirement relationships. */
export function usydEngineeringSpecialisations(detail: ComponentDetailResponse | null | undefined): UsydFormalSpecialisation[] {
  const options = groups(detail?.requirements ?? []).flatMap(group => group.items.flatMap(item =>
    item.component?.type === "SPECIALISATION" ? [{
      component: item.component,
      kind: /\bbreadth\b/i.test(group.title ?? "") ? "BREADTH_SPECIALISATION" as const : "STREAM_SPECIALISATION" as const,
      requirementGroupId: group.id,
    }] : []));
  return [...new Map(options.map(option => [option.component.code, option])).values()];
}

// CUSP expands labels such as Computer -> Computer Engineering and Internet Things -> Internet of Things (IoT).
export const usydSpecialisationNameKey = (value: string): string => value.normalize("NFKD")
  .replace(/&/g, " and ").replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, " ")
  .trim().split(/\s+/).filter(word => word && ![
    "and", "breadth", "civil", "engineering", "for", "iot", "of", "specialisation", "stream", "the",
  ].includes(word)).join(" ");

/** Names are scheduling aliases only; formal identity and category remain separate. */
export function matchUsydEngineeringSpecialisation(options: UsydFormalSpecialisation[], name: string,
  kind?: UsydSpecialisationKind): UsydFormalSpecialisation | undefined {
  const scoped = options.filter(option => !kind || option.kind === kind);
  const target = usydSpecialisationNameKey(name);
  if (!target) return undefined;
  const exact = scoped.filter(option => usydSpecialisationNameKey(option.component.name) === target);
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const targetWords = new Set(target.split(" "));
  const partial = scoped.filter(option => {
    const candidate = usydSpecialisationNameKey(option.component.name).split(" ").filter(Boolean);
    return candidate.length && (candidate.every(word => targetWords.has(word))
      || [...targetWords].every(word => candidate.includes(word)));
  });
  return partial.length === 1 ? partial[0] : undefined;
}

export const usydFormalFocusId = (option: UsydFormalSpecialisation): string => `COMPONENT:${option.component.code}`;

export const usydStudyPlanFocusGroups = [
  { kind: "BASE", label: "Base roadmap" },
  { kind: "STREAM_SPECIALISATION", label: "Stream specialisations" },
  { kind: "BREADTH_SPECIALISATION", label: "Breadth specialisations" },
  { kind: "OTHER", label: "Other roadmaps" },
] as const;

export const usydStudyPlanFocusHelper = (kind: string | undefined): string => kind === "BASE"
  ? "Shows your stream’s base roadmap, with elective choices left open."
  : kind === "STREAM_SPECIALISATION"
    ? "A specialisation within your Engineering stream, planned using existing eligible electives."
    : kind === "BREADTH_SPECIALISATION"
      ? "A 24 CP specialisation outside your Engineering stream, planned within the degree’s free electives."
      : "Choose an official roadmap to preview its recommended schedule.";
