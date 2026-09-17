import type { DegreeDetailRecord } from "../repositories/degree.repository.js";
import type {
  DegreeDetailResponse,
  DegreeRequirementGroup,
  RequirementComponentSummary,
  StudentRequirementSummary,
} from "../types/degree.js";

type UniversityRecord = NonNullable<DegreeDetailRecord>;
type HandbookRecord = UniversityRecord["HandbookVersion"][number];
type DegreeRecord = HandbookRecord["Degree"][number];
type GroupRecord = DegreeRecord["RequirementGroup"][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "undefined"
    ? value.trim()
    : null;

const formatLabel = (value: string): string =>
  value.toLowerCase().replaceAll("_", " ");

const formatScopeLabel = (value: string): string =>
  /^[A-Z0-9_ ]+$/.test(value)
    ? formatLabel(value).replace(/\b\w/g, (letter) => letter.toUpperCase())
    : value;

export const isInternalRequirementTitle = (title: string | null): boolean => {
  const value = title?.trim();
  if (!value || /undefined/i.test(value)) return true;
  if (/^rawRequirements$/i.test(value)) return true;
  return /^(?:[A-Za-z_$][\w$]*)(?:\.\d+|\.[A-Za-z_$][\w$]*)+$/.test(value);
};

const scopeLabel = (scope: unknown): string | null => {
  const direct = readableText(scope);
  if (direct) return formatScopeLabel(direct);
  if (!isRecord(scope)) return null;
  const nested = readableText(scope.name) ?? readableText(scope.title) ?? readableText(scope.code);
  return nested ? formatScopeLabel(nested) : null;
};

export const buildRequirementDisplayTitle = (
  title: string | null,
  rawData: unknown,
  fallbackIndex: number,
): string => {
  if (isRecord(rawData)) {
    const tableName = readableText(rawData.tableName);
    const componentType = readableText(rawData.requestedComponentType);
    if (tableName && componentType) {
      return `${tableName} ${formatLabel(componentType)} choice pool`;
    }

    const role = readableText(rawData.role);
    const scopes = Array.isArray(rawData.scopes)
      ? rawData.scopes.map(scopeLabel).filter((scope): scope is string => scope !== null)
      : [];
    if (role && scopes.length > 0) {
      return `${scopes.join(", ")} ${formatLabel(role)} choice pool`;
    }
  }

  return isInternalRequirementTitle(title) ? `Requirement ${fallbackIndex}` : title!.trim();
};

const compareSortOrder = <T extends { id: string; sortOrder: number | null }>(
  left: T,
  right: T,
): number => {
  if (left.sortOrder === null && right.sortOrder !== null) return 1;
  if (left.sortOrder !== null && right.sortOrder === null) return -1;
  const orderDifference = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
  return orderDifference || left.id.localeCompare(right.id);
};

const isInternalComponentCode = (code: string): boolean =>
  code.split(":").length >= 4;

const componentSummary = (
  component: {
    id: string;
    code: string;
    name: string;
    type: RequirementComponentSummary["type"];
    creditPoints: number | null;
  },
  relationshipCreditPoints: number | null,
  requirementRoots: Array<{
    requiredCreditPoints: number | null;
    maximumCreditPoints: number | null;
    status: string | null;
  }> = [],
): RequirementComponentSummary => {
  const authoritativeRoots = requirementRoots.filter((root) => root.status !== "NON_REQUIREMENT");
  const onlyRoot = authoritativeRoots.length === 1 ? authoritativeRoots[0] : undefined;
  const derivedCreditPoints = onlyRoot
    && onlyRoot.requiredCreditPoints !== null
    && onlyRoot.requiredCreditPoints === onlyRoot.maximumCreditPoints
      ? onlyRoot.requiredCreditPoints
      : null;
  const creditPoints = relationshipCreditPoints ?? component.creditPoints ?? derivedCreditPoints;
  return {
    id: component.id,
    code: component.code,
    displayCode: isInternalComponentCode(component.code) ? null : component.code,
    name: component.name,
    type: component.type,
    creditPoints,
    creditPointsAvailability: relationshipCreditPoints !== null
      ? "EXPLICIT_RELATIONSHIP"
      : component.creditPoints !== null
        ? "EXPLICIT_COMPONENT"
        : derivedCreditPoints !== null ? "DERIVED_REQUIREMENTS" : "UNAVAILABLE",
  };
};

const mapGroup = (group: GroupRecord, fallbackIndex: number): DegreeRequirementGroup => {
  const items = group.RequirementItem.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    subject: item.Subject,
    component: item.Component ? componentSummary(item.Component, item.creditPoints) : null,
    rawCode: item.rawCode,
    rawName: item.rawName,
    creditPoints: item.creditPoints,
    sortOrder: item.sortOrder,
  }));

  // Choice-pool candidates use DegreeComponent because they are degree/component
  // relationships rather than conventional RequirementItem rows.
  const itemComponentIds = new Set(
    group.RequirementItem.flatMap((item) => item.Component ? [item.Component.id] : []),
  );
  const candidateKeys = new Set<string>();
  for (const candidate of group.DegreeComponent) {
    if (candidate.relationshipKind !== "CHOICE_POOL_CANDIDATE" || !candidate.Component) continue;
    if (itemComponentIds.has(candidate.Component.id)) continue;
    const candidateKey = `${candidate.Component.id}:${candidate.relationshipKind ?? ""}`;
    if (candidateKeys.has(candidateKey)) continue;
    candidateKeys.add(candidateKey);
    items.push({
      id: candidate.id,
      itemType: "COMPONENT",
      subject: null,
      component: componentSummary(
        candidate.Component,
        candidate.requiredCreditPoints,
        candidate.Component.RequirementGroup,
      ),
      rawCode: null,
      rawName: null,
      creditPoints: candidate.Component.creditPoints,
      sortOrder: candidate.sortOrder,
    });
  }
  items.sort(compareSortOrder);

  return {
    id: group.id,
    title: buildRequirementDisplayTitle(group.title, group.rawData, fallbackIndex),
    description: group.description,
    logic: group.logic,
    requiredCreditPoints: group.requiredCreditPoints,
    maximumCreditPoints: group.maximumCreditPoints,
    sortOrder: group.sortOrder,
    items,
    candidateSources: group.RequirementCandidateSource.map((source) => ({
      id: source.id,
      sourceKey: source.sourceKey,
      type: source.type,
      title: source.title,
      authoritative: source.authoritative,
      tableName: source.tableName,
      candidateCount: source._count.RequirementCandidateSubject,
    })),
    children: [],
    pathways: [],
  };
};

