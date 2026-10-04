import type { ComponentSelections } from "../hooks/useComponentSelections";
import type {
  ComponentDetailResponse,
  RequirementGroup,
  StudyPlanItem,
} from "../types/handbook";
import type { PlannerState } from "../types/planner";
import {
  handbookCodes,
  requirementCodes,
} from "./roadmapSlots";

export interface ChoiceScope {
  kind: "FORMAL" | "BROAD" | "UNRESOLVED";
  label?: string;
  componentCode?: string;
  componentId?: string;
  requirementGroupId?: string;
  groups?: RequirementGroup[];
  selectableGroupIds?: string[];
  /** A single deduplicated union with explicit requirement attribution. */
  union?: boolean;
  componentCodesByGroup?: Record<string, string>;
  limitation?: string;
}

const flatten = (
  groups: RequirementGroup[],
): RequirementGroup[] =>
  groups.flatMap((group) => [
    group,
    ...flatten(group.children),
  ]);

const components = (
  group: RequirementGroup,
) =>
  group.items.flatMap((item) =>
    item.component ? [item.component] : [],
  );

const normalized = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isOptionSlot = (value: string) => {
  const name = normalized(value);

  return (
    /\boption\b/.test(name) ||
    /\btechnical\b/.test(name) ||
    /\boptoin\b/.test(name)
  );
};

const selectedChild = (
  group: RequirementGroup,
  selections: ComponentSelections,
) => {
  const value =
    selections[group.id];

  return value?.startsWith("GROUP:")
    ? group.children.find(
        (child) =>
          child.id === value.slice(6),
      )
    : undefined;
};

const selectedComponentCodesForGroup = (
  group: RequirementGroup,
  selections: ComponentSelections,
): string[] => {
  const result: string[] = [];

  const direct =
    selections[group.id];

  if (
    direct &&
    !direct.startsWith("GROUP:")
  ) {
    result.push(direct);
  }

  const prefix =
    `${group.id}:component:`;

  const multiple =
    Object.entries(selections)
      .filter(
        ([key, value]) =>
          key.startsWith(prefix) &&
          Boolean(value) &&
          !value.startsWith("GROUP:"),
      )
      .sort(([a], [b]) => {
        const aIndex = Number(
          a.slice(prefix.length),
        );

        const bIndex = Number(
          b.slice(prefix.length),
        );

        return aIndex - bIndex;
      })
      .map(([, value]) => value);

  result.push(...multiple);

  return [...new Set(result)];
};

const selectedComponentsIn = (
  group: RequirementGroup | undefined,
  selections: ComponentSelections,
  details: Record<string, ComponentDetailResponse>,
) =>
  group
    ? flatten([group]).flatMap(
        (candidate) =>
          selectedComponentCodesForGroup(
            candidate,
            selections,
          ).flatMap((code) =>
            details[code]
              ? [details[code]]
              : [],
          ),
      )
    : [];

const selectableRequirementGroups = (
  group: RequirementGroup | undefined,
): RequirementGroup[] => {
  if (!group) return [];

  return flatten([group]).filter(
    (candidate) =>
      (candidate.logic === "ANY" ||
        candidate.logic === "ONE_OF") &&
      candidate.items.some(
        (item) => item.subject || item.component,
      ),
  );
};

const selectableSubjectGroup = (
  group: RequirementGroup | undefined,
): RequirementGroup | undefined =>
  selectableRequirementGroups(group).find(
    (candidate) =>
      candidate.items.some((item) => item.subject),
  );


/**
 * Returns every subject code already present in the personalised roadmap,
 * including official UTS subjects and user-selected subjects.
 *
 * This is intentionally code-based because an official study plan can
 * already contain a subject that satisfies an ANY/ONE_OF handbook group.
 * Example: Mechanical and Mechatronic Engineering already recommends
 * 41301 for one 6 CP Options group.
 */
