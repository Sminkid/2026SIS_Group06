import type { ComponentDetailResponse, RequirementGroup, StudyPlan } from "../types/handbook";

export type UsydCommencement = "STANDARD" | "MID_YEAR";
export type UsydPlanVariantKind = "BASE" | "STREAM_SPECIALISATION" | "BREADTH_SPECIALISATION" | "OTHER";

export interface UsydPlanVariant {
  kind: UsydPlanVariantKind;
  label: string;
  specialisationName: string | null;
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

export interface UsydPreviewSpecialisation {
  id: string;
  label: string;
  name: string | null;
  kind: UsydPlanVariantKind;
}

export interface UsydEngineeringStudyPlanPreview {
  resolution: UsydStudyPlanResolutionKind;
  streams: UsydPlanStreamGroup[];
  specialisations: UsydPreviewSpecialisation[];
  commencements: UsydPlanCommencementGroup[];
  variants: UsydPlanVariant[];
  selectedStream: string;
  selectedSpecialisation: string;
  selectedCommencement: UsydCommencement | "";
  selectedPlan: StudyPlan | null;
  reason: string;
}

const commencement = (title: string): UsydCommencement => /\(mid-year\)/i.test(title) ? "MID_YEAR" : "STANDARD";

const variant = (plan: StudyPlan): UsydPlanVariant => {
  const suffix = plan.title.split(":").slice(1).join(":").trim().replace(/^\d+\.\s*/, "");
  if (!suffix) return { kind: "BASE", label: "Base plan", specialisationName: null, plan };
  if (/^Stream Specialisation in /i.test(suffix)) {
    return { kind: "STREAM_SPECIALISATION", label: suffix,
      specialisationName: suffix.replace(/^Stream Specialisation in /i, ""), plan };
  }
  if (/^Breadth Specialisation in /i.test(suffix)) {
    return { kind: "BREADTH_SPECIALISATION", label: suffix,
      specialisationName: suffix.replace(/^Breadth Specialisation in /i, ""), plan };
  }
  const genericSpecialisation = /^Specialisation in (.+)$/i.exec(suffix)?.[1] ?? null;
  return { kind: "OTHER", label: suffix, specialisationName: genericSpecialisation, plan };
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

export interface UsydEngineeringAcademicSelection {
  stream: { code: string; name: string } | null;
  specialisations: Array<{ code: string; name: string }>;
}

export type UsydStudyPlanResolutionKind = "waiting" | "base" | "exact" | "fallback" | "ambiguous";

export interface UsydEngineeringStudyPlanResolution {
  resolution: UsydStudyPlanResolutionKind;
  pathway: string | null;
  plan: StudyPlan | null;
  group: UsydPlanStreamGroup | null;
  variants: UsydPlanVariant[];
  reason: string;
}

const flattenRequirements = (groups: RequirementGroup[]): RequirementGroup[] =>
  groups.flatMap((group) => [group, ...flattenRequirements(group.children)]);

const componentOptions = (group: RequirementGroup, type: string) =>
  group.items.flatMap((item) => item.component?.type === type ? [item.component] : []);

/** Reads only selections belonging to the selected Stream's active requirement graph. */
export const usydEngineeringAcademicSelection = (
  requirements: RequirementGroup[],
  selections: Record<string, string>,
  componentDetails: Record<string, ComponentDetailResponse>,
): UsydEngineeringAcademicSelection => {
  const streamGroup = flattenRequirements(requirements).find((group) => {
    const options = componentOptions(group, "STREAM");
    return group.logic === "ONE_OF" && options.length > 1 && options.length === group.items.length;
  });
  const stream = streamGroup
    ? componentOptions(streamGroup, "STREAM").find((option) => option.code === selections[streamGroup.id]) ?? null
    : null;
  if (!stream) return { stream: null, specialisations: [] };

  const activeGroups = flattenRequirements(componentDetails[stream.code]?.requirements ?? []);
  const specialisations = activeGroups.flatMap((group) => componentOptions(group, "SPECIALISATION")
    .filter((option) => selections[group.id] === option.code)
    .map((option) => ({ code: option.code, name: option.name })));
  return { stream: { code: stream.code, name: stream.name }, specialisations };
};

const normalizedWords = (value: string): string[] => value
  .normalize("NFKD")
  .replace(/&/g, " and ")
  .replace(/\([^)]*\)/g, " ")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const normalizedPathway = (value: string): string => normalizedWords(value)
  .filter((word) => word !== "and")
  .join(" ");

/**
 * CUSP expands terse Course Structure labels (for example "Computer" to
 * "Computer Engineering" and "Internet Things" to "Internet of Things (IoT)").
 * Removing only those connective/category words keeps matching data-driven.
 */
const specialisationNoiseWords = new Set([
  "and", "breadth", "civil", "engineering", "for", "iot", "of", "specialisation", "stream", "the",
]);

const normalizedSpecialisation = (value: string): string => normalizedWords(value)
  .filter((word) => !specialisationNoiseWords.has(word))
  .join(" ");

const specialisationId = (candidate: UsydPlanVariant): string => {
  if (candidate.kind === "BASE") return "BASE";
  if (candidate.specialisationName) {
    return `SPECIALISATION:${normalizedSpecialisation(candidate.specialisationName)}`;
  }
  return "OTHER";
};

const specialisationLabel = (candidate: UsydPlanVariant): string => {
  if (candidate.kind === "BASE") return "Base plan";
  if (candidate.kind === "STREAM_SPECIALISATION") return `Stream · ${candidate.specialisationName}`;
  if (candidate.kind === "BREADTH_SPECIALISATION") return `Breadth · ${candidate.specialisationName}`;
  return candidate.specialisationName ?? "Other official variants";
};

const specialisationKindOrder: Record<UsydPlanVariantKind, number> = {
  BASE: 0,
  STREAM_SPECIALISATION: 1,
  BREADTH_SPECIALISATION: 2,
  OTHER: 3,
};

const previewSpecialisations = (group: UsydPlanStreamGroup): UsydPreviewSpecialisation[] => {
  const choices = new Map<string, UsydPreviewSpecialisation>();
  group.commencements.flatMap((item) => item.variants).forEach((candidate) => {
    const id = specialisationId(candidate);
    const existing = choices.get(id);
    if (existing && specialisationKindOrder[existing.kind] <= specialisationKindOrder[candidate.kind]) return;
    choices.set(id, {
      id,
      label: specialisationLabel(candidate),
      name: candidate.specialisationName,
      kind: candidate.kind,
    });
  });
  return [...choices.values()].sort((left, right) =>
    specialisationKindOrder[left.kind] - specialisationKindOrder[right.kind]
      || left.label.localeCompare(right.label));
};

const variantsForSpecialisation = (variants: UsydPlanVariant[], id: string): UsydPlanVariant[] =>
  variants.filter((candidate) => specialisationId(candidate) === id);

const matchingStream = (groups: UsydPlanStreamGroup[], name: string): UsydPlanStreamGroup | null => {
  const matches = groups.filter((group) => normalizedPathway(group.pathway) === normalizedPathway(name));
  return matches.length === 1 ? matches[0]! : null;
};

/**
 * Resolves the independent Study Plan preview controls. Course Structure is not
 * read here: callers may use it to seed these values, but the preview owns them.
 */
export const resolveUsydEngineeringStudyPlanPreview = ({
  stream,
  specialisation,
  commencement: selectedCommencement,
  planId,
  plans,
}: {
  stream: string;
  specialisation: string;
  commencement: UsydCommencement | "";
  planId: string;
  plans: StudyPlan[];
}): UsydEngineeringStudyPlanPreview => {
  const streams = groupUsydStudyPlans(plans);
  const group = streams.find((candidate) => candidate.pathway === stream) ?? null;
  if (!group) {
    return {
      resolution: "waiting", streams, specialisations: [], commencements: [], variants: [],
      selectedStream: "", selectedSpecialisation: "", selectedCommencement: "", selectedPlan: null,
      reason: "Choose an Engineering stream to preview its official CUSP roadmap.",
    };
  }

  const specialisations = previewSpecialisations(group);
  const selectedSpecialisation = specialisations.some((candidate) => candidate.id === specialisation)
    ? specialisation
    : specialisations.find((candidate) => candidate.id === "BASE")?.id ?? specialisations[0]?.id ?? "";
  const commencements = group.commencements.filter((candidate) =>
    variantsForSpecialisation(candidate.variants, selectedSpecialisation).length > 0);
  const selectedCommencementValue = commencements.some((candidate) => candidate.id === selectedCommencement)
    ? selectedCommencement
    : commencements.find((candidate) => candidate.id === "STANDARD")?.id ?? commencements[0]?.id ?? "";
  const commencementGroup = commencements.find((candidate) => candidate.id === selectedCommencementValue);
  const variants = variantsForSpecialisation(commencementGroup?.variants ?? [], selectedSpecialisation);
  const selectedVariant = variants.find((candidate) => candidate.plan.id === planId) ?? variants[0] ?? null;
  const choice = specialisations.find((candidate) => candidate.id === selectedSpecialisation);

  if (!selectedSpecialisation || !selectedCommencementValue || !selectedVariant) {
    return {
      resolution: "fallback", streams, specialisations, commencements, variants,
      selectedStream: group.pathway, selectedSpecialisation, selectedCommencement: selectedCommencementValue,
      selectedPlan: null, reason: "No compatible official CUSP variant is available for these choices.",
    };
  }

  return {
    resolution: variants.length > 1 ? "ambiguous" : choice?.kind === "BASE" ? "base" : "exact",
    streams,
    specialisations,
    commencements,
    variants,
    selectedStream: group.pathway,
    selectedSpecialisation,
    selectedCommencement: selectedCommencementValue,
    selectedPlan: selectedVariant.plan,
    reason: variants.length > 1 ? "More than one official variant matches these choices. Select the one you want to preview." : "",
  };
};

/** Maps canonical Course Structure choices into optional initial preview values. */
export const suggestUsydEngineeringStudyPlanPreview = (
  selection: UsydEngineeringAcademicSelection,
  plans: StudyPlan[],
): { stream: string; specialisation: string } | null => {
  if (!selection.stream) return null;
  const group = matchingStream(groupUsydStudyPlans(plans), selection.stream.name);
  if (!group) return null;
  const choices = previewSpecialisations(group);
  if (selection.specialisations.length !== 1) {
    return { stream: group.pathway, specialisation: choices.some((choice) => choice.id === "BASE") ? "BASE" : "" };
  }
  const allVariants = group.commencements.flatMap((item) => item.variants);
  const matches = specialisationCandidates(allVariants, selection.specialisations[0]!.name);
  const ids = [...new Set(matches.map(specialisationId))];
  return {
    stream: group.pathway,
    specialisation: ids.length === 1 ? ids[0]! : choices.some((choice) => choice.id === "BASE") ? "BASE" : "",
  };
};

const specialisationCandidates = (variants: UsydPlanVariant[], selectedName: string): UsydPlanVariant[] => {
  const selected = normalizedSpecialisation(selectedName);
  const named = variants.filter((candidate) => candidate.specialisationName);
  const exact = named.filter((candidate) => normalizedSpecialisation(candidate.specialisationName!) === selected);
  if (exact.length > 0) return exact;

  // Environmental Engineering's formal "Chemical" label expands to
  // "Chemical Engineering for the Environment" in CUSP. Accept a partial
  // alias only when it identifies a single variant inside the selected pathway.
  const selectedWords = new Set(selected.split(" ").filter(Boolean));
  return named.filter((candidate) => {
    const candidateWords = new Set(normalizedSpecialisation(candidate.specialisationName!).split(" ").filter(Boolean));
    return [...selectedWords].every((word) => candidateWords.has(word))
      || [...candidateWords].every((word) => selectedWords.has(word));
  });
};

export const defaultUsydCommencement = (
  group: UsydPlanStreamGroup | null,
  current: UsydCommencement | "",
): UsydCommencement | "" => {
  if (!group) return "";
  if (group.commencements.some((candidate) => candidate.id === current)) return current;
  return group.commencements.find((candidate) => candidate.id === "STANDARD")?.id
    ?? group.commencements[0]?.id
    ?? "";
};

/** Resolves Course Structure -> CUSP in one direction; manual plans never mutate academic selections. */
export const resolveUsydEngineeringStudyPlan = ({
  selection,
  commencement,
  plans,
  selectionStatus = "ready",
}: {
  selection: UsydEngineeringAcademicSelection;
  commencement: UsydCommencement | "";
  plans: StudyPlan[];
  selectionStatus?: "ready" | "loading" | "error";
}): UsydEngineeringStudyPlanResolution => {
  if (!selection.stream) {
    return { resolution: "waiting", pathway: null, plan: null, group: null, variants: [],
      reason: "Choose an Engineering stream in Course Structure to resolve an official CUSP plan." };
  }
  const matchingGroups = groupUsydStudyPlans(plans).filter((group) =>
    normalizedPathway(group.pathway) === normalizedPathway(selection.stream!.name));
  if (matchingGroups.length !== 1) {
    return { resolution: matchingGroups.length > 1 ? "ambiguous" : "fallback", pathway: null,
      plan: null, group: null, variants: [], reason: matchingGroups.length > 1
        ? "More than one CUSP pathway matches this stream. Choose an official plan manually."
        : "Could not automatically match this stream to a CUSP pathway. Choose an official plan manually." };
  }

  const group = matchingGroups[0]!;
  const commencementGroup = group.commencements.find((candidate) => candidate.id === commencement);
  const variants = commencementGroup?.variants ?? [];
  if (selectionStatus === "loading") {
    return { resolution: "waiting", pathway: group.pathway, plan: null, group, variants,
      reason: "Loading the selected stream's Course Structure details." };
  }
  if (selectionStatus === "error") {
    return { resolution: "fallback", pathway: group.pathway, plan: null, group, variants,
      reason: "Could not load enough Course Structure data to match a CUSP variant safely. Choose an official plan manually." };
  }
  if (!commencementGroup) {
    return { resolution: "waiting", pathway: group.pathway, plan: null, group, variants: [],
      reason: "Choose a commencement to resolve the official CUSP plan." };
  }
  if (selection.specialisations.length > 1) {
    return { resolution: "ambiguous", pathway: group.pathway, plan: null, group, variants,
      reason: "Multiple active specialisations cannot be matched safely. Choose an official plan manually." };
  }

  const specialisation = selection.specialisations[0];
  const candidates = specialisation
    ? specialisationCandidates(variants, specialisation.name)
    : variants.filter((candidate) => candidate.kind === "BASE");
  if (candidates.length === 1) {
    return { resolution: specialisation ? "exact" : "base", pathway: group.pathway,
      plan: candidates[0]!.plan, group, variants, reason: "" };
  }
  return { resolution: candidates.length > 1 ? "ambiguous" : "fallback", pathway: group.pathway,
    plan: null, group, variants, reason: candidates.length > 1
      ? "More than one CUSP variant matches this Course Structure selection. Choose an official plan manually."
      : specialisation
        ? `No CUSP variant safely matches ${specialisation.name}. Choose an official plan manually.`
        : "No base CUSP plan is available for this commencement. Choose an official plan manually." };
};