export const addExplicitPathways = (group: DegreeRequirementGroup): void => {
  group.children.forEach(addExplicitPathways);
  const description = normalizedDescription(group.description);
  if (!description.includes("one major")
    || !description.includes("two sub-majors")
    || !description.includes("one sub-major")
    || !description.includes("plus electives")) return;

  const majorGroup = group.children.find((child) => /\bmajors?\b/i.test(child.title ?? "") && !/sub/i.test(child.title ?? ""));
  const subMajorGroup = group.children.find((child) => /sub[ -]?majors?/i.test(child.title ?? ""));
  const electiveGroup = group.children.find((child) => /electives?/i.test(child.title ?? ""));
  if (!majorGroup || !subMajorGroup || !electiveGroup) return;
  const total = group.requiredCreditPoints;
  const subMajorPoints = subMajorGroup.requiredCreditPoints;
  const electivePoints = electiveGroup.requiredCreditPoints;
  if (!total || !subMajorPoints || !electivePoints || majorGroup.requiredCreditPoints !== total
    || subMajorPoints * 2 !== total || subMajorPoints + electivePoints !== total) return;

  group.pathways = [
    {
      id: `${group.id}:pathway:second-major`,
      title: "One second major",
      requiredCreditPoints: total,
      selections: [{ requirementGroupId: majorGroup.id, selectionType: "COMPONENT", requiredSelections: 1, requiredCreditPoints: total }],
    },
    {
      id: `${group.id}:pathway:two-sub-majors`,
      title: "Two sub-majors",
      requiredCreditPoints: total,
      selections: [{ requirementGroupId: subMajorGroup.id, selectionType: "COMPONENT", requiredSelections: 2, requiredCreditPoints: total }],
    },
    {
      id: `${group.id}:pathway:sub-major-and-electives`,
      title: "One sub-major plus electives",
      requiredCreditPoints: total,
      selections: [
        { requirementGroupId: subMajorGroup.id, selectionType: "COMPONENT", requiredSelections: 1, requiredCreditPoints: subMajorPoints },
        { requirementGroupId: electiveGroup.id, selectionType: "ELECTIVE_ALLOCATION", requiredSelections: 1, requiredCreditPoints: electivePoints },
      ],
    },
  ];
};

