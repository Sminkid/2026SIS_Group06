import type {
  ComponentDetailResponse,
  RequirementGroup,
} from "../types/handbook";
import type { PlannerState } from "../types/planner";
import { flattenRequirements } from "./roadmapSlots";
import { plannerItems } from "./plannerSwap";

export const isRequiredCore = (
  group: RequirementGroup,
) =>
  group.logic === "ALL" &&
  group.items.length > 0 &&
  group.items.every(
    (item) => item.itemType === "SUBJECT",
  ) &&
  group.items.reduce(
    (sum, item) =>
      sum +
      (item.subject?.creditPoints ??
        item.creditPoints ??
        0),
    0,
  ) === group.requiredCreditPoints;

/**
 * Reports completion of a selected component without requiring every
 * satisfied requirement to have generated choice-origin provenance.
 *
 * Important UTS behaviour:
 *
 * An official recommended study plan can already contain a subject that
 * satisfies a formal component requirement. For example, a specialist-stream
 * Core subject may already be a normal official SUBJECT in the roadmap.
 *
 * That existing subject must satisfy the requirement, but it must NOT be
 * generated again and its credit points must NOT be counted twice.
 */
export const componentPlacementProgress = (
  detail: ComponentDetailResponse,
  planner: PlannerState | null,
) => {
  const allItems = planner
    ? plannerItems(planner)
    : [];

  /*
   * Positions explicitly owned by this selected component.
   * These are still useful for showing roadmap capacity / user allocations.
   */
  const positions = allItems.filter(
    (item) =>
      item.choiceOrigin?.formalComponentId ===
      detail.component.id,
  );

  const placed = positions.filter(
    (item) => item.subject,
  );

  const groups = flattenRequirements(
    detail.requirements,
  );

  /*
   * One subject code can only contribute once to this component's progress.
   * This prevents overlap between nested/adjacent requirement groups from
   * inflating the component total.
   */
  const creditedSubjectCodes =
    new Set<string>();

  const groupPoints =
    new Map<string, number>();

  const addCredit = (
    groupId: string,
    code: string,
    points: number,
  ) => {
    if (
      points <= 0 ||
      creditedSubjectCodes.has(code)
    ) {
      return;
    }

    creditedSubjectCodes.add(code);

    groupPoints.set(
      groupId,
      (groupPoints.get(groupId) ?? 0) +
        points,
    );
  };

  /*
   * Explicit user/generated ownership wins first.
   *
   * This covers subjects selected into a formal option group and also
   * component-backed groups whose candidate subjects are not listed directly
   * in the parent requirement.
   */
  for (const group of groups) {
    for (const item of placed) {
      if (
        !item.subject ||
        item.choiceOrigin
          ?.formalRequirementGroupId !==
          group.id
      ) {
        continue;
      }

      addCredit(
        group.id,
        item.subject.code,
        item.subject.creditPoints ??
          item.creditPoints ??
          0,
      );
    }
  }

  /*
   * Then recognise ordinary official roadmap subjects that are formal
   * candidates of a requirement group.
   *
   * This is the key distinction between:
   *
   * - "already present in the official UTS study plan"
   * - "generated because the user selected a component"
   *
   * An existing official subject satisfies the requirement without consuming
   * an empty CHOICE position.
   */
  const plannedByCode =
    new Map(
      allItems.flatMap((item) =>
        item.subject
          ? [[item.subject.code, item] as const]
          : [],
      ),
    );

  for (const group of groups) {
    const required =
      group.requiredCreditPoints;

    for (const requirementItem of group.items) {
      if (
        requirementItem.itemType !==
          "SUBJECT"
      ) {
        continue;
      }

      const subject =
        requirementItem.subject;

      const code =
        subject?.code ??
        requirementItem.rawCode ??
        undefined;

      if (
        !code ||
        creditedSubjectCodes.has(code)
      ) {
        continue;
      }

      const planned =
        plannedByCode.get(code);

      if (!planned?.subject) {
        continue;
      }

      /*
       * For selectable pools stop once the formal CP requirement is already
       * satisfied. For Core/ALL groups every listed required subject can still
       * be recognised.
       */
      if (
        group.logic !== "ALL" &&
        required !== null &&
        (groupPoints.get(group.id) ?? 0) >=
          required
      ) {
        break;
      }

      addCredit(
        group.id,
        code,
        subject?.creditPoints ??
          requirementItem.creditPoints ??
          planned.subject.creditPoints ??
          planned.creditPoints ??
          0,
      );
    }
  }

  const requiredCore = groups
    .filter(isRequiredCore)
    .flatMap((group) =>
      group.items.map((item) => {
        const code =
          item.subject?.code ??
          item.rawCode ??
          "Unknown";

        return {
          code,
          name:
            item.subject?.name ??
            item.rawName ??
            "Required subject",
          available: Boolean(item.subject),
          groupId: group.id,

          /*
           * A required Core subject is placed when it already exists anywhere
           * in the current roadmap. It does not need generated provenance.
           */
          placed:
            code !== "Unknown" &&
            plannedByCode.has(code),
        };
      }),
    );

  const remainingCore =
    requiredCore.filter(
      (item) => !item.placed,
    );

  /*
   * Only groups that have a concrete completion target participate here.
   * Parent structural groups with no directly selectable/required items are
   * represented by their children and are not double-counted.
   */
  const completionGroups =
    groups.filter(
      (group) =>
        group.requiredCreditPoints !==
          null &&
        group.items.length > 0,
    );

  const groupsComplete =
    completionGroups.every((group) => {
      const cp =
        groupPoints.get(group.id) ?? 0;

      const required =
        group.requiredCreditPoints!;

      const maximum =
        group.maximumCreditPoints ??
        required;

      if (group.logic === "ALL") {
        const requiredCodes =
          group.items.flatMap((item) => {
            if (
              item.itemType !==
              "SUBJECT"
            ) {
              return [];
            }

            const code =
              item.subject?.code ??
              item.rawCode;

            return code ? [code] : [];
          });

        /*
         * For a pure subject Core/ALL group, every listed required subject
         * must exist. CP alone is not enough if records overlap or are odd.
         */
        if (
          requiredCodes.length > 0 &&
          requiredCodes.length ===
            group.items.length
        ) {
          const everyRequiredSubjectPresent =
            requiredCodes.every((code) =>
              plannedByCode.has(code),
            );

          return (
            everyRequiredSubjectPresent &&
            cp >= required &&
            cp <= maximum
          );
        }
      }

      return (
        cp >= required &&
        cp <= maximum
      );
    });

  /*
   * Sum credited requirement CP once per subject code.
   * This is requirement progress, not raw roadmap CP.
   */
  const points = [
    ...groupPoints.values(),
  ].reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    points,
    positions: positions.length,
    filled: placed.length,
    requiredCore,
    remainingCore,

    complete:
      remainingCore.length === 0 &&
      groupsComplete &&
      points ===
        detail.component.creditPoints,
  };
};
