import { appUi } from "./ui";
import type { ComponentSelections } from "../hooks/useComponentSelections";
import type {
  ComponentDetailResponse,
  RequirementGroup,
} from "../types/handbook";
import type { PlannerState } from "../types/planner";
import { readableText } from "../domain/readableText";
import {
  selectedComponentPreview,
  type SelectedComponentPreviewStatus,
} from "../domain/selectedComponentPreview";
import { requiredBranch } from "../domain/studyPathDependencies";
import {
  componentPlacementProgress,
  isRequiredCore,
} from "../domain/componentPlacement";

interface Props {
  universityCode: string;
  degreeName: string;
  requirements: RequirementGroup[];
  componentDetails: Record<string, ComponentDetailResponse>;
  componentDetailsStatus: SelectedComponentPreviewStatus;
  selections: ComponentSelections;
  onSelect: (
    groupId: string,
    value: string,
    clearGroupIds?: string[],
  ) => void;
  planner: PlannerState | null;
}

const flattenGroups = (
  groups: RequirementGroup[],
): RequirementGroup[] =>
  groups.flatMap((group) => [
    group,
    ...flattenGroups(group.children),
  ]);

const formatType = (type: string) =>
  type.toLowerCase().replaceAll("_", " ");

const components = (group: RequirementGroup) =>
  group.items.flatMap((item) =>
    item.component ? [item.component] : [],
  );

/**
 * Returns how many components must be selected from this group.
 *
 * Examples:
 * ONE_OF:
 *   choose 1 component
 *
 * ANY, 24 CP required, every component 12 CP:
 *   choose 2 components
 */
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
      (point): point is null =>
        point === null || point <= 0,
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

  const count = group.requiredCreditPoints / first;

  return count > 0 && count <= options.length
    ? count
    : null;
};

const componentDecision = (
  group: RequirementGroup,
) => componentSelectionCount(group) === 1;

const componentMultiDecision = (
  group: RequirementGroup,
) => {
  const count = componentSelectionCount(group);
  return count !== null && count > 1;
};

const title = (group: RequirementGroup) =>
  group.title?.trim() || "Study-path option";

const selectedGroup = (
  group: RequirementGroup,
  selections: ComponentSelections,
) => {
  const value = selections[group.id];

  return value?.startsWith("GROUP:")
    ? group.children.find(
        (child) => child.id === value.slice(6),
      )
    : undefined;
};

/** Selects one component from the exact choices supplied by its requirement group. */
const ComponentSelect = ({
  group,
  label,
  selections,
  onSelect,
  clearGroupIds = [],
}: {
  group: RequirementGroup;
  label: string;
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  clearGroupIds?: string[];
}) => (
  <label className={appUi.studyPathField}>
    <span>{label}</span>

    <select
      value={selections[group.id] ?? ""}
      onChange={(event) =>
        onSelect(
          group.id,
          event.target.value,
          clearGroupIds,
        )
      }
    >
      <option value="" disabled>
        Select an option
      </option>

      {components(group).map((component) => (
        <option
          value={component.code}
          key={component.id}
        >
          {component.name}
        </option>
      ))}
    </select>
  </label>
);

/**
 * Handles requirements such as:
 *
 * Electrical Engineering Options
 * 24 CP required
 * each stream = 12 CP
 *
 * Therefore the student must choose two streams.
 */
