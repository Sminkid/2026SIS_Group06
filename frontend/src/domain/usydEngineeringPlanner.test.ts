import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { adaptUsydEngineeringPlan, isUsydMovable, resolveUsydEngineeringChoice, usydPlannerContext } from "./usydEngineeringPlanner";
import { normalizeUsydEngineeringAccess } from "./usydEngineeringAccessConditions";
import { cloneOfficialPlan, plannerToStudyPlan } from "../types/planner";
import { proposeMove } from "./plannerMove";
import { validatePlanner } from "./plannerValidation";
import type { ComponentDetailResponse, RequirementGroup, StudyPlan } from "../types/handbook";
import type { SubjectAccessConditions } from "../types/subject";

const fixture = JSON.parse(readFileSync(new URL("../../e2e/fixtures/usyd-engineering-2026.json", import.meta.url), "utf8"));
const source: StudyPlan = fixture.plans[0];
const group = (id: string, title: string): RequirementGroup => ({ id, title, logic: "ANY", requiredCreditPoints: null, maximumCreditPoints: null,
  description: null, sortOrder: null, items: [], candidateSources: [], children: [], pathways: [] });
const access: SubjectAccessConditions = { subject: { id: "info1113", code: "INFO1113", name: "Object-Oriented Programming" }, hasConditions: true, antiRequisiteGroups: [],
  requisiteGroups: [{ id: "rule", groupType: "PREREQUISITE", rule: "INFO1110 or INFO1910 or ENGG1810", sortOrder: 0,
    items: ["INFO1110", "INFO1910", "ENGG1810"].map((code, index) => ({ id: code, itemKey: `INFO1113:PREREQUISITE:0:${index}`, requisiteType: "PREREQUISITE", details: "Original source text",
      referencedSubject: { id: code, code, name: code }, referencedComponent: null, referencedDegree: null, rawReferencedCodes: [code], sortOrder: index })) }] };

test("12 CP CUSP capacity expands deterministically without modifying official subjects or periods", () => {
  const plan = structuredClone(source); const choice = plan.years.flatMap(year => year.periods).flatMap(period => period.items).find(item => item.itemType === "CHOICE")!;
  choice.creditPoints = 12;
  plan.years.unshift({ ...structuredClone(plan.years[0]), id: "year-zero", name: "Year 0" });
  const before = structuredClone(plan); const adapted = adaptUsydEngineeringPlan(plan);
  assert.equal(adapted.years.some(year => year.name === "Year 0"), false);
  const children = adapted.years.flatMap(year => year.periods).flatMap(period => period.items).filter(item => item.choiceOrigin?.officialChoiceItemId === choice.id);
  assert.equal(children.length, 2); assert.equal(children.reduce((sum, item) => sum + item.creditPoints!, 0), 12);
  assert.deepEqual(adaptUsydEngineeringPlan(plan), adapted); assert.deepEqual(plan, before);
  assert.ok(children.every(item => !item.subject && item.choiceOrigin?.maximumCreditPoints === 6));
});

test("mixed scopes preserve distinct source ownership and require Dalyell applicability", () => {
  const streamGroup = group("stream-options", "1000/2000 Level Stream Elective units");
  streamGroup.items = [{ id: "info", itemType: "SUBJECT", subject: { id: "info", code: "INFO1111", name: "Computing", creditPoints: 6 }, component: null, rawCode: null, rawName: null, creditPoints: 6, sortOrder: 0 }];
  const free = group("free", "Free Electives"); free.maximumCreditPoints = 24;
  free.candidateSources = [{ id: "ug", sourceKey: "ug", type: "SUBJECT_FILTER", title: "Engineering undergraduate units", authoritative: true, candidateCount: 271, tableName: null },
    { id: "s", sourceKey: "s", type: "TABLE_SUBJECT_POOL", title: "Table S units", authoritative: true, candidateCount: 1472, tableName: "Table S" }];
  const dalyell = group("d", "Dalyell"); dalyell.description = "For students enrolled, a minimum of 12 credit points";
  dalyell.candidateSources = [{ id: "d-source", sourceKey: "d", type: "TABLE_SUBJECT_POOL", title: "Table D", authoritative: true, tableName: "Table D", candidateCount: 17 }];
  const detail = { component: { code: "software" }, requirements: [streamGroup] } as ComponentDetailResponse;
  const choice = source.years.flatMap(year => year.periods).flatMap(period => period.items).find(item => item.itemType === "CHOICE")!;
  const scope = resolveUsydEngineeringChoice(choice, [free, dalyell], detail, undefined, false);
  assert.deepEqual(scope.groups?.map(group => group.id), ["stream-options", "free"]);
  assert.equal(scope.componentCodesByGroup?.[streamGroup.id], "software");
  assert.deepEqual(resolveUsydEngineeringChoice(choice, [free, dalyell], detail, undefined, true).groups?.map(group => group.id), ["stream-options", "free", "d"]);
});