const plannedSubjectCodes = (
  planner: PlannerState | null | undefined,
): Set<string> =>
  new Set(
    [
      ...(planner?.years.flatMap((year) =>
        year.periods.flatMap((period) => period.items),
      ) ?? []),
      ...(planner?.unassignedItems ?? []),
    ].flatMap((item) =>
      item.subject ? [item.subject.code] : [],
    ),
  );

/**
 * Counts only direct subject candidates from one formal requirement group.
 *
 * A subject code is counted once inside the group. This is used for scope
 * resolution only, so an official recommended option can satisfy its group
 * without needing generated provenance.
 */
const plannedPointsInSubjectGroup = (
  group: RequirementGroup,
  plannedCodes: ReadonlySet<string>,
): number => {
  const seen = new Set<string>();

  return group.items.reduce((total, item) => {
    const subject = item.subject;
    const code = subject?.code ?? item.rawCode ?? undefined;

    if (
      item.itemType !== "SUBJECT" ||
      !code ||
      seen.has(code) ||
      !plannedCodes.has(code)
    ) {
      return total;
    }

    seen.add(code);

    return (
      total +
      (subject?.creditPoints ??
        item.creditPoints ??
        0)
    );
  }, 0);
};

const subjectGroupSatisfied = (
  group: RequirementGroup,
  plannedCodes: ReadonlySet<string>,
): boolean => {
  const required = group.requiredCreditPoints;

  if (required === null) {
    return false;
  }

  return (
    plannedPointsInSubjectGroup(
      group,
      plannedCodes,
    ) >= required
  );
};

const selectableSubjectGroups = (
  groups: RequirementGroup[],
): RequirementGroup[] =>
  flatten(groups).filter(
    (group) =>
      (group.logic === "ANY" ||
        group.logic === "ONE_OF") &&
      group.items.some((item) => item.subject),
  );

const componentScope = (
  detail: ComponentDetailResponse,
  preferredGroupId?: string,
): ChoiceScope => {
  const exact =
    preferredGroupId
      ? flatten(detail.requirements).find(
          (group) =>
            group.id === preferredGroupId,
        )
      : undefined;

  if (
    preferredGroupId &&
    !exact
  ) {
    return {
      kind: "UNRESOLVED",
      label:
        "The mapped component requirement is unavailable.",
    };
  }

  const selectableGroups =
    flatten(
      detail.requirements,
    ).filter(
      (group) =>
        (group.logic === "ANY" ||
          group.logic === "ONE_OF") &&
        flatten([group]).some(
          (candidate) =>
            candidate.items.some(
              (item) => item.subject,
            ),
        ),
    );

  return {
    kind: "FORMAL",

    label:
      detail.component.name,

    componentCode:
      detail.component.code,

    componentId:
      detail.component.id,

    requirementGroupId:
      preferredGroupId,

    groups:
      exact
        ? [exact]
        : detail.requirements,

    selectableGroupIds:
      preferredGroupId
        ? [preferredGroupId]
        : selectableGroups.map(
            (group) => group.id,
          ),
  };
};

