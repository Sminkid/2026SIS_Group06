import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ComponentDetailResponse, DegreeDetailResponse, StudyPlan } from "../types/handbook";
import { cloneOfficialPlan, plannerToStudyPlan, type PlannerContext } from "../types/planner";
import { rebasePlannerSlots, reconcilePlannerComponentSelections } from "../hooks/usePlannerState";
import { revalidateComponentSelections } from "../hooks/useComponentSelections";
import { expandRoadmapSlots, flattenRequirements } from "./roadmapSlots";
import { reconcileStudyPlan } from "./studyPlanSelection";
import { reconcileDependentBranches } from "./studyPathDependencies";
import { resolveStudyPathChoiceScope } from "./studyPathChoiceScope";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/handbook-2026.json", import.meta.url), "utf8")) as {
  engineering: DegreeDetailResponse; accounting: DegreeDetailResponse;
  engineeringPlans: StudyPlan[]; accountingPlans: StudyPlan[]; details: Record<string, ComponentDetailResponse>;
  usyd: DegreeDetailResponse; usydComponent: ComponentDetailResponse;
};
const { accounting, engineering, details, engineeringPlans } = fixture;
const plan = fixture.accountingPlans[0];
const items = (value: StudyPlan) => value.years.flatMap((year) => year.periods.flatMap((period) => period.items));
const group = accounting.requirements.find((candidate) => candidate.pathways.length)!;
const context: PlannerContext = { universityCode: "UTS", handbookYear: 2026, degreeCode: accounting.degree.code,
  selectedComponentCodes: [], activePathwayRequirementGroupIds: [], knownPathwayRequirementGroupIds: [] };
const choose = (path: string, codes: string[]) => {
  const pathway = group.pathways.find((candidate) => candidate.id.endsWith(path))!;
  const selections: Record<string, string> = { [group.id]: `PATHWAY:${pathway.id}` };
  let cursor = 0;
  pathway.selections.filter((selection) => selection.selectionType === "COMPONENT").forEach((selection) => {
    for (let index = 0; index < selection.requiredSelections; index++) {
      const code = codes[cursor++];
      if (code) selections[`${pathway.id}:selection:${selection.requirementGroupId}:${index}`] = code;
    }
  });
  return selections;
};
const expand = (selections: Record<string, string>) => expandRoadmapSlots(plan, "UTS", accounting.requirements, selections, details)!;
const children = (value: StudyPlan) => items(value).filter((item) => item.choiceOrigin?.parentAggregateItemId);

test("Accounting starts empty and expands only the official 12 + 12 + 24 CP blocks", () => {
  const expanded = expand({});
  assert.equal(children(expanded).length, 8);
  assert.ok(children(expanded).every((item) => item.itemType === "CHOICE" && !item.subject));
  assert.deepEqual(expanded.years.map((year) => year.periods.map((period) => period.items.reduce((sum, item) => sum + (item.creditPoints ?? 0), 0))),
    plan.years.map((year) => year.periods.map((period) => period.items.reduce((sum, item) => sum + (item.creditPoints ?? 0), 0))));
  assert.equal(items(expanded).reduce((sum, item) => sum + (item.creditPoints ?? 0), 0), 150);
  assert.deepEqual(revalidateComponentSelections({}, accounting.requirements), {});
});

test("Two sub-majors preserve their own groups and expose missing required subject records", () => {
  const selections = choose("two-sub-majors", ["SMJ08109", "SMJ08138"]);
  const expanded = expand(selections);
  const slots = children(expanded);
  assert.equal(slots.reduce((sum, item) => sum + item.creditPoints!, 0), 48);
  for (const code of ["SMJ08109", "SMJ08138"]) {
    const own = slots.filter((item) => item.choiceOrigin?.formalComponentCode === code);
    assert.equal(own.reduce((sum, item) => sum + item.creditPoints!, 0), 24);
    for (const item of own.filter((candidate) => candidate.itemType === "CHOICE" && candidate.choiceOrigin?.componentRequirementKind !== "FIXED")) {
      const scope = resolveStudyPathChoiceScope(item, accounting.requirements, details, selections);
      assert.equal(scope.componentId, details[code].component.id);
      assert.equal(scope.groups?.length, 1);
      assert.equal(scope.groups?.[0].id, item.choiceOrigin?.formalRequirementGroupId);
    }
  }
  assert.equal(slots.filter((item) => item.choiceOrigin?.candidateSourceType === "UNRESOLVED").length, 1);
  assert.equal(slots.find((item) => item.choiceOrigin?.candidateSourceType === "UNRESOLVED")?.rawCode, "21228");
  assert.equal(slots.filter((item) => item.choiceOrigin?.componentRequirementKind === "SELECTIVE").length, 2);
});

