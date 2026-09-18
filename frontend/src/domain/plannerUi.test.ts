import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getPrerequisiteDisplayState } from "./prerequisiteDisplay";
import { RequirementWarning } from "../components/planner/RequirementWarning";
import { requirementItemCreditPoints, requirementLogicLabel } from "./requirementPresentation";
import { RoadmapCard } from "../components/planner/RoadmapCard";
import { getValidSwapTargets } from "./swapTargets";
import { plannerItems, proposeSwap } from "./plannerSwap";
import { cloneOfficialPlan, plannerItemToStudyPlanItem, type PlannerItem } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";
import type { RequirementItem, StudyPlan } from "../types/handbook";

const known = (): SubjectAccessConditions => ({ subject: { id: "subject", code: "31251", name: "Subject" }, hasConditions: true, antiRequisiteGroups: [],
  requisiteGroups: [{ id: "group", groupType: "REQUISITE", rule: "A", sortOrder: 0, items: [{ id: "item", itemKey: "A", requisiteType: "Prerequisite", details: "Complete 31250 Introduction to Data Analytics first.",
    referencedSubject: { id: "reference", code: "31250", name: "Introduction to Data Analytics" }, referencedComponent: null, referencedDegree: null, rawReferencedCodes: ["31250"], sortOrder: 0 }] }] });
const issue = (message: string) => [{ code: "PREREQUISITE_TIMING", severity: "warning" as const, subjectCode: "31251", message }];
const warningMarkup = (access: SubjectAccessConditions | null, message?: string) => renderToStaticMarkup(createElement(RequirementWarning, {
  state: getPrerequisiteDisplayState(access, message ? issue(message) : [], { hasPlan: true }), year: 2026, university: "UTS",
}));

test("known satisfied, unmet and late prerequisites are distinct from missing data", () => {
  assert.equal(getPrerequisiteDisplayState(known(), [], { hasPlan: true }).kind, "satisfied");
  assert.equal(getPrerequisiteDisplayState(known(), issue("Missing prerequisite: 31250 Introduction to Data Analytics.")).kind, "unmet");
  assert.equal(getPrerequisiteDisplayState(known(), issue("Prerequisite scheduled after this subject: 31250.")).kind, "late");
  assert.equal(getPrerequisiteDisplayState({ ...known(), hasConditions: false, requisiteGroups: [] }).kind, "none");
  assert.equal(warningMarkup(known()), "");
  assert.equal(warningMarkup(known(), "Missing prerequisite: 31250."), "");
  assert.equal(warningMarkup(known(), "Prerequisite scheduled after this subject: 31250."), "");
});

test("missing records, missing conditions and unresolved expressions produce a neutral detail notice", () => {
  const missing = known(); missing.requisiteGroups[0].items[0].referencedSubject = null;
  const unresolved = known(); unresolved.requisiteGroups[0].rule = "A AND (unresolved handbook condition)";
  for (const access of [null, { ...known(), hasConditions: null }, { ...known(), requisiteGroups: [] }]) {
    assert.equal(getPrerequisiteDisplayState(access).kind, "unavailable");
    assert.match(warningMarkup(access), /requirement-information/);
    assert.match(warningMarkup(access), /bg-slate-50/);
    assert.doesNotMatch(warningMarkup(access), /bg-red-50/);
  }
  assert.equal(getPrerequisiteDisplayState(missing).kind, "review");
  assert.equal(getPrerequisiteDisplayState(unresolved).kind, "review");
});

const requirementItem = (contextual: number | null, canonical: number | null): RequirementItem => ({
  id: `item-${contextual}-${canonical}`,
  itemType: "SUBJECT",
  subject: { id: "subject", code: "TEST1000", name: "Test subject", creditPoints: canonical },
  component: null,
  rawCode: "TEST1000",
  rawName: "Test subject",
  creditPoints: contextual,
  sortOrder: 0,
});

test("Course Structure subject CP prefers contextual values and preserves zero", () => {
  assert.equal(requirementItemCreditPoints(requirementItem(6, null)), 6);
  assert.equal(requirementItemCreditPoints(requirementItem(24, 6)), 24);
  assert.equal(requirementItemCreditPoints(requirementItem(0, null)), 0);
  assert.equal(requirementItemCreditPoints(requirementItem(null, 6)), 6);
});

test("requirement logic badges preserve UNKNOWN, ALL and ONE_OF semantics", () => {
  assert.equal(requirementLogicLabel("UNKNOWN"), null);
  assert.equal(requirementLogicLabel("ALL"), "ALL");
  assert.equal(requirementLogicLabel("ONE_OF"), "Choose one");
});

test("loading never claims satisfied prerequisites or displays a missing-data error", () => {
  assert.equal(getPrerequisiteDisplayState(null, [], { loading: true }).kind, "checking");
  assert.equal(getPrerequisiteDisplayState(known()).kind, "review");
});

