import type { ComponentSelections } from "../hooks/useComponentSelections";
import type {
  ComponentDetailResponse,
  RequirementGroup,
  RequirementSubject,
  StudyPlan,
  StudyPlanItem,
} from "../types/handbook";

export const flattenRequirements = (
  groups: RequirementGroup[],
): RequirementGroup[] =>
  groups.flatMap((group) => [
    group,
    ...flattenRequirements(group.children),
  ]);

// Recover explicit handbook codes, never the visible heading as an identifier.
export const handbookCodes = (
  text: string | null | undefined,
): string[] =>
  text
    ?.match(/\b(?:CBK|STM|MAJ|SMJ)\d{5}\b/gi)
    ?.map((code) => code.toUpperCase()) ?? [];

export const requirementCodes = (
  group: RequirementGroup,
) =>
  new Set([
    ...handbookCodes(group.description),
    ...handbookCodes(group.title),
  ]);

interface Unit {
  key: string;
  cp: number;
  groupId?: string;
  degreeGroupId: string;
  pathwayId: string;
  component?: ComponentDetailResponse["component"];
  subject?: RequirementSubject;
  fixed?: boolean;
  rawCode?: string;
  source: "FORMAL" | "BROAD" | "UNRESOLVED";
  label: string;
}

const uniformPoints = (
  groups: RequirementGroup[],
): number | undefined => {
  const values = new Set(
    flattenRequirements(groups).flatMap((group) =>
      group.items.flatMap((item) =>
        item.subject &&
        (item.subject.creditPoints ?? 0) > 0
          ? [item.subject.creditPoints!]
          : [],
      ),
    ),
  );

  return values.size === 1
    ? [...values][0]
    : undefined;
};

const components = (group: RequirementGroup) =>
  group.items.flatMap((item) =>
    item.component ? [item.component] : [],
  );

const normalized = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Supports both the correct UTS wording "Option"
 * and the source typo "Optoin".
 */
const isOptionSlot = (value: string) => {
  const name = normalized(value);

  return (
    /\boption\b/.test(name) ||
    /\btechnical\b/.test(name) ||
    /\boptoin\b/.test(name)
  );
};

const componentSelectionCount = (
  group: RequirementGroup,
): number | null => {
  const options = components(group);

  if (
    options.length === 0 ||
    options.length !== group.items.length
  ) {
    return null;
  }

  if (group.logic === "ONE_OF") {
    return 1;
  }

  if (
    group.logic !== "ANY" ||
    group.requiredCreditPoints === null
  ) {
    return null;
  }

  const points = options.map(
    (option) => option.creditPoints,
  );

  if (
    points.some(
      (point) => point === null || point <= 0,
    )
  ) {
    return null;
  }

  const first = points[0];

  if (
    first === null ||
    !points.every((point) => point === first) ||
    group.requiredCreditPoints % first !== 0
  ) {
    return null;
  }

  const count =
    group.requiredCreditPoints / first;

  return count > 0 && count <= options.length
    ? count
    : null;
};

/**
 * Adds selected stream/component provenance to existing official
 * roadmap option positions.
 *
 * Example:
 *
 * Electrical Engineering Options = 24 CP
 * Control Studios = 12 CP
 * Embedded Systems = 12 CP
 *
 * Four official 6 CP option slots become:
 *
 * slot 1 -> Control Studios
 * slot 2 -> Control Studios
 * slot 3 -> Embedded Systems
 * slot 4 -> Embedded Systems
 */