const normalizedDescription = (description: string | null): string =>
  (description ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const describedCreditPoints = (description: string): number | null => {
  const match = /(\d+)\s+credit points?/i.exec(description);
  return match ? Number(match[1]) : null;
};

const describedCreditPointRange = (description: string): number[] =>
  [...description.matchAll(/(\d+)\s+credit points?/gi)].map((match) => Number(match[1]));

const summaryTitle = (description: string, creditPoints: number | null): string => {
  if (/where appropriate/i.test(description)) return "Additional electives needed to reach the degree total";
  if (/dalyell/i.test(description)) return creditPoints === null ? "Dalyell units" : `${creditPoints} CP Dalyell units`;
  if (/open learning environment/i.test(description)) return creditPoints === null
    ? "Open Learning Environment units"
    : `Up to ${creditPoints} CP Open Learning Environment units`;
  if (/minor.*second major|second major.*minor/i.test(description)) return "Add a second major or minor";
  if (/\bmajor\b/i.test(description)) return creditPoints === null ? "Choose one major" : `Choose one ${creditPoints} CP major`;
  if (/4000-level|higher information technology electives/i.test(description)) return creditPoints === null
    ? "Advanced Information Technology electives"
    : `At least ${creditPoints} CP advanced Information Technology electives`;
  if (/core units?/i.test(description)) return creditPoints === null ? "Complete the core units" : `Complete ${creditPoints} CP of core units`;
  const concise = description.replace(/^[A-Za-z ]+must complete\s*/i, "").split(/[.;]/)[0]?.trim();
  return concise && concise.length <= 110 ? concise : "Review this degree requirement";
};

const mapCompletionSummary = (groups: GroupRecord[]): StudentRequirementSummary[] =>
  groups.flatMap((group) => {
    const sourceText = group.description?.trim();
    if (!sourceText || group.status === "NON_REQUIREMENT" || group.sourcePath === "rawRequirements") return [];
    const lower = sourceText.toLowerCase();
    const creditPoints = group.requiredCreditPoints ?? describedCreditPoints(sourceText);
    const describedRange = describedCreditPointRange(sourceText);
    const optional = /\boptionally\b|\bup to\b/.test(lower);
    const conditional = /for students enrolled|only (?:when|if)|where appropriate/.test(lower);
    const balancing = /where appropriate/.test(lower);
    const obligation = balancing ? "INFORMATIONAL" : conditional ? "CONDITIONAL" : optional ? "OPTIONAL" : "REQUIRED";
    const componentChoice = /\bmajor\b|\bminor\b/.test(lower);
    const subjectChoice = /elective|units? of study/.test(lower) && !/core units?/.test(lower);
    return [{
      id: `${group.id}:summary`,
      title: summaryTitle(sourceText, creditPoints),
      explanation: balancing
        ? "Use additional eligible electives only as needed to reach the total credit points for the degree."
        : conditional ? "This requirement applies only when the stated condition is met."
          : optional ? "This is optional and is not required for every student."
            : null,
      obligation,
      minimumCreditPoints: optional && /up to/.test(lower)
        ? 0
        : optional && describedRange.length > 1
          ? Math.min(...describedRange)
          : creditPoints,
      maximumCreditPoints: /up to/.test(lower)
        ? creditPoints
        : optional && describedRange.length > 1
          ? Math.max(...describedRange)
          : group.maximumCreditPoints,
      conditionLabel: balancing
        ? null
        : /dalyell/.test(lower)
          ? "Enrolled in the Dalyell Stream"
          : conditional ? sourceText.split(",")[0] ?? null : null,
      actionKind: balancing
        ? "CHOOSE_SUBJECTS"
        : conditional
          ? "CONFIRM_CONDITION"
          : componentChoice ? "CHOOSE_COMPONENT" : subjectChoice ? "CHOOSE_SUBJECTS" : "NONE",
      sourceText,
      sourceUrl: group.sourceUrl,
      requirementGroupId: group.id,
    }];
  });

const filterDisplayGroups = (groups: GroupRecord[]): GroupRecord[] => {
  const requirementGroups = groups.filter((group) => group.status !== "NON_REQUIREMENT");
  const authoritativePaths = new Set(
    requirementGroups
      .filter((group) => group.status === "AUTHORITATIVE" && group.sourcePath)
      .map((group) => group.sourcePath),
  );
  const preferredGroups = requirementGroups.filter((group) =>
    group.status !== "RAW_FALLBACK"
      || !group.sourcePath
      || !authoritativePaths.has(group.sourcePath),
  );

  return preferredGroups.filter((group) => {
    if (group.status !== "RAW_FALLBACK" || group.sourcePath !== "rawRequirements") return true;
    const rawDescription = normalizedDescription(group.description);
    const otherDescriptions = preferredGroups
      .filter((candidate) => candidate.id !== group.id)
      .map((candidate) => normalizedDescription(candidate.description))
      .filter(Boolean);
    const hasAuthoritativeClause = preferredGroups.some((candidate) =>
      candidate.id !== group.id && candidate.status === "AUTHORITATIVE");
    return !hasAuthoritativeClause
      || otherDescriptions.length === 0
      || !otherDescriptions.every((description) => rawDescription.includes(description));
  });
};

export const mapDegreeDetail = (
  university: UniversityRecord,
  handbook: HandbookRecord,
  degree: DegreeRecord,
): DegreeDetailResponse => {
  const groupsById = new Map<string, DegreeRequirementGroup>();
  const displayGroups = filterDisplayGroups(degree.RequirementGroup);

  for (const [index, group] of displayGroups.entries()) {
    groupsById.set(group.id, mapGroup(group, index + 1));
  }

  const requirements: DegreeRequirementGroup[] = [];

  for (const group of displayGroups) {
    const mappedGroup = groupsById.get(group.id);
    if (!mappedGroup) continue;

    const parent = group.parentGroupId
      ? groupsById.get(group.parentGroupId)
      : undefined;

    if (parent) {
      parent.children.push(mappedGroup);
    } else {
      requirements.push(mappedGroup);
    }
  }

  for (const group of groupsById.values()) {
    group.children.sort(compareSortOrder);
  }
  requirements.sort(compareSortOrder);
  requirements.forEach(addExplicitPathways);

  return {
    degree: {
      id: degree.id,
      code: degree.code,
      name: degree.name,
      creditPoints: degree.creditPoints,
      handbookYear: handbook.year,
      university: {
        id: university.id,
        code: university.code,
        name: university.name,
      },
      description: degree.description,
      rankings: degree.DegreeRanking.map((ranking) => ({
        source: ranking.source,
        category: ranking.category,
        year: ranking.year,
        rank: ranking.rank,
        rankBand: ranking.rankBand,
      })),
    },
    requirements,
    completionSummary: mapCompletionSummary(displayGroups),
  };
};
