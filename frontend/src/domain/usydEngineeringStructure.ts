import type { DegreeDetailResponse, RequirementGroup, StudyPlan,
  StudentRequirementSummary } from "../types/handbook";
import { groupUsydStudyPlans } from "./usydStudyPlan";

export interface UsydEngineeringStructure {
  totalCreditPoints: number;
  core: {
    title: "Engineering Core";
    creditPoints: 48;
    foundation: StudentRequirementSummary;
    foundationGroup: RequirementGroup | null;
    projects: StudentRequirementSummary;
    projectsGroup: RequirementGroup | null;
    professionalEngagement: StudentRequirementSummary;
    professionalEngagementGroup: RequirementGroup | null;
  };
  stream: StudentRequirementSummary;
  streamGroup: RequirementGroup | null;
  electives: StudentRequirementSummary;
  electivesGroup: RequirementGroup | null;
  conditional: StudentRequirementSummary[];
  conditionalGroups: Map<string, RequirementGroup>;
  sourceClauses: StudentRequirementSummary[];
}

export const isUsydEngineeringDegree = (detail: DegreeDetailResponse): boolean =>
  detail.degree.university.code === "USYD" && detail.degree.code === "BHENGINE-04";

const clause = (
  summaries: StudentRequirementSummary[],
  predicate: (summary: StudentRequirementSummary) => boolean,
  label: string,
): StudentRequirementSummary => {
  const result = summaries.find(predicate);
  if (!result) throw new Error(`USYD Engineering source clause unavailable: ${label}`);
  return result;
};

const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] =>
  groups.flatMap((group) => [group, ...flattenGroups(group.children)]);

const structuredContentCount = (group: RequirementGroup): number =>
  group.items.length + group.candidateSources.length + group.pathways.length + group.children.reduce((total, child) =>
    total + 1 + structuredContentCount(child), 0);