const mapMultiComponentMajorOptions = (
  plan: StudyPlan,
  requirements: RequirementGroup[],
  selections: ComponentSelections,
  details: Record<string, ComponentDetailResponse>,
): StudyPlan => {
  const degreeGroups =
    flattenRequirements(requirements);

  const majorGroup = degreeGroups.find(
    (group) =>
      components(group).some(
        (component) =>
          component.type === "MAJOR",
      ),
  );

  if (!majorGroup) return plan;

  const selectedMajorCode =
    selections[majorGroup.id];

  if (!selectedMajorCode) return plan;

  const majorDetail =
    details[selectedMajorCode];

  if (!majorDetail) return plan;

  const assignments = new Map<
    string,
    ComponentDetailResponse["component"]
  >();

  for (const requirement of flattenRequirements(
    majorDetail.requirements,
  )) {
    const requiredSelections =
      componentSelectionCount(requirement);

    if (
      requiredSelections === null ||
      requiredSelections <= 1
    ) {
      continue;
    }

    const selectedDetails = Array.from(
      { length: requiredSelections },
      (_, index) =>
        selections[
          `${requirement.id}:component:${index}`
        ],
    )
      .filter(
        (code): code is string =>
          Boolean(code),
      )
      .map((code) => details[code])
      .filter(
        (
          detail,
        ): detail is ComponentDetailResponse =>
          Boolean(detail),
      );

    if (selectedDetails.length === 0) {
      continue;
    }

    const majorName = normalized(
      majorDetail.component.name,
    );

    const candidates =
      plan.years.flatMap((year) =>
        year.periods.flatMap((period) =>
          period.items.filter((item) => {
            if (
              item.itemType !== "CHOICE" ||
              item.subject
            ) {
              return false;
            }

            const value =
              item.choiceOrigin?.title ??
              item.title;

            const slotName =
              normalized(value);

            return (
              slotName.includes(majorName) &&
              isOptionSlot(value)
            );
          }),
        ),
      );

    if (candidates.length === 0) {
      continue;
    }

    let offset = 0;

    for (const detail of selectedDetails) {
      const capacity =
        detail.component.creditPoints;

      if (
        capacity === null ||
        capacity <= 0
      ) {
        continue;
      }

      let accumulated = 0;
      const pendingIds: string[] = [];

      while (
        offset < candidates.length &&
        accumulated < capacity
      ) {
        const candidate =
          candidates[offset];

        const points =
          candidate.creditPoints ?? 0;

        if (
          points <= 0 ||
          accumulated + points > capacity
        ) {
          break;
        }

        accumulated += points;
        pendingIds.push(candidate.id);
        offset += 1;
      }

      // Never guess partial ownership.
      if (
        accumulated !== capacity ||
        pendingIds.length === 0
      ) {
        continue;
      }

      pendingIds.forEach((id) => {
        assignments.set(
          id,
          detail.component,
        );
      });
    }
  }

  if (assignments.size === 0) {
    return plan;
  }

  return {
    ...plan,

    years: plan.years.map((year) => ({
      ...year,

      periods: year.periods.map((period) => ({
        ...period,

        items: period.items.map((item) => {
          const component =
            assignments.get(item.id);

          if (!component) {
            return item;
          }

          return {
            ...item,

            choiceOrigin: {
              ...item.choiceOrigin,

              officialChoiceItemId:
                item.choiceOrigin
                  ?.officialChoiceItemId ??
                item.id,

              originalPeriodId:
                item.choiceOrigin
                  ?.originalPeriodId ??
                period.id,

              title:
                item.choiceOrigin?.title ??
                item.title,

              rawCode:
                item.choiceOrigin?.rawCode ??
                item.rawCode,

              creditPoints:
                item.choiceOrigin
                  ?.creditPoints ??
                item.creditPoints,

              maximumCreditPoints:
                item.choiceOrigin
                  ?.maximumCreditPoints ??
                item.creditPoints ??
                undefined,

              formalComponentCode:
                component.code,

              formalComponentId:
                component.id,

              componentRequirementKind:
                "COMPONENT",

              candidateSourceType:
                "FORMAL",

              sourceLabel:
                component.name,
            },
          };
        }),
      })),
    })),
  };
};

/**
 * Expand only code-linked pathway aggregates, within their official periods.
 *
 * Mixed/unknown subject sizes and unsupported nested alternatives remain
 * unresolved rather than claiming invented subject positions.
 */