const setup = () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/handbook-2026.json", import.meta.url), "utf8")) as { engineeringPlans: StudyPlan[] };
  const plan = cloneOfficialPlan(fixture.engineeringPlans[0], { universityCode: "UTS", handbookYear: 2026, degreeCode: "C09066", selectedComponentCodes: [], activePathwayRequirementGroupIds: [], knownPathwayRequirementGroupIds: [] });
  const template = plannerItems(plan).find(item => item.choiceOrigin && item.creditPoints === 6)!;
  const make = (id: string, overrides: Partial<PlannerItem> = {}): PlannerItem => ({ ...template, plannerItemId: id, schedulePositionId: id, title: id,
    choiceOrigin: { ...template.choiceOrigin!, creditPoints: 6, candidateSourceType: "BROAD" }, ...overrides });
  const source = make("source", { itemType: "SUBJECT", subject: { officialSubjectId: "source-subject", code: "SOURCE", name: "Subject with a very long but readable descriptive title", creditPoints: 6 } });
  source.choiceOrigin!.formalComponentId = "source-component"; source.choiceOrigin!.formalRequirementGroupId = "source-group";
  const selected = make("selected", { itemType: "SUBJECT", subject: { officialSubjectId: "selected-subject", code: "SELECTED", name: "Manually selected option", creditPoints: 6 } });
  const empty = make("empty-elective");
  const option = make("sub-major-option"); option.choiceOrigin!.formalComponentId = "sub-major";
  const fixed = make("fixed-core", { choiceOrigin: null });
  const locked = make("locked", { scheduleLocked: true });
  const placement = make("placement", { title: "Professional internship" });
  const small = make("small"); small.choiceOrigin!.maximumCreditPoints = 3;
  const milestone = make("milestone", { choiceOrigin: null, creditPoints: null });
  const period = plan.years[0].periods[0];
  plan.years = [{ ...plan.years[0], periods: [
    { ...period, plannerPeriodId: "source-period", officialPeriodId: "source-period", items: [source, fixed, locked, placement, small, milestone] },
    { ...period, name: "Spring", plannerPeriodId: "targets", officialPeriodId: "targets", items: [empty, option, selected] },
    { ...period, name: "Fixed only", plannerPeriodId: "fixed-only", officialPeriodId: "fixed-only", items: [make("major-core", { choiceOrigin: null })] },
  ] }];
  return { plan, source, selected, empty, option };
};

test("swap list includes controlled choices and excludes source, fixed Core, locks and placements", () => {
  const { plan, source } = setup();
  const groups = getValidSwapTargets(plan, source.plannerItemId, { accessConditions: {} });
  assert.deepEqual(groups.map(group => group.id), ["source-period", "targets"]);
  assert.deepEqual(groups[0].targets.map(target => target.item.plannerItemId), ["small"]);
  assert.deepEqual(groups[1].targets.map(target => target.item.plannerItemId), ["empty-elective", "sub-major-option", "selected"]);
  assert.ok(groups.every(group => group.targets.length > 0));
});

test("duplicate subjects and invalid offerings do not appear as swap targets", () => {
  const { plan, source, selected } = setup();
  assert.deepEqual(getValidSwapTargets(plan, source.plannerItemId, { accessConditions: {}, offeredPeriods: { SOURCE: ["Autumn"] } })
    .flatMap(group => group.targets.map(target => target.item.plannerItemId)), ["small"]);
  selected.subject!.code = source.subject!.code;
  assert.deepEqual(getValidSwapTargets(plan, source.plannerItemId, { accessConditions: {} })
    .flatMap(group => group.targets.map(target => target.item.plannerItemId)), []);
});

test("filtering does not mutate allocations or weaken the swap validator", () => {
  const { plan, source } = setup(); const before = structuredClone(plan);
  const target = getValidSwapTargets(plan, source.plannerItemId, { accessConditions: {} })[0].targets[0];
  assert.deepEqual(plan, before);
  const proposal = proposeSwap(plan, source.plannerItemId, target.item.plannerItemId, { accessConditions: {} });
  assert.deepEqual(proposal.errors, []);
  assert.deepEqual(plannerItems(proposal.plan).find(item => item.plannerItemId === source.plannerItemId)?.choiceOrigin, source.choiceOrigin);
});

test("roadmap prerequisite summary stays compact and full detail is available through its action", () => {
  const { source } = setup();
  const issues = issue("Missing prerequisite: 31250 " + "Long handbook explanation. ".repeat(30));
  const markup = renderToStaticMarkup(createElement(RoadmapCard, { item: plannerItemToStudyPlanItem(source, 0), editable: true, issues,
    prerequisite: getPrerequisiteDisplayState(known(), issues), onChoose() {}, onOpenSubject() {}, onRestoreChoice() {}, onSwap() {},
  }));
  assert.match(markup, /Prerequisite not completed/);
  assert.match(markup, /View requirements/);
  assert.doesNotMatch(markup, /Long handbook explanation/);
  assert.doesNotMatch(markup, /requirement-warning/);
});