export const resolveStudyPathChoiceScope = (
  choice: StudyPlanItem | null,
  degreeRequirements: RequirementGroup[],
  details: Record<string, ComponentDetailResponse>,
  selections: ComponentSelections,
  planner?: PlannerState | null,
): ChoiceScope => {
  if (!choice) {
    return {
      kind: "UNRESOLVED",
    };
  }

  const origin =
    choice.choiceOrigin;

  /*
   * Strongest mapping:
   * roadmapSlots already assigned this position to
   * a selected component / stream.
   */
  if (
    origin?.formalComponentCode &&
    details[origin.formalComponentCode]
  ) {
    return componentScope(
      details[origin.formalComponentCode],

      origin.componentRequirementKind ===
        "COMPONENT"
        ? undefined
        : origin.formalRequirementGroupId,
    );
  }

  if (
    origin?.candidateSourceType ===
    "BROAD"
  ) {
    const group =
      flatten(
        degreeRequirements,
      ).find(
        (candidate) =>
          candidate.id ===
          origin.formalRequirementGroupId,
      );

    const mapped =
      group &&
      flatten([group]).some(
        (candidate) =>
          candidate.items.some(
            (item) =>
              item.itemType ===
                "SUBJECT" ||
              item.component,
          ),
      );

    return {
      kind:
        mapped
          ? "FORMAL"
          : "BROAD",

      label:
        origin.sourceLabel,

      requirementGroupId:
        group?.id,

      groups:
        group
          ? [group]
          : undefined,

      selectableGroupIds:
        group
          ? [group.id]
          : undefined,
    };
  }

  if (
    origin?.formalRequirementGroupId
  ) {
    const group = [
      ...flatten(
        degreeRequirements,
      ),

      ...Object.values(
        details,
      ).flatMap((detail) =>
        flatten(
          detail.requirements,
        ),
      ),
    ].find(
      (candidate) =>
        candidate.id ===
        origin.formalRequirementGroupId,
    );

    return {
      kind: "FORMAL",

      requirementGroupId:
        origin.formalRequirementGroupId,

      label:
        group?.title ??
        "Mapped handbook requirement",

      groups:
        group
          ? [group]
          : undefined,

      selectableGroupIds: [
        origin.formalRequirementGroupId,
      ],
    };
  }

  const codes = new Set([
    ...handbookCodes(
      origin?.rawCode ??
      choice.rawCode,
    ),

    ...handbookCodes(
      origin?.title ??
      choice.title,
    ),
  ]);

  if (codes.size) {
    const selectedCodes =
      new Set(
        Object.values(
          selections,
        ),
      );

    const componentMatches =
      Object.values(details)
        .filter((detail) =>
          selectedCodes.has(
            detail.component.code,
          ),
        )
        .flatMap((detail) =>
          flatten(
            detail.requirements,
          )
            .filter((group) =>
              [
                ...requirementCodes(
                  group,
                ),
              ].some((code) =>
                codes.has(code),
              ),
            )
            .map((group) => ({
              detail,
              group,
            })),
        );

    if (
      componentMatches.length === 1
    ) {
      return componentScope(
        componentMatches[0].detail,
        componentMatches[0].group.id,
      );
    }

    const degreeMatches =
      flatten(
        degreeRequirements,
      ).filter((group) =>
        [
          ...requirementCodes(
            group,
          ),
        ].some((code) =>
          codes.has(code),
        ),
      );

    if (
      degreeMatches.length === 1 &&
      degreeMatches[0]
        .pathways.length === 0
    ) {
      return {
        kind: "FORMAL",

        label:
          degreeMatches[0].title ??
          "Mapped requirement",

        requirementGroupId:
          degreeMatches[0].id,

        groups:
          degreeMatches,

        selectableGroupIds: [
          degreeMatches[0].id,
        ],
      };
    }

    if (
      componentMatches.length > 1 ||
      degreeMatches.length > 0
    ) {
      return {
        kind: "UNRESOLVED",

        label:
          "Choose the pathway and component for this requirement.",
      };
    }
  }

  const explicitGroup =
    degreeRequirements.find(
      (group) =>
        group.pathways.length > 0,
    );

  const selectedPathwayValue =
    explicitGroup
      ? selections[
          explicitGroup.id
        ]
      : undefined;

  const selectedPathway =
    selectedPathwayValue?.startsWith(
      "PATHWAY:",
    )
      ? explicitGroup?.pathways.find(
          (pathway) =>
            pathway.id ===
            selectedPathwayValue.slice(
              8,
            ),
        )
      : undefined;

  if (
    explicitGroup &&
    selectedPathway &&
    planner
  ) {
    const roadmapChoices =
      planner.years
        .flatMap((year) =>
          year.periods.flatMap(
            (period) =>
              period.items,
          ),
        )
        .filter(
          (item) =>
            item.choiceOrigin &&
            !/\b(internship|placement|practicum|professional experience)\b/i.test(
              item.title,
            ),
        );

    const choiceIndex =
      roadmapChoices.findIndex(
        (item) =>
          item.plannerItemId ===
          choice.id,
      );

    if (
      choiceIndex >= 0
    ) {
      const startPoint =
        roadmapChoices
          .slice(
            0,
            choiceIndex,
          )
          .reduce(
            (total, item) =>
              total +
              (item.creditPoints ??
                0),
            0,
          );

      let allocationEnd = 0;

      for (const selection of selectedPathway.selections) {
        const allocationPoints =
          selection.requiredCreditPoints /
          Math.max(
            1,
            selection.requiredSelections,
          );

        for (
          let index = 0;
          index <
          selection.requiredSelections;
          index += 1
        ) {
          allocationEnd +=
            allocationPoints;

          if (
            startPoint >=
            allocationEnd
          ) {
            continue;
          }

          const group =
            flatten(
              degreeRequirements,
            ).find(
              (candidate) =>
                candidate.id ===
                selection.requirementGroupId,
            );

          if (
            selection.selectionType ===
            "ELECTIVE_ALLOCATION"
          ) {
            return {
              kind: "BROAD",

              label:
                group?.title ??
                "Electives",

              requirementGroupId:
                group?.id,

              groups:
                group
                  ? [group]
                  : undefined,

              selectableGroupIds:
                group
                  ? [group.id]
                  : undefined,
            };
          }

          const componentCode =
            selections[
              `${selectedPathway.id}:selection:${selection.requirementGroupId}:${index}`
            ];

          if (
            componentCode &&
            details[componentCode]
          ) {
            return componentScope(
              details[
                componentCode
              ],
            );
          }

          return {
            kind:
              "UNRESOLVED",
          };
        }
      }
    }
  }

  const rawComponentCode = (
    origin?.rawCode ??
    choice.rawCode
  )
    ?.trim()
    .toUpperCase();

  if (
    rawComponentCode &&
    details[
      rawComponentCode
    ]
  ) {
    return componentScope(
      details[
        rawComponentCode
      ],
    );
  }

  const slotName =
    normalized(
      origin?.title ??
      choice.title,
    );

  const allDegreeGroups =
    flatten(
      degreeRequirements,
    );

  const majorGroup =
    allDegreeGroups.find(
      (group) =>
        components(
          group,
        ).some(
          (component) =>
            component.type ===
            "MAJOR",
        ),
    );

  const majorCode =
    majorGroup
      ? selections[
          majorGroup.id
        ]
      : undefined;

  const majorDetail =
    majorCode
      ? details[
          majorCode
        ]
      : undefined;

  const majorOptions =
    majorDetail?.requirements.find(
      (group) =>
        (group.logic === "ANY" ||
          group.logic === "ONE_OF") &&
        (
          group.children.length > 1 ||
          group.items.some(
            (item) =>
              item.component,
          ) ||
          group.items.some(
            (item) =>
              item.subject,
          )
        ),
    );

  const majorOption =
    majorOptions
      ? majorOptions.children.length
        ? selectedChild(
            majorOptions,
            selections,
          )
        : majorOptions
      : undefined;

  const majorSubjectOption =
    selectableSubjectGroup(majorOption);

  const majorNested =
    selectedComponentsIn(
      majorOption,
      selections,
      details,
    );

  const separatePath =
    degreeRequirements.find(
      (group) =>
        group.children.length > 1 &&
        !components(
          group,
        ).some(
          (component) =>
            component.type ===
            "MAJOR",
        ),
    );

  const separateSelection =
    separatePath
      ? selectedChild(
          separatePath,
          selections,
        )
      : undefined;

  const separateSelectableOptions =
    selectableRequirementGroups(separateSelection);

  const plannedCodes =
    plannedSubjectCodes(planner);

  /*
   * Some official UTS plans already contain a recommended subject from a
   * selectable handbook pool. Those groups are already satisfied and must
   * not steal an unrelated empty CHOICE slot.
   *
   * Mechanical and Mechatronic Engineering is the important example:
   * - specialist Options 1 is already represented by 41068 in the official plan
   * - specialist Options 2 is already represented by 41067 in the official plan
   * - the three "Mechanical and Mechatronic Engineering Option" slots belong
   *   to the major's separate 18 CP Options group, not to the specialist stream
   */
  const unsatisfiedSpecialistSubjectOptions =
    separateSelectableOptions.filter(
      (group) =>
        group.items.some((item) => item.subject) &&
        !subjectGroupSatisfied(
          group,
          plannedCodes,
        ),
    );

  const majorSelectableSubjectOptions =
    majorDetail
      ? selectableSubjectGroups(
          majorDetail.requirements,
        )
      : [];

  const unsatisfiedMajorSubjectOptions =
    majorSelectableSubjectOptions.filter(
      (group) =>
        !subjectGroupSatisfied(
          group,
          plannedCodes,
        ),
    );

  const separateIsSpecialistStream =
    /specialist stream/.test(
      normalized(separateSelection?.title ?? ""),
    );

  const specialistBaseName =
    normalized(
      (separateSelection?.title ?? "").replace(
        /\s+specialist stream$/i,
        "",
      ),
    );

  const slotMatchesSpecialist =
    Boolean(specialistBaseName) &&
    slotName.includes(specialistBaseName);

  /*
   * Exact aligned-specialist ownership must win over a selected nested
   * major component. This prevents a combined-major slot such as
   * "Electrical and Electronic Engineering Option" from being claimed by
   * the selected internal Electrical stream (for example Control Studios).
   */
  const isAlignedSpecialistSlot =
    separateIsSpecialistStream &&
    slotMatchesSpecialist;

  const separateNested =
    selectedComponentsIn(
      separateSelection,
      selections,
      details,
    );

  if (
    /free elective/.test(
      slotName,
    )
  ) {
    if (
      /sub major|submajor/.test(
        slotName,
      ) &&
      separateNested.length >
        0
    ) {
      return componentScope(
        separateNested.at(-1)!,
      );
    }

    const freeGroup =
      separateSelection &&
      flatten([
        separateSelection,
      ]).find((group) =>
        /free elective/.test(
          normalized(
            group.title ??
            "",
          ),
        ),
      );

    return {
      kind: "BROAD",

      label:
        freeGroup?.title ??
        "Free Elective",

      requirementGroupId:
        freeGroup?.id,

      groups:
        freeGroup
          ? [freeGroup]
          : undefined,

      selectableGroupIds:
        freeGroup
          ? [freeGroup.id]
          : undefined,
    };
  }

  if (
    /transdisciplinary/.test(
      slotName,
    ) &&
    separateSelection
  ) {
    const group =
      flatten([
        separateSelection,
      ]).find((candidate) =>
        /transdisciplinary/.test(
          normalized(
            candidate.title ??
            "",
          ),
        ),
      );

    if (group) {
      return {
        kind: "FORMAL",

        label:
          group.title ??
          "Transdisciplinary Elective",

        requirementGroupId:
          group.id,

        groups: [group],

        selectableGroupIds: [
          group.id,
        ],
      };
    }
  }

  /*
   * The user's explicitly selected branch/component inside Major Options
   * owns the major option slots before any generic subject-pool fallback.
   *
   * This is critical for majors such as Civil Engineering and Software
   * Engineering:
   *
   *   Major Options -> Sub-Majors -> Construction
   *
   * Once Construction is selected, a generic "Civil Engineering Option"
   * position must resolve to Construction, not back to the default Civil
   * Engineering Options pool.
   *
   * Likewise, when Software Engineering switches from Technical Subjects
   * to a selected sub-major, "Software Engineering Option" positions must
   * resolve to that selected sub-major.
   *
   * Keep the length === 1 guard. Electrical Engineering can select two
   * streams, and those positions are mapped earlier by roadmap provenance;
   * guessing between two selected components here would be unsafe.
   */
  if (
    majorNested.length === 1 &&
    isOptionSlot(slotName) &&
    !isAlignedSpecialistSlot
  ) {
    return componentScope(
      majorNested[0],
    );
  }

  /*
   * A generic "<combined major> Option" slot belongs to the aligned
   * specialist stream only when there is exactly one still-unsatisfied
   * subject option pool in that specialist stream.
   *
   * This is true for Electrical and Electronic Engineering:
   *   specialist Core = already fixed in the official plan
   *   specialist Options = one unsatisfied 6 CP subject pool
   *
   * It is deliberately NOT true for Mechanical and Mechatronic Engineering.
   * Its specialist Options 1/2 are already represented by recommended
   * official subjects, while its generic major option slots belong to the
   * major's own 18 CP Options group.
   *
   * Transdisciplinary is resolved by the explicit block above because its
   * official slot is named "Transdisciplinary Elective".
   */
  if (
    separateIsSpecialistStream &&
    slotMatchesSpecialist &&
    isOptionSlot(slotName) &&
    unsatisfiedSpecialistSubjectOptions.length === 1
  ) {
    const group =
      unsatisfiedSpecialistSubjectOptions[0];

    return {
      kind: "FORMAL",
      label:
        separateSelection?.title ??
        group.title ??
        "Specialist stream",
      requirementGroupId: group.id,
      groups: [group],
      selectableGroupIds: [group.id],
    };
  }

  /*
   * Subject-based major Options can be nested under top-level ALL groups.
   * Do not require the top-level requirement itself to be ANY/ONE_OF.
   *
   * We also subtract option pools already satisfied by subjects that UTS
   * placed directly in the recommended study plan. This makes the remaining
   * empty roadmap slots map to the correct formal group.
   *
   * Mechanical and Mechatronic Engineering:
   * - 6 CP major Options already satisfied by official 41301
   * - 18 CP major Options still unsatisfied
   * - three 6 CP roadmap option slots therefore map to that 18 CP group
   */
  if (
    majorDetail &&
    isOptionSlot(slotName) &&
    slotName.includes(
      normalized(
        majorDetail.component.name,
      ),
    ) &&
    unsatisfiedMajorSubjectOptions.length === 1
  ) {
    const group =
      unsatisfiedMajorSubjectOptions[0];

    return {
      kind: "FORMAL",
      label:
        majorDetail.component.name,
      componentCode:
        majorDetail.component.code,
      componentId:
        majorDetail.component.id,
      requirementGroupId: group.id,
      groups: [group],
      selectableGroupIds: [group.id],
    };
  }

  /*
   * A major option can be nested below a selected branch.
   * Civil Engineering is an example: the selected "Civil Engineering"
   * branch contains Core + Options, and the subjects live in the nested
   * Options group rather than directly on the branch.
   */
  if (
    majorSubjectOption &&
    isOptionSlot(slotName)
  ) {
    return {
      kind: "FORMAL",
      label:
        majorDetail?.component.name ??
        majorSubjectOption.title ??
        "Selected major",
      componentCode: majorDetail?.component.code,
      componentId: majorDetail?.component.id,
      requirementGroupId: majorSubjectOption.id,
      groups: [majorSubjectOption],
      selectableGroupIds: [majorSubjectOption.id],
    };
  }

  if (
    separateNested.length > 0 &&
    /elective|specialist|sub major|submajor|industry/.test(
      slotName,
    )
  ) {
    return componentScope(
      separateNested.at(-1)!,
    );
  }

  const selectedDetails = [
    ...majorNested,
    ...separateNested,
  ];

  const named =
    selectedDetails.find(
      (detail) =>
        slotName.includes(
          normalized(
            detail.component.name,
          ),
        ),
    );

  if (named) {
    return componentScope(
      named,
    );
  }

  if (
    origin?.candidateSourceType ===
    "UNRESOLVED"
  ) {
    return {
      kind: "UNRESOLVED",
      label:
        origin.sourceLabel,
    };
  }

  return {
    kind: "UNRESOLVED",
  };
};
