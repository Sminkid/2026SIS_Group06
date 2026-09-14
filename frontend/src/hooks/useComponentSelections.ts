import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RequirementGroup } from "../types/handbook";
import { reconcileDependentBranches } from "../domain/studyPathDependencies";

export type ComponentSelections = Record<string, string>;

const flattenGroups = (
  groups: RequirementGroup[],
): RequirementGroup[] =>
  groups.flatMap((group) => [
    group,
    ...flattenGroups(group.children),
  ]);

const components = (group: RequirementGroup) =>
  group.items.flatMap((item) =>
    item.component ? [item.component] : [],
  );

/**
 * Returns the number of components required when a requirement
 * is made entirely from component choices.
 *
 * Example:
 * Electrical Engineering Options
 * 24 CP required
 * each stream = 12 CP
 * -> 2 component selections
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

export const revalidateComponentSelections = (
  selections: ComponentSelections,
  requirements: RequirementGroup[],
): ComponentSelections => {
  const validValues = new Map<
    string,
    Set<string>
  >();

  const groups = flattenGroups(requirements);

  const groupsById = new Map(
    groups.map((group) => [
      group.id,
      group,
    ]),
  );

  for (const group of groups) {
    const groupComponents = components(group);

    validValues.set(
      group.id,
      new Set([
        ...groupComponents.map(
          (component) => component.code,
        ),
        ...group.children.map(
          (child) => `GROUP:${child.id}`,
        ),
        ...group.pathways.map(
          (pathway) =>
            `PATHWAY:${pathway.id}`,
        ),
      ]),
    );

    /*
     * Support multi-component requirement groups.
     *
     * Example:
     * Options - Electrical Engineering
     * 24 CP required
     * 5 available streams, each 12 CP
     *
     * Stored as:
     * <groupId>:component:0 = STM...
     * <groupId>:component:1 = STM...
     */
    const requiredComponents =
      componentSelectionCount(group);

    if (
      requiredComponents !== null &&
      requiredComponents > 1
    ) {
      const options = new Set(
        groupComponents.map(
          (component) => component.code,
        ),
      );

      for (
        let index = 0;
        index < requiredComponents;
        index += 1
      ) {
        validValues.set(
          `${group.id}:component:${index}`,
          options,
        );
      }
    }

    for (const pathway of group.pathways.filter(
      (candidate) =>
        selections[group.id] ===
        `PATHWAY:${candidate.id}`,
    )) {
      for (const selection of pathway.selections) {
        const sourceGroup =
          groupsById.get(
            selection.requirementGroupId,
          );

        const options = new Set(
          sourceGroup?.items.flatMap(
            (item) =>
              item.component
                ? [item.component.code]
                : [],
          ) ?? [],
        );

        for (
          let index = 0;
          index <
          selection.requiredSelections;
          index += 1
        ) {
          validValues.set(
            `${pathway.id}:selection:${selection.requirementGroupId}:${index}`,
            options,
          );
        }
      }
    }
  }

  /*
   * Prevent selecting the same component twice within
   * the same pathway or multi-component requirement.
   */
  const seen = new Map<
    string,
    Set<string>
  >();

  const validSelections =
    Object.fromEntries(
      Object.entries(selections).filter(
        ([selectionId, value]) => {
          if (
            !validValues
              .get(selectionId)
              ?.has(value)
          ) {
            return false;
          }

          /*
           * Existing explicit pathway selections.
           */
          if (
            selectionId.includes(
              ":selection:",
            )
          ) {
            const pathway =
              selectionId.split(
                ":selection:",
              )[0];

            const key =
              `PATHWAY:${pathway}`;

            const used =
              seen.get(key) ??
              new Set<string>();

            if (used.has(value)) {
              return false;
            }

            used.add(value);
            seen.set(key, used);

            return true;
          }

          /*
           * Multi-component selections such as:
           * requirementId:component:0
           * requirementId:component:1
           */
          if (
            selectionId.includes(
              ":component:",
            )
          ) {
            const groupId =
              selectionId.split(
                ":component:",
              )[0];

            const key =
              `COMPONENT:${groupId}`;

            const used =
              seen.get(key) ??
              new Set<string>();

            if (used.has(value)) {
              return false;
            }

            used.add(value);
            seen.set(key, used);

            return true;
          }

          return true;
        },
      ),
    );

  return reconcileDependentBranches(
    validSelections,
    requirements,
  );
};

const readSelections = (
  storageKey: string,
): ComponentSelections => {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(storageKey) ??
        "{}",
    );

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter(
        (
          entry,
        ): entry is [string, string] =>
          typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
};

export const useComponentSelections = (
  universityCode: string,
  handbookYear: number,
  degreeCode: string,
  requirements: RequirementGroup[] = [],
) => {
  const storageKey = useMemo(
    () =>
      `degree-planner:components:${universityCode}:${handbookYear}:${degreeCode}`,
    [
      degreeCode,
      handbookYear,
      universityCode,
    ],
  );

  const [selections, setSelections] =
    useState<ComponentSelections>(() =>
      readSelections(storageKey),
    );

  const [
    selectionNotice,
    setSelectionNotice,
  ] = useState(false);

  const activeStorageKey =
    useRef(storageKey);

  const droppedSelection =
    useRef(false);

  useEffect(
    () =>
      setSelections(
        readSelections(storageKey),
      ),
    [storageKey],
  );

  useEffect(() => {
    if (droppedSelection.current) {
      droppedSelection.current = false;
      setSelectionNotice(true);
    }
  }, [selections]);

  useEffect(() => {
    if (
      activeStorageKey.current !==
      storageKey
    ) {
      activeStorageKey.current =
        storageKey;

      return;
    }

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(selections),
      );
    } catch {
      // Storage can be unavailable.
    }
  }, [selections, storageKey]);

  const selectComponent = (
    requirementGroupId: string,
    componentCode: string,
    clearGroupIds: string[] = [],
  ) => {
    setSelectionNotice(false);

    setSelections((current) => {
      const next = {
        ...current,
        [requirementGroupId]:
          componentCode,
      };

      clearGroupIds.forEach(
        (groupId) => {
          if (
            groupId !==
            requirementGroupId
          ) {
            delete next[groupId];
          }
        },
      );

      return universityCode === "UTS"
        ? reconcileDependentBranches(
            next,
            requirements,
          )
        : next;
    });
  };

  const revalidateSelections =
    useCallback(
      (
        requirements: RequirementGroup[],
      ) => {
        setSelections((current) => {
          const next =
            revalidateComponentSelections(
              current,
              requirements,
            );

          const unchanged =
            Object.keys(current).length ===
              Object.keys(next).length &&
            Object.entries(current).every(
              ([key, value]) =>
                next[key] === value,
            );

          if (!unchanged) {
            droppedSelection.current =
              true;
          }

          return unchanged
            ? current
            : next;
        });
      },
      [],
    );

  return {
    selections,
    selectionNotice,
    selectComponent,
    revalidateSelections,
  };
};