test("INFO1113 is evaluated from normalized OR tokens; prose stays unknown and raw source is unchanged", () => {
  const adapted = normalizeUsydEngineeringAccess(access);
  assert.equal(adapted.requisiteGroups[0].rule, "U0 OR U1 OR U2");
  assert.equal(access.requisiteGroups[0].rule, "INFO1110 or INFO1910 or ENGG1810");
  const planner = cloneOfficialPlan(source, usydPlannerContext(2026, "BHENGINE-04"));
  planner.years[1].periods[0].items.push({ ...planner.years[0].periods[0].items[0], plannerItemId: "info1113", title: "Object-Oriented Programming",
    subject: { officialSubjectId: "info1113", code: "INFO1113", name: "Object-Oriented Programming", creditPoints: 6 } });
  const validate = () => validatePlanner({ planner, accessConditions: { INFO1113: adapted }, requirements: [], selectedComponents: {}, degreeCreditPoints: 192 });
  assert.ok(!validate().results.some(issue => issue.subjectCode === "INFO1113" && issue.code === "CONDITION_NOT_EVALUATED"));
  assert.ok(!validate().results.some(issue => issue.subjectCode === "INFO1113" && issue.code === "PREREQUISITE_TIMING"));
  planner.years[0].periods[0].items = planner.years[0].periods[0].items.filter(item => item.subject?.code !== "INFO1110");
  const missing = validate().results.filter(issue => issue.subjectCode === "INFO1113");
  assert.equal(missing.length, 1); assert.equal(missing[0].code, "PREREQUISITE_TIMING");
  assert.match(missing[0].message, /either INFO1110 .* or INFO1910 .* or ENGG1810/);
  const complex = structuredClone(access); complex.requisiteGroups[0].rule = "36 credit points and WAM >= 70";
  assert.equal(normalizeUsydEngineeringAccess(complex).requisiteGroups[0].rule, complex.requisiteGroups[0].rule);
});

test("partially unresolved OR prohibitions retain manual verification and report established conflicts", () => {
  const planner = cloneOfficialPlan(source, usydPlannerContext(2026, "BHENGINE-04"));
  const record = structuredClone(access); record.subject.code = "INFO1110"; record.requisiteGroups = [];
  const prohibition = structuredClone(access.requisiteGroups[0]); prohibition.groupType = "PROHIBITION";
  prohibition.items[1].referencedSubject = null; prohibition.items[2].referencedSubject = null;
  record.antiRequisiteGroups = [prohibition];
  const normalized = normalizeUsydEngineeringAccess(record);
  const issues = validatePlanner({ planner, accessConditions: { INFO1110: normalized }, requirements: [], selectedComponents: {}, degreeCreditPoints: null }).results;
  assert.ok(issues.some(issue => issue.code === "CONDITION_NOT_EVALUATED"));
  assert.ok(issues.some(issue => issue.code === "ANTI_REQUISITE_CONFLICT" && /INFO1110/.test(issue.message)));
  prohibition.rule = "INFO1110 and INFO1910";
  assert.equal(normalizeUsydEngineeringAccess(record).antiRequisiteGroups.length, 1);
});