const normalizedTitle = (title: string | null): string =>
  (title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const formalComponentPool = (
  detail: DegreeDetailResponse,
  componentType: string,
): RequirementGroup | null => flattenGroups(detail.requirements).find((group) =>
  group.logic === "ONE_OF"
  && group.items.length > 1
  && group.items.every((item) => item.itemType === "COMPONENT"
    && item.component?.type === componentType)) ?? null;

const sourceGroup = (
  detail: DegreeDetailResponse,
  summary: StudentRequirementSummary,
  pattern: RegExp,
  claimedGroupIds: Set<string>,
  exactTitles: string[] = [],
): RequirementGroup | null => {
  const groups = flattenGroups(detail.requirements);
  const available = groups.filter((group) => !claimedGroupIds.has(group.id));
  const normalizedExactTitles = new Set(exactTitles.map(normalizedTitle));
  const exactTitle = available
    .filter((group) => normalizedExactTitles.has(normalizedTitle(group.title)))
    .sort((left, right) => structuredContentCount(right) - structuredContentCount(left));
  const exactId = available.find((group) => group.id === summary.requirementGroupId);
  const titleCandidates = available.filter((group) => pattern.test(group.title ?? ""));
  const descriptionCandidates = available.filter((group) => pattern.test(group.description ?? ""));
  const best = (candidates: RequirementGroup[]) => [...candidates]
    .sort((left, right) => structuredContentCount(right) - structuredContentCount(left))[0];
  const source = exactTitle[0] ?? best(titleCandidates) ?? exactId ?? best(descriptionCandidates) ?? null;
  if (source) claimedGroupIds.add(source.id);
  return source;
};

/**
 * Compatibility view for BHENGINE-04 while the imported course-resolution
 * clauses remain flat. It groups only the explicit Foundation, Projects, PEP,
 * Stream, Table S/elective and Dalyell clauses; it does
 * not create Component or Subject relationships.
 */
export const mapUsydEngineeringStructure = (detail: DegreeDetailResponse): UsydEngineeringStructure | null => {
  if (!isUsydEngineeringDegree(detail)) return null;
  const summaries = detail.completionSummary;
  const foundation = clause(summaries, (item) => /Engineering Foundations Table/i.test(item.sourceText ?? "")
    && item.minimumCreditPoints === 18, "18 CP Foundation");
  const projects = clause(summaries, (item) => /Engineering Projects Table/i.test(item.sourceText ?? "")
    && item.minimumCreditPoints === 30, "30 CP Projects");
  const professionalEngagement = clause(summaries,
    (item) => /successfully complete the requirements of the Professional Engagement Program/i.test(item.sourceText ?? ""),
    "Professional Engagement Program");
  const stream = clause(summaries, (item) => /120 credit points from the Engineering Stream Table/i.test(item.sourceText ?? ""),
    "120 CP Engineering Stream");
  const electives = clause(summaries, (item) => /24 credit points from Table S/i.test(item.sourceText ?? ""),
    "24 CP open electives");
  const conditional = summaries.filter((item) => item.obligation === "CONDITIONAL"
    && /^\s*for students enrolled/i.test(item.sourceText ?? ""));
  const claimedGroupIds = new Set<string>();
  const foundationGroup = sourceGroup(detail, foundation, /Engineering Foundations Table/i,
    claimedGroupIds, ["Foundation"]);
  const projectsGroup = sourceGroup(detail, projects, /Engineering Projects Table/i,
    claimedGroupIds, ["Engineering Projects"]);
  const professionalEngagementGroup = sourceGroup(detail, professionalEngagement,
    /Professional Engagement Program/i, claimedGroupIds, ["Professional Engagement Program"]);
  const streamGroup = formalComponentPool(detail, "STREAM")
    ?? sourceGroup(detail, stream, /Engineering Stream Tables?/i, claimedGroupIds);
  if (streamGroup) claimedGroupIds.add(streamGroup.id);
  const electivesGroup = sourceGroup(detail, electives,
    /Table S of the Shared Pool|credit points from Table S/i, claimedGroupIds);

  return {
    totalCreditPoints: detail.degree.creditPoints ?? 192,
    core: {
      title: "Engineering Core",
      creditPoints: 48,
      foundation,
      foundationGroup,
      projects,
      projectsGroup,
      professionalEngagement,
      professionalEngagementGroup,
    },
    stream,
    streamGroup,
    electives,
    electivesGroup,
    conditional,
    conditionalGroups: new Map(conditional.flatMap((item) => {
      const group = sourceGroup(detail, item, /Dalyell.*Table D|Table D.*Dalyell/i, claimedGroupIds);
      return group ? [[item.requirementGroupId, group]] : [];
    })),
    sourceClauses: summaries.filter((item) => item.sourceText),
  };
};

const displayGroup = ({ id, title, description, requiredCreditPoints, maximumCreditPoints,
  logic = "ALL", children, source }: {
  id: string;
  title: string;
  description: string | null;
  requiredCreditPoints?: number | null;
  maximumCreditPoints?: number | null;
  logic?: RequirementGroup["logic"];
  children?: RequirementGroup[];
  source?: RequirementGroup | null;
}): RequirementGroup => ({
  id: source?.id ?? id,
  title,
  description,
  logic: source?.logic ?? logic,
  requiredCreditPoints: requiredCreditPoints !== undefined
    ? requiredCreditPoints
    : source?.requiredCreditPoints ?? null,
  maximumCreditPoints: maximumCreditPoints !== undefined
    ? maximumCreditPoints
    : source?.maximumCreditPoints ?? null,
  sortOrder: source?.sortOrder ?? null,
  items: source?.items ?? [],
  candidateSources: source?.candidateSources ?? [],
  children: children ?? source?.children ?? [],
  pathways: source?.pathways ?? [],
});

const sectionDescription = (summary: StudentRequirementSummary, source: RequirementGroup | null): string | null =>
  summary.sourceText ?? source?.description ?? null;

/** Converts the semantic compatibility model into the same visual contract used by UTS accordions. */
export const usydEngineeringDisplayGroups = (structure: UsydEngineeringStructure): RequirementGroup[] => [
  displayGroup({
    id: "usyd-engineering-core",
    title: structure.core.title,
    description: null,
    requiredCreditPoints: structure.core.creditPoints,
    children: [
      displayGroup({ id: structure.core.foundation.requirementGroupId, title: "Foundation",
        description: sectionDescription(structure.core.foundation, structure.core.foundationGroup),
        requiredCreditPoints: structure.core.foundation.minimumCreditPoints, source: structure.core.foundationGroup }),
      displayGroup({ id: structure.core.projects.requirementGroupId, title: "Engineering Projects",
        description: sectionDescription(structure.core.projects, structure.core.projectsGroup),
        requiredCreditPoints: structure.core.projects.minimumCreditPoints, source: structure.core.projectsGroup }),
      displayGroup({ id: structure.core.professionalEngagement.requirementGroupId, title: "Professional Engagement Program",
        description: sectionDescription(structure.core.professionalEngagement, structure.core.professionalEngagementGroup),
        requiredCreditPoints: null, source: structure.core.professionalEngagementGroup }),
    ],
  }),
  displayGroup({
    id: structure.stream.requirementGroupId,
    title: "Engineering Stream",
    description: sectionDescription(structure.stream, structure.streamGroup),
    requiredCreditPoints: structure.stream.minimumCreditPoints,
    logic: "ONE_OF",
    source: structure.streamGroup,
  }),
  displayGroup({
    id: structure.electives.requirementGroupId,
    title: "Open Electives",
    description: sectionDescription(structure.electives, structure.electivesGroup),
    requiredCreditPoints: null,
    maximumCreditPoints: structure.electives.maximumCreditPoints
      ?? (/\bmaximum\b|\bup to\b/i.test(structure.electives.sourceText ?? "")
        ? structure.electives.minimumCreditPoints
        : null),
    logic: "ANY",
    source: structure.electivesGroup,
  }),
];

export const usydEngineeringConditionalDisplayGroups = (structure: UsydEngineeringStructure): RequirementGroup[] =>
  structure.conditional.map((item) => displayGroup({
    id: item.requirementGroupId,
    title: item.title,
    description: sectionDescription(item, structure.conditionalGroups.get(item.requirementGroupId) ?? null),
    requiredCreditPoints: item.minimumCreditPoints,
    logic: "ALL",
    source: structure.conditionalGroups.get(item.requirementGroupId) ?? null,
  }));

export interface UsydEngineeringStreamChoice {
  pathway: string;
  plan: StudyPlan;
}

/**
 * StudyPlan.pathway is the only current stream identity. Require an explicit
 * standard BASE plan as evidence for the pathway label, but do not convert its
 * semester rows into Course Structure requirements.
 */
export const usydEngineeringStreamChoices = (plans: StudyPlan[]): UsydEngineeringStreamChoice[] =>
  groupUsydStudyPlans(plans).flatMap((group) => {
    const standard = group.commencements.find((candidate) => candidate.id === "STANDARD");
    const base = standard?.variants.find((candidate) => candidate.kind === "BASE")?.plan;
    if (!base) return [];
    return [{
      pathway: group.pathway,
      plan: base,
    }];
  });
