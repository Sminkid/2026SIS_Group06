import assert from "node:assert/strict";
import test from "node:test";
import type { RequirementGroup, RequirementItem } from "../types/handbook";
import { collectRequirementPoolContexts, getSubjectSelectionAction } from "./subjectChoiceEligibility";

const subjectItem = (code: string): RequirementItem => ({
  id: `item-${code}`,
  itemType: "SUBJECT",
  subject: { id: `subject-${code}`, code, name: `Subject ${code}`, creditPoints: 6 },
  component: null,
  rawCode: code,
  rawName: null,
  creditPoints: 6,
  sortOrder: 0,
});

const group = (
  id: string,
  logic: RequirementGroup["logic"],
  items: RequirementItem[] = [],
  children: RequirementGroup[] = [],
): RequirementGroup => ({
  id,
  title: id,
  description: null,
  logic,
  requiredCreditPoints: logic === "ALL" ? 6 : 12,
  maximumCreditPoints: null,
  sortOrder: 0,
  items,
  children,
  pathways: [],
});

test("nested subject pools inherit formal selectability from a selective ancestor", () => {
  const nestedContext = group("context", "ALL", [subjectItem("A"), subjectItem("B")]);
  const options = group("formal-options", "ANY", [], [nestedContext]);
  const pools = collectRequirementPoolContexts([options], new Set([options.id]));

  assert.equal(pools.length, 1);
  assert.equal(pools[0]?.selectable, true);
  assert.equal(pools[0]?.quotaGroup.id, options.id);
  for (const item of pools[0]?.group.items ?? []) {
    assert.ok(item.subject);
    const action = getSubjectSelectionAction({
      belongsToResolvedScope: pools[0]!.selectable,
      duplicate: false,
      maximumCreditPoints: 12,
      selectedCreditPoints: 0,
      currentCreditPoints: 0,
      candidateCreditPoints: item.subject.creditPoints ?? 0,
      replacingCurrent: false,
    });
    assert.deepEqual(action, { visible: true, disabled: false, label: "Select" });
  }
});

test("access warnings do not participate in the selection action decision", () => {
  const actionWithPrerequisiteWarning = getSubjectSelectionAction({
    belongsToResolvedScope: true,
    duplicate: false,
    maximumCreditPoints: 12,
    selectedCreditPoints: 0,
    currentCreditPoints: 0,
    candidateCreditPoints: 6,
    replacingCurrent: false,
  });
  assert.deepEqual(actionWithPrerequisiteWarning, { visible: true, disabled: false, label: "Select" });
});

test("duplicates and CP limits block additions while a replacement remains available", () => {
  const common = {
    belongsToResolvedScope: true,
    maximumCreditPoints: 12,
    selectedCreditPoints: 12,
    candidateCreditPoints: 6,
  };
  assert.equal(getSubjectSelectionAction({ ...common, duplicate: true, currentCreditPoints: 0, replacingCurrent: false }).disabled, true);
  assert.equal(getSubjectSelectionAction({ ...common, duplicate: false, currentCreditPoints: 0, replacingCurrent: false }).disabled, true);
  assert.deepEqual(
    getSubjectSelectionAction({ ...common, duplicate: false, currentCreditPoints: 6, replacingCurrent: true }),
    { visible: true, disabled: false, label: "Replace current option" },
  );
});
