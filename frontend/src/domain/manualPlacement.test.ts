import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ComponentDetailResponse, DegreeDetailResponse, StudyPlan } from "../types/handbook";
import { cloneOfficialPlan, plannerToStudyPlan, type PlannerItem, type PlannerContext } from "../types/planner";
import { componentPlacementProgress } from "./componentPlacement";
import { expandRoadmapSlots, flattenRequirements } from "./roadmapSlots";
import { isCustomPosition, plannerItems, proposeSwap } from "./plannerSwap";
import { rebasePlannerSlots } from "../hooks/usePlannerState";
import { collectRequirementPoolContexts } from "./subjectChoiceEligibility";
import { resolveStudyPathChoiceScope } from "./studyPathChoiceScope";
import { requiredBranch, reconcileDependentBranches } from "./studyPathDependencies";
import { offeredPeriodsFrom } from "./subjectOfferings";
import type { SubjectAccessConditions } from "../types/subject";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/handbook-2026.json", import.meta.url), "utf8")) as {
  accounting: DegreeDetailResponse; engineering: DegreeDetailResponse; accountingPlans: StudyPlan[]; details: Record<string, ComponentDetailResponse>;
};
const context: PlannerContext = { universityCode: "UTS", handbookYear: 2026, degreeCode: "C10235", selectedComponentCodes: ["SMJ08138"], activePathwayRequirementGroupIds: [], knownPathwayRequirementGroupIds: [] };
const setup = (code = "SMJ08138") => {
  const group = fixture.accounting.requirements.find(group => group.pathways.length)!;
  const path = group.pathways.find(path => path.id.endsWith("sub-major-and-electives"))!;
  const selection = path.selections.find(selection => selection.selectionType === "COMPONENT")!;
  const selections = { [group.id]: `PATHWAY:${path.id}`, [`${path.id}:selection:${selection.requirementGroupId}:0`]: code };
  const official = expandRoadmapSlots(fixture.accountingPlans[0], "UTS", fixture.accounting.requirements, selections, fixture.details)!;
  const planner = cloneOfficialPlan(official, context);
  const own = plannerItems(planner).filter(item => item.choiceOrigin?.formalComponentCode === code);
  const elective = plannerItems(planner).find(item => item.choiceOrigin?.candidateSourceType === "BROAD")!;
  return { official, planner, own, elective, selections, detail: fixture.details[code] };
};
const place = (item: PlannerItem, code: string, groupId?: string, cp = 6) => {
  item.itemType = "SUBJECT"; item.subject = { officialSubjectId: `id:${code}`, code, name: code, creditPoints: cp };
  item.title = code; item.creditPoints = cp;
  if (groupId) item.choiceOrigin!.formalRequirementGroupId = groupId;
};
const location = (plan: ReturnType<typeof setup>["planner"], code: string) => plan.years.flatMap(year => year.periods).find(period => period.items.some(item => item.subject?.code === code))?.officialPeriodId;
const facts = { accessConditions: {} };
test("every empty component position resolves Core and Options with identical verified pools", () => {
  const { planner, official, own, selections, detail } = setup("SMJ08109");
  assert.equal(own.length, 4); assert.ok(own.every(item => !item.subject));
  const slots = plannerToStudyPlan(planner, official).years.flatMap(year => year.periods.flatMap(period => period.items)).filter(item => item.choiceOrigin?.formalComponentCode === "SMJ08109");
  for (const slot of slots) {
    const scope = resolveStudyPathChoiceScope(slot, fixture.accounting.requirements, fixture.details, selections, planner);
    assert.equal(scope.kind, "FORMAL");
    const pools = collectRequirementPoolContexts(scope.groups!, new Set(scope.selectableGroupIds));
    assert.ok(pools.some(pool => pool.requiredCore && pool.group.items.some(item => item.subject?.code === "21510")));
    assert.ok(pools.some(pool => pool.selectable));
    assert.deepEqual(scope.groups, detail.requirements);
  }
  const progress = componentPlacementProgress(detail, planner);
  assert.equal(progress.points, 0); assert.equal(progress.remainingCore.length, 3);
  assert.equal(progress.remainingCore.find(item => item.code === "21228")?.available, false);
});
test("all Core and formal option CP are required; removing Core restores outstanding status", () => {
  const { planner, own, detail } = setup();
  const core = detail.requirements.find(group => group.title === "Core")!;
  const options = detail.requirements.find(group => group.title === "Options")!;
  core.items.forEach((item, index) => place(own[index], item.subject!.code, core.id));
  assert.equal(componentPlacementProgress(detail, planner).complete, false);
  place(own[3], options.items.find(item => item.subject)!.subject!.code, options.id);
  assert.equal(componentPlacementProgress(detail, planner).complete, true);
  own[0].subject = null; own[0].itemType = "CHOICE";
  assert.equal(componentPlacementProgress(detail, planner).remainingCore.length, 1);
  assert.equal(componentPlacementProgress(detail, planner).points, 18);
  assert.equal(componentPlacementProgress(detail, planner).complete, false);
});
test("cross-requirement swap exchanges schedule while preserving identity, allocations, CP and progress", () => {
  const { planner, own, elective, detail, official } = setup();
  place(own[0], "CORE", detail.requirements[0].id); place(elective, "ELECTIVE");
  const before = structuredClone(planner);
  const progress = componentPlacementProgress(detail, planner);
  const result = proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts);
  assert.deepEqual(result.errors, []);
  assert.equal(location(result.plan, "CORE"), location(before, "ELECTIVE"));
  assert.equal(location(result.plan, "ELECTIVE"), location(before, "CORE"));
  assert.deepEqual(componentPlacementProgress(detail, result.plan), progress);
  for (const old of [own[0], elective]) {
    const moved = plannerItems(result.plan).find(item => item.plannerItemId === old.plannerItemId)!;
    assert.deepEqual(moved.choiceOrigin, old.choiceOrigin); assert.deepEqual(moved.subject, old.subject);
  }
  assert.deepEqual(planner, before, "preview and cancellation must not mutate state");
  const reloaded = rebasePlannerSlots(JSON.parse(JSON.stringify(result.plan)), official, context);
  assert.equal(location(reloaded, "CORE"), location(result.plan, "CORE"));
  assert.equal(location(reloaded, "ELECTIVE"), location(result.plan, "ELECTIVE"));
  assert.equal(new Set(plannerItems(reloaded).map(item => item.schedulePositionId)).size, plannerItems(reloaded).length);
});
test("move to empty position carries empty capacity back and preserves ownership across reload", () => {
  const { planner, own, elective, official } = setup(); place(own[0], "CORE");
  const result = proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts);
  assert.deepEqual(result.errors, []);
  assert.equal(plannerItems(result.plan).filter(item => item.subject?.code === "CORE").length, 1);
  assert.equal(plannerItems(result.plan).find(item => item.plannerItemId === elective.plannerItemId)?.subject, null);
  assert.equal(location(rebasePlannerSlots(result.plan, official, context), "CORE"), location(result.plan, "CORE"));
});
test("fixed official subjects, placements, locks, inseparable items and foreign targets reject swaps", () => {
  const { planner, own, elective } = setup(); place(own[0], "CORE");
  const fixed = plannerItems(planner).find(item => !item.choiceOrigin)!;
  assert.ok(!isCustomPosition(fixed));
  for (const target of [fixed.plannerItemId, "outside-plan", own[0].plannerItemId]) assert.ok(proposeSwap(planner, own[0].plannerItemId, target, facts).errors.length);
  elective.numberOfPeriods = 2;
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts).errors.length);
  elective.numberOfPeriods = null; elective.scheduleLocked = true;
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts).errors.length);
});
test("known offerings, period restrictions and hard session limits block; unknown facts warn", () => {
  const { planner, own, elective } = setup(); place(own[0], "CORE");
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, { ...facts, offeredPeriods: { CORE: ["Never offered"] } }).errors.some(error => error.includes("not offered")));
  own[0].allowedPeriodIds = ["different-period"];
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts).errors.some(error => error.includes("restricted")));
  delete own[0].allowedPeriodIds;
  const period = planner.years.flatMap(year => year.periods).find(period => period.items.includes(elective))!;
  period.maximumCreditPoints = 0;
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts).errors.some(error => error.includes("exceeds")));
  delete period.maximumCreditPoints;
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts).warnings.some(warning => warning.includes("unverified")));
});
test("duplicates remain blocked and cannot be disguised by a schedule swap", () => {
  const { planner, own, elective } = setup(); place(own[0], "DUP"); place(elective, "DUP");
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts).errors.some(error => error.includes("duplicate")));
});
test("different component allocations and unequal CP survive a swap while period workloads change", () => {
  const { planner, own, elective } = setup();
  place(own[0], "SIX", "core-group", 6); place(elective, "TWELVE", "other-group", 12);
  elective.choiceOrigin!.formalComponentId = "other-component";
  const workload = (plan: typeof planner) => plan.years.flatMap(year => year.periods).map(period => period.items.reduce((sum, item) => sum + (item.subject?.creditPoints ?? 0), 0));
  const before = workload(planner);
  const result = proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, facts);
  const after = workload(result.plan);
  assert.deepEqual(result.errors, []);
  assert.notDeepEqual(after, before);
  assert.equal(after.reduce((a, b) => a + b), before.reduce((a, b) => a + b));
  assert.equal(plannerItems(result.plan).find(item => item.subject?.code === "TWELVE")?.choiceOrigin?.formalComponentId, "other-component");
});
test("two electives keep their allocations and a known prohibition blocks a moved subject", () => {
  const { planner } = setup();
  const electives = plannerItems(planner).filter(item => item.choiceOrigin?.candidateSourceType === "BROAD");
  place(electives[0], "ONE"); place(electives[1], "TWO");
  assert.deepEqual(proposeSwap(planner, electives[0].plannerItemId, electives[1].plannerItemId, facts).errors, []);
  const access: SubjectAccessConditions = { subject: { id: "ONE", code: "ONE", name: "ONE" }, hasConditions: true, requisiteGroups: [],
    antiRequisiteGroups: [{ id: "anti", groupType: "ANTI_REQUISITE", rule: "A", sortOrder: 0, items: [{ id: "ref", itemKey: "A", requisiteType: "Anti-requisite", details: "", referencedSubject: { id: "TWO", code: "TWO", name: "TWO" }, referencedComponent: null, referencedDegree: null, rawReferencedCodes: null, sortOrder: 0 }] }] };
  assert.ok(proposeSwap(planner, electives[0].plannerItemId, electives[1].plannerItemId, { accessConditions: { ONE: access } }).errors.length);
});
test("swap revalidates known prerequisite and corequisite timing including unmoved subjects", () => {
  const { planner, own, elective } = setup();
  // Component positions precede elective positions in this official roadmap.
  place(own[0], "PRE"); place(elective, "POST");
  const access: SubjectAccessConditions = { subject: { id: "POST", code: "POST", name: "POST" }, hasConditions: true, antiRequisiteGroups: [],
    requisiteGroups: [{ id: "rule", groupType: "REQUISITE", rule: "A", sortOrder: 0, items: [{ id: "ref", itemKey: "A", requisiteType: "Prerequisite", details: "", referencedSubject: { id: "PRE", code: "PRE", name: "PRE" }, referencedComponent: null, referencedDegree: null, rawReferencedCodes: null, sortOrder: 0 }] }] };
  const result = proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, { accessConditions: { POST: access } });
  assert.ok(result.errors.some(error => /Prerequisite/.test(error)));
  access.requisiteGroups[0].items[0].requisiteType = "Corequisite";
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, { accessConditions: { POST: access } }).errors.some(error => /Corequisite/.test(error)));
  elective.subject = null; elective.itemType = "CHOICE";
  place(own[2], "POST");
  assert.ok(proposeSwap(planner, own[0].plannerItemId, elective.plannerItemId, { accessConditions: { POST: access } }).errors.some(error => error.startsWith("POST:")), "Moving a prerequisite must also revalidate an unmoved dependent subject");
});
test("legacy auto-filled Core is dropped while a manual option survives normalization", () => {
  const { planner, own, official } = setup();
  place(own[0], "AUTO"); own[0].choiceOrigin!.componentRequirementKind = "FIXED";
  place(own[1], "MANUAL"); own[1].choiceOrigin!.componentRequirementKind = "SELECTIVE";
  delete own[1].schedulePositionId;
  const result = rebasePlannerSlots(planner, official, context);
  assert.ok(!plannerItems(result).some(item => item.subject?.code === "AUTO"));
  assert.equal(plannerItems(result).filter(item => item.subject?.code === "MANUAL").length, 1);
});
test("every Engineering major × pathway obeys the imported required-stream rule and remains stable", () => {
  const requirements = fixture.engineering.requirements;
  const major = requirements.find(group => group.items.some(item => item.component?.type === "MAJOR"))!;
  const rule = requirements.find(group => group.description?.includes("aligned 24cp"))!;
  for (const item of major.items) {
    const aligned = rule.children.find(child => child.title?.replace(/ specialist stream$/i, "").toLowerCase() === item.component!.name.toLowerCase());
    const expected = aligned ?? rule.children.find(child => child.description?.includes("CBK90011"))!;
    for (const branch of rule.children) {
      const selected = { [major.id]: item.component!.code, [rule.id]: `GROUP:${branch.id}` };
      assert.equal(requiredBranch(rule, selected, requirements)?.id, expected.id);
      const result = reconcileDependentBranches(selected, requirements);
      assert.equal(result[rule.id], `GROUP:${expected.id}`);
      assert.deepEqual(reconcileDependentBranches(result, requirements), result);
    }
  }
  const genuineChoice = structuredClone(rule); genuineChoice.description = "Choose a stream or electives.";
  const selections = { [major.id]: major.items[0].component!.code, [rule.id]: `GROUP:${rule.children[0].id}` };
  assert.deepEqual(reconcileDependentBranches(selections, [major, genuineChoice]), selections);
});
test("offering parser recognises imported teaching periods and leaves uncertain data unknown", () => {
  assert.deepEqual(offeredPeriodsFrom([{ teaching_period: "Autumn Session", offered: "true", publish: "true", year: "" }], 2026), ["Autumn Session"]);
  assert.deepEqual(offeredPeriodsFrom([{ teaching_period: "Spring Session", offered: "false", publish: "true" }], 2026), []);
  for (const value of [null, [], "Autumn", [{ teaching_period: "Spring" }]]) assert.equal(offeredPeriodsFrom(value, 2026), undefined);
});