test("movement checks offerings and CP limits while retaining unknown information and USYD activity locks", () => {
  const planner = cloneOfficialPlan(source, usydPlannerContext(2026, "BHENGINE-04"));
  const item = planner.years[0].periods[0].items[0]; const target = planner.years[1].periods[0];
  target.maximumCreditPoints = 3;
  const reviewed = proposeMove(planner, item.plannerItemId, target.plannerPeriodId,
    { accessConditions: {}, offeredPeriods: { INFO1110: ["Semester 2"] } }, isUsydMovable);
  assert.ok(reviewed.errors.some(error => /CP exceeds/.test(error))); assert.ok(reviewed.errors.some(error => /not offered/.test(error)));
  assert.ok(reviewed.warnings.some(warning => /unavailable/.test(warning)));
  for (const title of ["Thesis A", "Engineering Project", "Professional Engagement", "Industry Placement", "Practicum", "Internship"]) assert.equal(isUsydMovable({ ...item, title }), false);
  assert.equal(isUsydMovable({ ...item, numberOfPeriods: 2 }), false); assert.equal(isUsydMovable({ ...item, scheduleLocked: true }), false);
});

test("normalized corequisites allow the same period and reject a later period", () => {
  const planner = cloneOfficialPlan(source, usydPlannerContext(2026, "BHENGINE-04"));
  const record = structuredClone(access); record.requisiteGroups[0].groupType = "COREQUISITE";
  planner.years[0].periods[0].items.push({ ...planner.years[0].periods[0].items[0], plannerItemId: "info1113",
    subject: { officialSubjectId: "info1113", code: "INFO1113", name: "Object-Oriented Programming", creditPoints: 6 } });
  const validate = () => validatePlanner({ planner, accessConditions: { INFO1113: normalizeUsydEngineeringAccess(record) }, requirements: [], selectedComponents: {}, degreeCreditPoints: null });
  assert.ok(!validate().results.some(issue => issue.code === "COREQUISITE_TIMING"));
  const programming = planner.years[0].periods[0].items.shift()!; planner.years[1].periods[0].items.push(programming);
  assert.ok(validate().results.some(issue => issue.code === "COREQUISITE_TIMING"));
});

test("movement reviews prerequisite failures, preserves source data, and holding area survives serialization", () => {
  const planner = cloneOfficialPlan(source, usydPlannerContext(2026, "BHENGINE-04"));
  planner.years[1].periods[0].items.push({ ...planner.years[0].periods[0].items[0], plannerItemId: "test-info1113", title: "Object-Oriented Programming",
    subject: { officialSubjectId: "info1113", code: "INFO1113", name: "Object-Oriented Programming", creditPoints: 6 } });
  const programming = planner.years.flatMap(year => year.periods).flatMap(period => period.items).find(item => item.subject?.code === "INFO1110")!;
  const later = planner.years.at(-1)!.periods.at(-1)!;
  const proposal = proposeMove(planner, programming.plannerItemId, later.plannerPeriodId,
    { accessConditions: { INFO1113: normalizeUsydEngineeringAccess(access) } }, isUsydMovable);
  assert.ok(proposal.errors.some(error => /Prerequisite|prerequisite/.test(error)));
  const cleared = proposeMove(planner, programming.plannerItemId, null, { accessConditions: {} }, isUsydMovable);
  assert.deepEqual(cleared.errors, []); assert.equal(JSON.parse(JSON.stringify(cleared.plan)).unassignedItems[0].subject.code, "INFO1110");
  assert.equal(planner.unassignedItems.length, 0);
  const pep = planner.years.flatMap(year => year.periods).flatMap(period => period.items).find(item => /^ENGP/.test(item.subject?.code ?? ""));
  if (pep) assert.ok(!isUsydMovable(pep));
  assert.ok(plannerToStudyPlan(planner, source).years.length > 0);
});