test("Sub-major plus electives gives four empty elective slots and separate 24 CP component", () => {
  const selections = choose("sub-major-and-electives", ["SMJ08138"]);
  const slots = children(expand(selections));
  const electives = slots.filter((item) => item.choiceOrigin?.candidateSourceType === "BROAD");
  assert.equal(electives.length, 4);
  assert.ok(electives.every((item) => !item.subject && item.creditPoints === 6));
  assert.equal(slots.filter((item) => item.choiceOrigin?.formalComponentCode).reduce((sum, item) => sum + item.creditPoints!, 0), 24);
  assert.equal(resolveStudyPathChoiceScope(electives[0], accounting.requirements, details, selections).kind, "BROAD");
});

test("Second major supplies 30 CP fixed core and 18 CP independent options", () => {
  const slots = children(expand(choose("second-major", ["MAJ08441"])));
  assert.equal(slots.length, 8);
  assert.equal(slots.filter((item) => item.subject).length, 5);
  assert.equal(slots.filter((item) => !item.subject).length, 3);
  assert.equal(slots.reduce((sum, item) => sum + item.creditPoints!, 0), 48);
});

test("Empty component controls never select a default and duplicate saved sub-majors are rejected", () => {
  const empty = choose("two-sub-majors", []);
  assert.ok(children(expand(empty)).every((item) => !item.subject));
  const duplicate = choose("two-sub-majors", ["SMJ08138", "SMJ08138"]);
  assert.equal(Object.values(revalidateComponentSelections(duplicate, accounting.requirements)).filter((value) => value === "SMJ08138").length, 1);
  const stale = { ...choose("second-major", []), ...Object.fromEntries(Object.entries(duplicate).filter(([key]) => key !== group.id)) };
  assert.equal(Object.values(revalidateComponentSelections(stale, accounting.requirements)).filter((value) => value === "SMJ08138").length, 0);
});

test("Generated identities and provenance survive clone, reload and repeated expansion", () => {
  const selections = choose("two-sub-majors", ["SMJ08109", "SMJ08138"]);
  const expanded = expand(selections);
  const again = expandRoadmapSlots(expanded, "UTS", accounting.requirements, selections, details)!;
  assert.deepEqual(again, expanded);
  assert.equal(new Set(items(expanded).map((item) => item.id)).size, items(expanded).length);
  const planner = cloneOfficialPlan(expanded, context);
  assert.deepEqual(children(plannerToStudyPlan(JSON.parse(JSON.stringify(planner)), expanded)).map((item) => item.choiceOrigin), children(expanded).map((item) => item.choiceOrigin));
  assert.deepEqual(rebasePlannerSlots(planner, expanded, context), planner);
});

test("Changing one sub-major preserves the other's selected option and removes only dependent capacity", () => {
  const expanded = expand(choose("two-sub-majors", ["SMJ08109", "SMJ08138"]));
  const planner = cloneOfficialPlan(expanded, context);
  const option = planner.years.flatMap((year) => year.periods.flatMap((period) => period.items)).find((item) => item.itemType === "CHOICE" && item.choiceOrigin?.formalComponentCode === "SMJ08138")!;
  const subject = flattenRequirements(details.SMJ08138.requirements).find((candidate) => candidate.id === option.choiceOrigin?.formalRequirementGroupId)!.items.find((item) => item.subject)!.subject!;
  option.subject = { officialSubjectId: subject.id, code: subject.code, name: subject.name, creditPoints: subject.creditPoints };
  option.itemType = "SUBJECT";
  const next = rebasePlannerSlots(planner, expand(choose("two-sub-majors", ["", "SMJ08138"])), context);
  const nextItems = next.years.flatMap((year) => year.periods.flatMap((period) => period.items));
  assert.equal(nextItems.find((item) => item.plannerItemId === option.plannerItemId)?.subject?.code, subject.code);
  assert.ok(!nextItems.some((item) => item.choiceOrigin?.formalComponentCode === "SMJ08109"));
});

test("Removing a component also clears provenance from its previously emptied choices", () => {
  const expanded = expand(choose("two-sub-majors", ["SMJ08109", "SMJ08138"]));
  const planner = cloneOfficialPlan(expanded, context);
  const next = reconcilePlannerComponentSelections(planner, { ...context, selectedComponentCodes: ["SMJ08138"] });
  const nextItems = next.years.flatMap((year) => year.periods.flatMap((period) => period.items));
  assert.ok(!nextItems.some((item) => item.choiceOrigin?.formalComponentCode === "SMJ08109"));
  assert.ok(nextItems.some((item) => item.choiceOrigin?.formalComponentCode === "SMJ08138"));
});

test("Internships remain zero/unknown CP placements in their original sessions", () => {
  const expanded = expand({});
  assert.deepEqual(items(expanded).filter((item) => /internship/i.test(item.title)), items(plan).filter((item) => /internship/i.test(item.title)));
  assert.deepEqual(expanded.years.map((year) => year.periods.map((period) => period.name)), plan.years.map((year) => year.periods.map((period) => period.name)));
});