const ComponentMultiSelect = ({
  group,
  selections,
  onSelect,
  componentDetails,
  componentDetailsStatus,
  planned,
  planner,
}: {
  group: RequirementGroup;
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  componentDetails: Record<
    string,
    ComponentDetailResponse
  >;
  componentDetailsStatus: Props["componentDetailsStatus"];
  planned: Map<string, string>;
  planner: PlannerState | null;
}) => {
  const requiredSelections =
    componentSelectionCount(group);

  if (
    requiredSelections === null ||
    requiredSelections <= 1
  ) {
    return null;
  }

  const options = components(group);

  const selectedCodes = Array.from(
    { length: requiredSelections },
    (_, index) =>
      selections[`${group.id}:component:${index}`],
  ).filter(
    (value): value is string => Boolean(value),
  );

  return (
    <section className={appUi.pathwaySelections}>
      <h3>{title(group)}</h3>

      <p>
        Choose {requiredSelections} components to complete{" "}
        {group.requiredCreditPoints} CP.
      </p>

      {Array.from(
        { length: requiredSelections },
        (_, index) => {
          const selectionId =
            `${group.id}:component:${index}`;

          const current =
            selections[selectionId] ?? "";

          const detail = current
            ? componentDetails[current]
            : undefined;

          return (
            <div
              className={appUi.pathwaySelection}
              key={selectionId}
            >
              <label
                className={appUi.studyPathField}
              >
                <span>
                  {components(group)[0]?.type
                    ? `${formatType(
                        components(group)[0].type,
                      )} ${index + 1}`
                    : `Option ${index + 1}`}
                </span>

                <select
                  value={current}
                  onChange={(event) =>
                    onSelect(
                      selectionId,
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Choose a component
                  </option>

                  {options
                    .filter(
                      (option) =>
                        option.code === current ||
                        !selectedCodes.includes(
                          option.code,
                        ),
                    )
                    .map((option) => (
                      <option
                        value={option.code}
                        key={option.id}
                      >
                        {option.name}
                        {option.creditPoints !== null
                          ? ` (${option.creditPoints} CP)`
                          : ""}
                      </option>
                    ))}
                </select>
              </label>

              {current && detail && (
                <SelectedPathwayComponentPreview
                  componentCode={current}
                  componentDetails={
                    componentDetails
                  }
                  status={
                    componentDetailsStatus
                  }
                  selections={selections}
                  onSelect={onSelect}
                  planned={planned}
                  planner={planner}
                />
              )}
            </div>
          );
        },
      )}
    </section>
  );
};

/** Shows required and optional subjects while retaining the selected component context. */
const GroupPreview = ({
  group,
  selections,
  onSelect,
  planned,
  readOnly = false,
}: {
  group: RequirementGroup;
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  planned: Map<string, string>;
  readOnly?: boolean;
}) => {
  const subjectItems = group.items.filter(
    (item) => item.subject,
  );

  const componentItems = components(group);

  const broad =
    group.items.length === 0 &&
    componentItems.length === 0 &&
    group.children.length === 0;

  return (
    <details
      className={appUi.pathPreview}
      open={group.children.length <= 2}
    >
      <summary>
        <span>{title(group)}</span>

        <strong>
          {group.logic === "ALL"
            ? `CORE · Complete all${
                group.requiredCreditPoints !== null
                  ? ` · ${group.requiredCreditPoints} CP`
                  : ""
              }`
            : group.requiredCreditPoints !== null
              ? `OPTIONS · Choose ${group.requiredCreditPoints} CP`
              : group.logic.replace("_", " ")}
        </strong>
      </summary>

      <div className={appUi.pathPreviewBody}>
        {group.description && (
          <p>
            {readableText(group.description)}
          </p>
        )}

        {broad && (
          <p className={appUi.broadRequirement}>
            Broad subject choice. Searched
            subjects are not automatically
            verified to count.
          </p>
        )}

        {!readOnly &&
          componentDecision(group) && (
            <ComponentSelect
              group={group}
              label={
                componentItems[0]?.type
                  .toLowerCase()
                  .replaceAll("_", " ") ??
                title(group)
              }
              selections={selections}
              onSelect={onSelect}
            />
          )}

        {subjectItems.length > 0 && (
          <ul
            className={
              appUi.pathPreviewSubjects
            }
          >
            {subjectItems.map((item) => {
              const subject = item.subject!;
              const isPlanned = planned.has(
                subject.code,
              );
              const creditPoints =
                subject.creditPoints ??
                item.creditPoints;

              return (
                <li key={item.id}>
                  <strong>
                    {group.logic === "ALL"
                      ? isPlanned
                        ? "✓"
                        : "⚠"
                      : isPlanned
                        ? "✓"
                        : ""}{" "}
                    {subject.code}
                  </strong>

                  <span>
                    {subject.name}
                  </span>

                  <small>
                    {isRequiredCore(group)
                      ? `Required Core · ${
                          isPlanned
                            ? "Already placed in roadmap"
                            : "Not yet placed"
                        } · ${
                          creditPoints ??
                          "Unknown"
                        } CP`
                      : isPlanned
                        ? `Already placed in roadmap · ${
                            creditPoints ??
                            "Unknown"
                          } CP`
                        : readOnly
                          ? creditPoints !== null
                            ? `${creditPoints} CP`
                            : "Credit points unavailable"
                          : group.logic === "ALL"
                            ? "Not currently planned"
                            : creditPoints !== null
                              ? `${creditPoints} CP`
                              : "Credit points unavailable"}
                  </small>
                </li>
              );
            })}
          </ul>
        )}

        {group.items
          .filter(
            (item) =>
              item.itemType === "SUBJECT" &&
              !item.subject,
          )
          .map((item) => (
            <p
              key={item.id}
              className={appUi.missingSubject}
            >
              {isRequiredCore(group)
                ? "Required Core: "
                : "Option: "}
              Data unavailable for{" "}
              {item.rawCode ?? "subject"}. This
              requirement cannot currently be
              verified.
            </p>
          ))}

        {group.children.map((child) => (
          <GroupPreview
            group={child}
            selections={selections}
            onSelect={onSelect}
            planned={planned}
            readOnly={readOnly}
            key={child.id}
          />
        ))}
      </div>
    </details>
  );
};

/** Renders a component preview without changing its formal requirement ownership. */
const ComponentPreview = ({
  detail,
  selections,
  onSelect,
  planned,
  readOnly = false,
}: {
  detail?: ComponentDetailResponse;
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  planned: Map<string, string>;
  readOnly?: boolean;
}) =>
  detail ? (
    <div
      className={appUi.selectedPathPreview}
    >
      <div
        className={
          appUi.selectedPathPreviewHeading
        }
      >
        <strong>
          {detail.component.name}
        </strong>

        {detail.component.creditPoints !==
          null && (
          <span>
            {detail.component.creditPoints} CP
          </span>
        )}
      </div>

      {detail.requirements.length === 0 ? (
        <p
          className={
            appUi.selectedPathPreviewEmpty
          }
        >
          No verified component structure is
          available.
        </p>
      ) : (
        detail.requirements.map((group) => (
          <GroupPreview
            group={group}
            selections={selections}
            onSelect={onSelect}
            planned={planned}
            readOnly={readOnly}
            key={group.id}
          />
        ))
      )}
    </div>
  ) : null;

/** Reports completion and placement separately for the selected pathway. */
const SelectedPathwayComponentPreview = ({
  componentCode,
  componentDetails,
  status,
  selections,
  onSelect,
  planned,
  planner,
}: {
  componentCode: string;
  componentDetails: Record<
    string,
    ComponentDetailResponse
  >;
  status: Props["componentDetailsStatus"];
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  planned: Map<string, string>;
  planner: PlannerState | null;
}) => {
  const preview = selectedComponentPreview(
    componentCode,
    componentDetails,
    status,
  );

  if (preview.detail) {
    const progress =
      componentPlacementProgress(
        preview.detail,
        planner,
      );

    const ownPlanned =
      new Map<string, string>();

    planner?.years.forEach((year) =>
      year.periods.forEach((period) =>
        period.items.forEach((item) => {
          if (
            item.subject &&
            item.choiceOrigin
              ?.formalComponentId ===
              preview.detail!.component.id &&
            item.choiceOrigin
              .formalRequirementGroupId
          ) {
            ownPlanned.set(
              item.subject.code,
              `${year.name} ${period.name}`,
            );
          }
        }),
      ),
    );

    return (
      <>
        <p
          className={
            appUi.componentPlacementProgress
          }
        >
          Requirement completion:{" "}
          {progress.points} /{" "}
          {
            preview.detail.component
              .creditPoints
          }{" "}
          CP selected · Roadmap placement:{" "}
          {progress.filled} /{" "}
          {progress.positions} positions filled
          · Required Core remaining:{" "}
          {progress.remainingCore.length} ·{" "}
          {progress.complete
            ? "Component requirements placed"
            : "Component requirements outstanding"}
        </p>

        <ComponentPreview
          detail={preview.detail}
          selections={selections}
          onSelect={onSelect}
          planned={ownPlanned}
          readOnly
        />
      </>
    );
  }

  if (preview.state === "error") {
    return (
      <p
        className={
          appUi.selectedPathPreviewState
        }
        role="alert"
      >
        We couldn’t load this component’s
        structure.
      </p>
    );
  }

  if (preview.state === "empty") {
    return (
      <p
        className={
          appUi.selectedPathPreviewState
        }
        role="status"
      >
        No verified component structure is
        available.
      </p>
    );
  }

  return (
    <p
      className={
        appUi.selectedPathPreviewState
      }
      role="status"
    >
      Loading component structure…
    </p>
  );
};

const pathwayLabel = (
  titleValue: string,
) =>
  titleValue
    .replace(
      /^One second major$/i,
      "Second major",
    )
    .replace(
      /^One sub-major plus electives$/i,
      "Sub-major + electives",
    );

/** Renders explicit pathway allocations without conflating component ownership with roadmap position. */
const ExplicitPathwaySelector = ({
  group,
  selections,
  onSelect,
  planner,
  componentDetails,
  componentDetailsStatus,
  planned,
}: {
  group: RequirementGroup;
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  planner: PlannerState | null;
  componentDetails: Record<
    string,
    ComponentDetailResponse
  >;
  componentDetailsStatus: Props["componentDetailsStatus"];
  planned: Map<string, string>;
}) => {
  const selectedValue =
    selections[group.id];

  const pathway =
    selectedValue?.startsWith("PATHWAY:")
      ? group.pathways.find(
          (candidate) =>
            candidate.id ===
            selectedValue.slice(8),
        )
      : undefined;

  const allSlotIds =
    group.pathways.flatMap((candidate) =>
      candidate.selections.flatMap(
        (selection) =>
          Array.from(
            {
              length:
                selection.requiredSelections,
            },
            (_, index) =>
              `${candidate.id}:selection:${selection.requirementGroupId}:${index}`,
          ),
      ),
    );

  const choosePathway = (
    value: string,
  ) => {
    const hasDependentSelections =
      planner &&
      [
        ...planner.years.flatMap((year) =>
          year.periods.flatMap(
            (period) => period.items,
          ),
        ),
        ...planner.unassignedItems,
      ].some(
        (item) =>
          item.subject &&
          item.choiceOrigin
            ?.componentRequirementKind !==
            "FIXED" &&
          group.pathways.some(
            (candidate) =>
              candidate.id ===
              item.choiceOrigin
                ?.selectedPathwayId,
          ),
      );

    if (
      hasDependentSelections &&
      !window.confirm(
        "Changing pathway will clear its selected components and related personalised roadmap choices. Continue?",
      )
    ) {
      return;
    }

    onSelect(
      group.id,
      value,
      allSlotIds,
    );
  };

  const selectedInPathway =
    pathway?.selections.flatMap(
      (selection) =>
        Array.from(
          {
            length:
              selection.requiredSelections,
          },
          (_, index) =>
            selections[
              `${pathway.id}:selection:${selection.requirementGroupId}:${index}`
            ],
        ).filter(
          (value): value is string =>
            Boolean(value),
        ),
    ) ?? [];

  const chosenElectivePoints = planner
    ? [
        ...planner.years.flatMap((year) =>
          year.periods.flatMap(
            (period) => period.items,
          ),
        ),
        ...planner.unassignedItems,
      ].reduce(
        (total, item) =>
          item.subject &&
          item.choiceOrigin
            ?.formalRequirementGroupId &&
          pathway?.selections.some(
            (selection) =>
              selection.selectionType ===
                "ELECTIVE_ALLOCATION" &&
              selection.requirementGroupId ===
                item.choiceOrigin
                  ?.formalRequirementGroupId,
          )
            ? total +
              (item.subject.creditPoints ??
                item.creditPoints ??
                0)
            : total,
        0,
      )
    : 0;

  return (
    <section
      className={appUi.pathDecision}
    >
      <label
        className={appUi.studyPathField}
      >
        <span>
          Choose one{" "}
          {group.requiredCreditPoints ??
            group.pathways[0]
              ?.requiredCreditPoints ??
            ""}{" "}
          CP pathway
        </span>

        <select
          value={selectedValue ?? ""}
          onChange={(event) =>
            choosePathway(
              event.target.value,
            )
          }
        >
          <option value="" disabled>
            Choose a pathway
          </option>

          {group.pathways.map(
            (candidate) => (
              <option
                value={`PATHWAY:${candidate.id}`}
                key={candidate.id}
              >
                {pathwayLabel(
                  candidate.title,
                )}
              </option>
            ),
          )}
        </select>
      </label>

      {pathway && (
        <div
          className={
            appUi.pathwaySelections
          }
        >
          <h3>
            {pathwayLabel(pathway.title)}
          </h3>

          {pathway.selections.flatMap(
            (selection) => {
              const sourceGroup =
                group.children.find(
                  (child) =>
                    child.id ===
                    selection.requirementGroupId,
                );

              if (
                selection.selectionType ===
                "ELECTIVE_ALLOCATION"
              ) {
                const remaining =
                  Math.max(
                    0,
                    selection.requiredCreditPoints -
                      chosenElectivePoints,
                  );

                return (
                  <section
                    className={
                      appUi.electiveAllocation
                    }
                    key={
                      selection.requirementGroupId
                    }
                  >
                    <strong>
                      {
                        selection.requiredCreditPoints
                      }{" "}
                      CP electives
                    </strong>

                    <p>
                      {remaining} CP remaining.
                      Use the personalised
                      roadmap subject search to
                      add eligible subjects.
                      Search results are marked
                      as eligibility not verified
                      when the database cannot
                      confirm they count.
                    </p>
                  </section>
                );
              }

              if (!sourceGroup) {
                return [];
              }

              const options =
                components(sourceGroup);

              return Array.from(
                {
                  length:
                    selection.requiredSelections,
                },
                (_, index) => {
                  const slotId =
                    `${pathway.id}:selection:${selection.requirementGroupId}:${index}`;

                  const current =
                    selections[slotId] ?? "";

                  const changeSelection = (
                    value: string,
                  ) => {
                    const dependent =
                      planner &&
                      [
                        ...planner.years.flatMap(
                          (year) =>
                            year.periods.flatMap(
                              (period) =>
                                period.items,
                            ),
                        ),
                        ...planner.unassignedItems,
                      ].some(
                        (item) =>
                          item.subject &&
                          item.choiceOrigin
                            ?.formalComponentCode ===
                            current &&
                          item.choiceOrigin
                            .componentRequirementKind !==
                            "FIXED",
                      );

                    if (
                      dependent &&
                      current !== value &&
                      !window.confirm(
                        "Changing this selection will remove related subjects from the personalised roadmap. Continue?",
                      )
                    ) {
                      return;
                    }

                    onSelect(
                      slotId,
                      value,
                    );
                  };

                  return (
                    <div
                      className={
                        appUi.pathwaySelection
                      }
                      key={slotId}
                    >
                      <label
                        className={
                          appUi.studyPathField
                        }
                      >
                        <span>
                          {selection.requiredSelections >
                          1
                            ? `Sub-major ${index + 1}`
                            : formatType(
                                options[0]
                                  ?.type ??
                                  "component",
                              )}
                        </span>

                        <select
                          value={current}
                          onChange={(event) =>
                            changeSelection(
                              event.target
                                .value,
                            )
                          }
                        >
                          <option value="">
                            Choose a component
                          </option>

                          {options
                            .filter(
                              (option) =>
                                option.code ===
                                  current ||
                                !selectedInPathway.includes(
                                  option.code,
                                ),
                            )
                            .map(
                              (option) => (
                                <option
                                  value={
                                    option.code
                                  }
                                  key={
                                    option.id
                                  }
                                >
                                  {
                                    option.name
                                  }
                                </option>
                              ),
                            )}
                        </select>
                      </label>

                      {current && (
                        <SelectedPathwayComponentPreview
                          componentCode={
                            current
                          }
                          componentDetails={
                            componentDetails
                          }
                          status={
                            componentDetailsStatus
                          }
                          selections={
                            selections
                          }
                          onSelect={
                            onSelect
                          }
                          planned={planned}
                          planner={planner}
                        />
                      )}
                    </div>
                  );
                },
              );
            },
          )}
        </div>
      )}
    </section>
  );
};

/** Coordinates visible pathway choices and previews within the existing selection model. */
export const StudyPathSelector = ({
  universityCode,
  degreeName,
  requirements,
  componentDetails,
  componentDetailsStatus,
  selections,
  onSelect,
  planner,
}: Props) => {
  const planned =
    new Map<string, string>();

  planner?.years.forEach((year) =>
    year.periods.forEach((period) =>
      period.items.forEach((item) => {
        if (
          item.subject &&
          !planned.has(item.subject.code)
        ) {
          planned.set(
            item.subject.code,
            `${year.name} ${period.name}`,
          );
        }
      }),
    ),
  );

  const allDegreeGroups =
    flattenGroups(requirements);

  const majorGroup =
    allDegreeGroups.find((group) =>
      components(group).some(
        (component) =>
          component.type === "MAJOR",
      ),
    );

  const explicitPathwayGroup =
    requirements.find(
      (group) => group.pathways.length > 0,
    );

  if (explicitPathwayGroup) {
    return (
      <section
        className={appUi.studyPathPlanner}
        aria-labelledby="study-path-heading"
      >
        <div>
          <p
            className={appUi.stepLabel}
          >
            Personalise your roadmap
          </p>

          <h2 id="study-path-heading">
            Your study path
          </h2>
        </div>

        <p
          className={
            appUi.studyPathContext
          }
        >
          {universityCode} · {degreeName}
        </p>

        <ExplicitPathwaySelector
          group={explicitPathwayGroup}
          selections={selections}
          onSelect={onSelect}
          planner={planner}
          componentDetails={
            componentDetails
          }
          componentDetailsStatus={
            componentDetailsStatus
          }
          planned={planned}
        />
      </section>
    );
  }

  const majorCode = majorGroup
    ? selections[majorGroup.id]
    : undefined;

  const majorDetail = majorCode
    ? componentDetails[majorCode]
    : undefined;

  const majorOptions =
    majorDetail?.requirements.find(
      (group) =>
        componentSelectionCount(group) !==
          null ||
        (group.children.length > 1 &&
          (group.logic === "ANY" ||
            group.logic === "ONE_OF")),
    );

  const majorOption = majorOptions
    ? majorOptions.children.length
      ? selectedGroup(
          majorOptions,
          selections,
        )
      : majorOptions
    : undefined;

  const nestedComponentGroup =
    majorOption
      ? flattenGroups([majorOption]).find(
          (group) =>
            componentSelectionCount(group) !==
            null,
        )
      : undefined;

  const nestedComponentCode =
    nestedComponentGroup &&
    componentSelectionCount(
      nestedComponentGroup,
    ) === 1
      ? selections[
          nestedComponentGroup.id
        ]
      : undefined;

  const nestedComponentDetail =
    nestedComponentCode
      ? componentDetails[
          nestedComponentCode
        ]
      : undefined;

  const separatePath =
    requirements.find(
      (group) =>
        group.children.length > 1 &&
        !components(group).some(
          (component) =>
            component.type === "MAJOR",
        ),
    );

  const separateSelection =
    separatePath
      ? selectedGroup(
          separatePath,
          selections,
        )
      : undefined;

  const mandatedBranch =
    separatePath &&
    universityCode === "UTS"
      ? requiredBranch(
          separatePath,
          selections,
          requirements,
        )
      : undefined;

  const requiresMajor =
    !majorCode &&
    /must complete the aligned/i.test(
      separatePath?.description ?? "",
    );

  const chooseSeparatePath = (
    value: string,
  ) => {
    if (
      !separatePath ||
      value === selections[separatePath.id]
    ) {
      return;
    }

    const oldGroups = new Set(
      separateSelection
        ? flattenGroups([
            separateSelection,
          ]).map((group) => group.id)
        : [],
    );

    const hasDependentSubjects =
      planner?.years.some((year) =>
        year.periods.some((period) =>
          period.items.some(
            (item) =>
              item.subject &&
              item.choiceOrigin
                ?.formalRequirementGroupId &&
              oldGroups.has(
                item.choiceOrigin
                  .formalRequirementGroupId,
              ),
          ),
        ),
      );

    if (
      hasDependentSubjects &&
      !window.confirm(
        "Changing this pathway will clear its related subject selections. Continue?",
      )
    ) {
      return;
    }

    onSelect(
      separatePath.id,
      value,
      [...oldGroups],
    );
  };

  const separateComponentDetails =
    separateSelection
      ? flattenGroups([
          separateSelection,
        ]).flatMap((group) => {
          const code =
            selections[group.id];

          return code &&
            !code.startsWith("GROUP:") &&
            componentDetails[code]
            ? [componentDetails[code]]
            : [];
        })
      : [];

  if (!majorGroup && !separatePath) {
    return null;
  }

  return (
    <section
      className={appUi.studyPathPlanner}
      aria-labelledby="study-path-heading"
    >
      <div>
        <p className={appUi.stepLabel}>
          Personalise your roadmap
        </p>

        <h2 id="study-path-heading">
          Your study path
        </h2>
      </div>

      <p
        className={
          appUi.studyPathContext
        }
      >
        {universityCode} · {degreeName}
      </p>

      {majorGroup && (
        <section
          className={appUi.pathDecision}
        >
          <ComponentSelect
            group={majorGroup}
            label="Major"
            selections={selections}
            onSelect={onSelect}
            clearGroupIds={
              majorDetail
                ? flattenGroups(
                    majorDetail.requirements,
                  ).flatMap((group) => [
                    group.id,
                    ...Array.from(
                      {
                        length:
                          componentSelectionCount(
                            group,
                          ) ?? 0,
                      },
                      (_, index) =>
                        `${group.id}:component:${index}`,
                    ),
                  ])
                : []
            }
          />
        </section>
      )}

      {majorOptions && (
        <section
          className={appUi.pathDecision}
        >
          {majorOptions.children.length >
            0 && (
            <label
              className={
                appUi.studyPathField
              }
            >
              <span>Major options</span>

              <select
                value={
                  selections[
                    majorOptions.id
                  ] ?? ""
                }
                onChange={(event) =>
                  onSelect(
                    majorOptions.id,
                    event.target.value,
                    flattenGroups(
                      majorOptions.children,
                    ).map(
                      (group) => group.id,
                    ),
                  )
                }
              >
                <option
                  value=""
                  disabled
                >
                  Select a pathway
                </option>

                {majorOptions.children.map(
                  (child) => (
                    <option
                      value={`GROUP:${child.id}`}
                      key={child.id}
                    >
                      {title(child)}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}

          {majorOption && (
            <div
              className={
                appUi.pathDecisionDetail
              }
            >
              {nestedComponentGroup &&
              componentMultiDecision(
                nestedComponentGroup,
              ) ? (
                <ComponentMultiSelect
                  group={
                    nestedComponentGroup
                  }
                  selections={selections}
                  onSelect={onSelect}
                  componentDetails={
                    componentDetails
                  }
                  componentDetailsStatus={
                    componentDetailsStatus
                  }
                  planned={planned}
                  planner={planner}
                />
              ) : nestedComponentGroup ? (
                <ComponentSelect
                  group={
                    nestedComponentGroup
                  }
                  label={
                    components(
                      nestedComponentGroup,
                    )[0]?.type
                      .toLowerCase()
                      .replaceAll(
                        "_",
                        " ",
                      ) ??
                    title(
                      nestedComponentGroup,
                    )
                  }
                  selections={selections}
                  onSelect={onSelect}
                />
              ) : (
                <GroupPreview
                  group={majorOption}
                  selections={selections}
                  onSelect={onSelect}
                  planned={planned}
                />
              )}

              <ComponentPreview
                detail={
                  nestedComponentDetail
                }
                selections={selections}
                onSelect={onSelect}
                planned={planned}
              />
            </div>
          )}
        </section>
      )}

      {separatePath && (
        <section
          className={appUi.pathDecision}
        >
          {requiresMajor ? (
            <p>
              Choose your major to see its
              required pathway.
            </p>
          ) : mandatedBranch ? (
            <p
              className={
                appUi.requiredPathway
              }
            >
              <strong>
                Required pathway:{" "}
                {title(mandatedBranch)}
              </strong>
              <br />
              The course rule requires this
              pathway for your selected major.
              Other specialist streams are
              unavailable.
            </p>
          ) : (
            <label
              className={
                appUi.studyPathField
              }
            >
              <span>
                {title(separatePath)}
              </span>

              <select
                value={
                  selections[
                    separatePath.id
                  ] ?? ""
                }
                onChange={(event) =>
                  chooseSeparatePath(
                    event.target.value,
                  )
                }
              >
                <option
                  value=""
                  disabled
                >
                  Select a pathway
                </option>

                {separatePath.children.map(
                  (child) => (
                    <option
                      value={`GROUP:${child.id}`}
                      key={child.id}
                    >
                      {title(child)}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}

          {separatePath.description && (
            <p
              className={
                appUi.pathCondition
              }
            >
              {readableText(
                separatePath.description,
              )}
            </p>
          )}

          {separateSelection && (
            <div
              className={
                appUi.pathDecisionDetail
              }
            >
              <GroupPreview
                group={separateSelection}
                selections={selections}
                onSelect={onSelect}
                planned={planned}
              />

              {separateComponentDetails.map(
                (detail) => (
                  <ComponentPreview
                    detail={detail}
                    selections={
                      selections
                    }
                    onSelect={onSelect}
                    planned={planned}
                    key={
                      detail.component.code
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
};