export const expandRoadmapSlots = (
  plan: StudyPlan | undefined,
  universityCode: string,
  requirements: RequirementGroup[],
  selections: ComponentSelections,
  details: Record<string, ComponentDetailResponse>,
): StudyPlan | undefined => {
  if (!plan || universityCode !== "UTS") {
    return plan;
  }

  const allGroups =
    flattenRequirements(requirements);

  const defaultPoints =
    uniformPoints(requirements);

  const originalItems =
    plan.years.flatMap((year) =>
      year.periods.flatMap(
        (period) => period.items,
      ),
    );

  const replacement = new Map<
    string,
    StudyPlanItem[]
  >();

  for (const parentGroup of allGroups.filter(
    (group) => group.pathways.length,
  )) {
    const codes =
      requirementCodes(parentGroup);

    const parents = originalItems.filter(
      (item) =>
        item.itemType === "CHOICE" &&
        !item.choiceOrigin
          ?.parentAggregateItemId &&
        [
          ...handbookCodes(item.rawCode),
          ...handbookCodes(item.title),
        ].some((code) => codes.has(code)),
    );

    if (
      !parents.length ||
      parents.some((item) =>
        originalItems.some(
          (child) =>
            child.choiceOrigin
              ?.parentAggregateItemId ===
            item.id,
        ),
      )
    ) {
      continue;
    }

    const selected =
      selections[parentGroup.id];

    const pathway =
      parentGroup.pathways.find(
        (candidate) =>
          `PATHWAY:${candidate.id}` ===
          selected,
      );

    const total = parents.reduce(
      (sum, item) =>
        sum + (item.creditPoints ?? 0),
      0,
    );

    if (
      total !==
        parentGroup.requiredCreditPoints ||
      parents.some(
        (item) =>
          !item.creditPoints ||
          (item.numberOfPeriods &&
            item.numberOfPeriods > 1),
      )
    ) {
      continue;
    }

    const units: Unit[] = [];

    const addEmpty = (
      capacity: number,
      unit: Omit<Unit, "key" | "cp">,
      prefix: string,
      points = defaultPoints,
    ) => {
      if (
        !points ||
        capacity % points
      ) {
        return false;
      }

      for (
        let ordinal = 0;
        ordinal < capacity / points;
        ordinal++
      ) {
        units.push({
          ...unit,
          cp: points,
          key: `${prefix}:${ordinal}`,
        });
      }

      return true;
    };

    let supported = true;

    if (!pathway) {
      supported = addEmpty(
        total,
        {
          degreeGroupId:
            parentGroup.id,
          pathwayId: "",
          source: "UNRESOLVED",
          label: "Choose a pathway",
        },
        parentGroup.id,
      );
    } else {
      for (const allocation of pathway.selections) {
        const group = allGroups.find(
          (candidate) =>
            candidate.id ===
            allocation.requirementGroupId,
        );

        for (
          let ordinal = 0;
          ordinal <
          allocation.requiredSelections;
          ordinal++
        ) {
          const key =
            `${pathway.id}:selection:${allocation.requirementGroupId}:${ordinal}`;

          const code =
            selections[key];

          const detail = code
            ? details[code]
            : undefined;

          const capacity =
            allocation.requiredCreditPoints /
            allocation.requiredSelections;

          const base = {
            degreeGroupId:
              allocation.requirementGroupId,
            pathwayId: pathway.id,
          };

          if (
            allocation.selectionType ===
              "ELECTIVE_ALLOCATION" ||
            !detail
          ) {
            supported =
              addEmpty(
                capacity,
                {
                  ...base,

                  groupId:
                    allocation.selectionType ===
                    "ELECTIVE_ALLOCATION"
                      ? group?.id
                      : undefined,

                  source:
                    allocation.selectionType ===
                    "ELECTIVE_ALLOCATION"
                      ? "BROAD"
                      : "UNRESOLVED",

                  label:
                    allocation.selectionType ===
                    "ELECTIVE_ALLOCATION"
                      ? "Electives"
                      : "Choose a component",
                },
                key,
              ) && supported;

            continue;
          }

          const componentUnits: Unit[] = [];

          const visit = (
            groups: RequirementGroup[],
          ) => {
            for (const requirement of groups) {
              const subjects =
                requirement.items.flatMap(
                  (item) =>
                    item.subject
                      ? [item.subject]
                      : [],
                );

              const cp =
                requirement.requiredCreditPoints;

              const fixed =
                requirement.logic === "ALL" &&
                requirement.children.length ===
                  0 &&
                requirement.items.length > 0 &&
                requirement.items.every(
                  (item) =>
                    item.itemType ===
                      "SUBJECT" &&
                    (item.subject
                      ?.creditPoints ??
                      item.creditPoints) !==
                      null,
                ) &&
                requirement.items.reduce(
                  (sum, item) =>
                    sum +
                    (item.subject
                      ?.creditPoints ??
                      item.creditPoints ??
                      0),
                  0,
                ) === cp;

              const unitBase = {
                ...base,

                component:
                  detail.component,

                groupId:
                  requirement.id,

                source:
                  "FORMAL" as const,

                label:
                  `${detail.component.name} · ${
                    requirement.title ??
                    "Subjects"
                  }`,
              };

              if (fixed) {
                requirement.items.forEach(
                  (item) =>
                    componentUnits.push({
                      ...unitBase,

                      key:
                        `${key}:${requirement.id}:${item.id}`,

                      cp:
                        (item.subject
                          ?.creditPoints ??
                          item.creditPoints)!,

                      subject:
                        item.subject ??
                        undefined,

                      fixed: true,

                      rawCode:
                        item.subject?.code ??
                        item.rawCode ??
                        undefined,

                      source:
                        item.subject
                          ? "FORMAL"
                          : "UNRESOLVED",

                      label: item.subject
                        ? unitBase.label
                        : `${detail.component.name}: required ${
                            item.rawCode ??
                            "subject"
                          } ${
                            item.rawName ??
                            ""
                          } — missing subject record`,
                    }),
                );
              } else if (
                requirement.children.length &&
                requirement.logic === "ALL" &&
                !subjects.length
              ) {
                visit(
                  requirement.children,
                );
              } else {
                const points =
                  uniformPoints([
                    requirement,
                  ]);

                if (
                  !points ||
                  !cp ||
                  cp % points ||
                  requirement.children
                    .length ||
                  requirement.items.some(
                    (item) =>
                      item.component,
                  ) ||
                  subjects.reduce(
                    (sum, subject) =>
                      sum +
                      (subject.creditPoints ??
                        0),
                    0,
                  ) < cp
                ) {
                  supported = false;
                  continue;
                }

                for (
                  let index = 0;
                  index < cp / points;
                  index++
                ) {
                  componentUnits.push({
                    ...unitBase,

                    key:
                      `${key}:${requirement.id}:${index}`,

                    cp: points,
                  });
                }
              }
            }
          };

          visit(detail.requirements);

          if (
            componentUnits.reduce(
              (sum, unit) =>
                sum + unit.cp,
              0,
            ) !== capacity
          ) {
            supported = false;
          }

          // The formal groups determine capacity, not a student's study order.
          units.push(
            ...componentUnits.map(
              (unit, index) => ({
                ...unit,

                key:
                  `${key}:position:${index}`,

                subject: undefined,
                fixed: false,
                rawCode: undefined,
                groupId: undefined,

                source:
                  "FORMAL" as const,

                label:
                  `${detail.component.name} subject`,
              }),
            ),
          );
        }
      }
    }

    if (
      !supported ||
      units.reduce(
        (sum, unit) =>
          sum + unit.cp,
        0,
      ) !== total
    ) {
      for (const parent of parents) {
        replacement.set(
          parent.id,
          [
            {
              ...parent,

              choiceOrigin: {
                officialChoiceItemId:
                  parent.id,

                originalPeriodId: "",

                title:
                  parent.title,

                rawCode:
                  parent.rawCode,

                creditPoints:
                  parent.creditPoints,

                degreeRequirementGroupId:
                  parentGroup.id,

                candidateSourceType:
                  "UNRESOLVED",

                sourceLabel:
                  "The selected component has mixed subject sizes, incomplete records or nested choices that cannot yet be placed safely in this official block.",
              },
            },
          ],
        );
      }

      continue;
    }

    let offset = 0;

    const pending = new Map<
      string,
      StudyPlanItem[]
    >();

    for (const parent of parents) {
      let remaining =
        parent.creditPoints!;

      const children: StudyPlanItem[] = [];

      while (
        remaining > 0 &&
        offset < units.length
      ) {
        const unit =
          units[offset++];

        if (
          unit.cp <= 0 ||
          unit.cp > remaining
        ) {
          supported = false;
          break;
        }

        remaining -= unit.cp;

        const id =
          `${plan.id}:${parent.id}:${unit.key}`;

        const title =
          unit.component
            ? unit.label
            : `${unit.label} · ${unit.cp} CP choice`;

        children.push({
          ...parent,

          id,

          itemType:
            unit.subject
              ? "SUBJECT"
              : "CHOICE",

          subject:
            unit.subject ?? null,

          title:
            unit.subject?.name ??
            title,

          creditPoints:
            unit.cp,

          rawCode:
            unit.subject?.code ??
            unit.rawCode ??
            parent.rawCode,

          choiceOrigin: {
            officialChoiceItemId:
              parent.id,

            originalPeriodId: "",

            title,

            rawCode:
              parent.rawCode,

            creditPoints:
              unit.cp,

            maximumCreditPoints:
              unit.cp,

            parentAggregateItemId:
              parent.id,

            parentAggregateTitle:
              parent.title,

            parentAggregateCreditPoints:
              parent.creditPoints!,

            selectedPathwayId:
              unit.pathwayId,

            degreeRequirementGroupId:
              unit.degreeGroupId,

            ...(unit.groupId
              ? {
                  formalRequirementGroupId:
                    unit.groupId,
                }
              : {}),

            formalComponentCode:
              unit.component?.code,

            formalComponentId:
              unit.component?.id,

            componentRequirementKind:
              unit.component
                ? "COMPONENT"
                : "SELECTIVE",

            candidateSourceType:
              unit.source,

            sourceLabel:
              unit.component?.name ??
              unit.label,
          },
        });
      }

      pending.set(
        parent.id,
        children,
      );
    }

    if (supported) {
      pending.forEach(
        (children, id) =>
          replacement.set(
            id,
            children,
          ),
      );
    }
  }

  const expandedPlan: StudyPlan = {
    ...plan,

    years: plan.years.map((year) => ({
      ...year,

      periods: year.periods.map(
        (period) => ({
          ...period,

          items:
            period.items.flatMap(
              (item) =>
                replacement
                  .get(item.id)
                  ?.map((child) => ({
                    ...child,

                    choiceOrigin: {
                      ...child.choiceOrigin!,

                      originalPeriodId:
                        period.id,
                    },
                  })) ?? [item],
            ),
        }),
      ),
    })),
  };

  return mapMultiComponentMajorOptions(
    expandedPlan,
    requirements,
    selections,
    details,
  );
};