test("Non-6 CP fixed subjects use their actual capacity and mixed optional CP remains explicit", () => {
  const copied = structuredClone(details);
  const major = copied.MAJ08441;
  const core = major.requirements[0];
  core.requiredCreditPoints = 48;
  core.items = core.items.slice(0, 4).map((item) => ({ ...item, creditPoints: 12, subject: { ...item.subject!, creditPoints: 12 } }));
  major.requirements = [core];
  const selections = choose("second-major", [major.component.code]);
  const expanded = expandRoadmapSlots(plan, "UTS", accounting.requirements, selections, copied)!;
  assert.equal(children(expanded).length, 4);
  assert.ok(children(expanded).every((item) => item.creditPoints === 12));
  core.logic = "ANY";
  core.items[0].subject!.creditPoints = 6;
  const unresolved = expandRoadmapSlots(plan, "UTS", accounting.requirements, selections, copied)!;
  assert.equal(children(unresolved).length, 0);
  assert.equal(items(unresolved).filter((item) => item.choiceOrigin?.candidateSourceType === "UNRESOLVED").length, 3);
});

test("Every imported Engineering major resolves only its own variants or requests a choice", () => {
  const majorGroup = engineering.requirements.find((candidate) => candidate.items.some((item) => item.component?.type === "MAJOR"))!;
  assert.equal(majorGroup.items.length, 14);
  for (const item of majorGroup.items) {
    const major = item.component!;
    const result = reconcileStudyPlan(engineeringPlans, engineeringPlans[0].id, major.code);
    if (result.plan) {
      assert.equal(result.plan.major?.id, major.id);
      assert.equal(reconcileStudyPlan(engineeringPlans, result.plan.id, major.code).plan?.id, result.plan.id);
    } else assert.ok(result.reason);
  }
  for (const variant of engineeringPlans) {
    assert.ok(variant.major);
    assert.equal(reconcileStudyPlan(engineeringPlans, variant.id, variant.major.code).plan?.id, variant.id);
  }
});

test("Variant reconciliation preserves commencement/mode and never carries another major as fallback", () => {
  const spring = engineeringPlans.find((candidate) => candidate.major?.code === "MAJ03007" && candidate.commencement === "SPRING")!;
  const next = reconcileStudyPlan(engineeringPlans, spring.id, "MAJ03504");
  assert.equal(next.plan?.commencement, "SPRING");
  assert.equal(next.plan?.attendance, "FULL");
  assert.equal(reconcileStudyPlan(engineeringPlans, spring.id, "MAJ03540").plan, undefined);
});

test("Explicit imported stream rule removes incompatible branches and chooses required electives", () => {
  const major = engineering.requirements.find((candidate) => candidate.items.some((item) => item.component?.type === "MAJOR"))!;
  const rule = engineering.requirements.find((candidate) => candidate.description?.includes("aligned 24cp"))!;
  const electrical = reconcileDependentBranches({ [major.id]: "MAJ03537" }, engineering.requirements);
  const selected = electrical[rule.id];
  assert.ok(selected);
  const science = reconcileDependentBranches({ ...electrical, [major.id]: "MAJ03518" }, engineering.requirements);
  assert.notEqual(science[rule.id], selected);
  assert.match(rule.children.find((candidate) => `GROUP:${candidate.id}` === science[rule.id])!.description!, /CBK90011/);
});

test("Data Science's three 6 CP options each resolve the exact eleven imported candidates", () => {
  const science = engineeringPlans.find((candidate) => candidate.major?.code === "MAJ03518")!;
  const options = items(science).filter((item) => item.title.includes("CBK92152"));
  assert.equal(options.length, 3);
  assert.equal(options.reduce((sum, item) => sum + item.creditPoints!, 0), 18);
  const expected = ["41891", "41180", "32146", "31253", "42028", "31256", "41043", "41183", "48024", "42050", "42913"].sort();
  for (const item of options) {
    const scope = resolveStudyPathChoiceScope(item, engineering.requirements, details, { major: "MAJ03518" });
    assert.equal(scope.componentId, details.MAJ03518.component.id);
    assert.deepEqual(scope.groups?.flatMap((candidate) => candidate.items.flatMap((entry) => entry.subject ? [entry.subject.code] : [])).sort(), expected);
  }
});

test("USYD API sample retains requirements, component structure and no UTS expansion", () => {
  assert.ok(fixture.usyd.requirements.length);
  assert.ok(fixture.usyd.completionSummary.length);
  assert.ok(fixture.usydComponent.requirements.length);
  assert.equal(expandRoadmapSlots(plan, "USYD", accounting.requirements, {}, details), plan);
  const fingerprints = flattenRequirements(fixture.usydComponent.requirements).map((candidate) => JSON.stringify([candidate.title, candidate.logic, candidate.requiredCreditPoints, candidate.items.map((item) => item.subject?.id).sort()]));
  assert.equal(new Set(fingerprints).size, fingerprints.length);
});
