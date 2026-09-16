import assert from "node:assert/strict";
import test from "node:test";
import type { DegreeDetailResponse, RequirementGroup, RequirementItem, StudyPlan,
  StudentRequirementSummary } from "../types/handbook";
import { mapUsydEngineeringStructure, usydEngineeringConditionalDisplayGroups,
  usydEngineeringDisplayGroups, usydEngineeringStreamChoices } from "./usydEngineeringStructure";

const summary = (id: string, sourceText: string, minimumCreditPoints: number | null,
  obligation: StudentRequirementSummary["obligation"] = "REQUIRED"): StudentRequirementSummary => ({
  id, title: sourceText, explanation: null, obligation, minimumCreditPoints, maximumCreditPoints: null,
  conditionLabel: null, actionKind: "NONE", sourceText, sourceUrl: null, requirementGroupId: id,
});

const completionSummary: StudentRequirementSummary[] = [
  summary("table-foundation", "the Engineering Foundations Table", null),
  summary("foundation", "a minimum of 18 credit points from the Engineering Foundations Table", 18),
  summary("projects", "a minimum of 30 credit points from the Engineering Projects Table", 30),
  summary("pep", "successfully complete the requirements of the Professional Engagement Program", null),
  summary("stream", "a minimum of 120 credit points from the Engineering Stream Table", 120),
  summary("electives", "a maximum of 24 credit points from Table S", 24),
  summary("specialisation", "the Engineering Specialisations Tables", null),
  summary("dalyell", "for students enrolled in the Dalyell Stream, 12 credit points", 12, "CONDITIONAL"),
];

const detail = (requirements: RequirementGroup[] = []): DegreeDetailResponse => ({
  degree: { id: "degree", code: "BHENGINE-04", name: "Bachelor of Engineering Honours", creditPoints: 192,
    handbookYear: 2026, university: { id: "usyd", code: "USYD", name: "The University of Sydney" }, description: null },
  requirements,
  completionSummary,
});

const group = (id: string, title: string, logic: RequirementGroup["logic"],
  requiredCreditPoints: number | null, items: RequirementItem[] = []): RequirementGroup => ({
  id, title, description: null, logic, requiredCreditPoints, maximumCreditPoints: null,
  sortOrder: null, items, children: [], pathways: [],
});

const subjectItem = (id: string, code: string, name: string, creditPoints: number): RequirementItem => ({
  id, itemType: "SUBJECT", subject: { id, code, name, creditPoints }, component: null,
  rawCode: code, rawName: name, creditPoints, sortOrder: null,
});

const componentItem = (id: string, name: string): RequirementItem => ({
  id, itemType: "COMPONENT", subject: null,
  component: { id, code: id, displayCode: null, name, type: "STREAM", creditPoints: 120,
    creditPointsAvailability: "EXPLICIT_COMPONENT" },
  rawCode: id, rawName: name, creditPoints: 120, sortOrder: null,
});

test("empty BHENGINE-04 groups remain clean official requirements", () => {
  const result = mapUsydEngineeringStructure(detail())!;
  const groups = usydEngineeringDisplayGroups(result);

  assert.equal(result.totalCreditPoints, 192);
  assert.deepEqual(groups.map((candidate) => candidate.title),
    ["Engineering Core", "Engineering Stream", "Open Electives", "Specialisation"]);
  assert.deepEqual(groups[0]?.children.map((candidate) => candidate.requiredCreditPoints), [18, 30, null]);
  assert.equal(groups[0]?.children[0]?.description,
    "a minimum of 18 credit points from the Engineering Foundations Table");
  assert.equal(groups[1]?.description, "a minimum of 120 credit points from the Engineering Stream Table");
  assert.equal(groups[2]?.description, "a maximum of 24 credit points from Table S");
  assert.equal(groups[3]?.description, "the Engineering Specialisations Tables");
  assert.ok(groups.flatMap((candidate) => [candidate, ...candidate.children])
    .every((candidate) => !candidate.description?.includes("Data availability")));
  assert.deepEqual(usydEngineeringConditionalDisplayGroups(result).map((candidate) => candidate.description),
    ["for students enrolled in the Dalyell Stream, 12 credit points"]);
});

test("real linked Foundation, Project, PEP and stream content survives the compatibility hierarchy", () => {
  const result = mapUsydEngineeringStructure(detail([
    group("foundation", "Engineering Foundations Table", "ALL", 18,
      [subjectItem("math1061", "MATH1061", "Mathematics 1A", 6)]),
    group("projects", "Engineering Projects Table", "ALL", 30,
      [subjectItem("engg2112", "ENGG2112", "Engineering Project A", 6)]),
    group("pep", "Professional Engagement Program", "ALL", null,
      [subjectItem("engp1001", "ENGP1001", "Professional Engagement Program 1A", 0)]),
    group("stream", "Engineering Stream Table", "ONE_OF", 120,
      [componentItem("software", "Software Engineering"), componentItem("civil", "Civil Engineering")]),
  ]))!;
  const groups = usydEngineeringDisplayGroups(result);
  const core = groups[0]!;
  const stream = groups[1]!;

  assert.equal(core.children[0]?.items[0]?.subject?.code, "MATH1061");
  assert.equal(core.children[1]?.items[0]?.subject?.code, "ENGG2112");
  assert.equal(core.children[2]?.items[0]?.subject?.code, "ENGP1001");
  assert.equal(stream.logic, "ONE_OF");
  assert.deepEqual(stream.items.map((item) => item.component?.name), ["Software Engineering", "Civil Engineering"]);
});

test("a formal STREAM pool is preserved when its imported title differs from the source clause", () => {
  const streamClause = group("stream-clause", "Requirement 12", "UNKNOWN", 120);
  streamClause.description = "a minimum of 120 credit points from the Engineering Stream Table";
  const formalPool = group("stream-pool", "Engineering Streams stream choice pool", "ONE_OF", null,
    [componentItem("software", "Software Engineering"), componentItem("civil", "Civil Engineering")]);

  const result = mapUsydEngineeringStructure(detail([streamClause, formalPool]))!;
  const stream = usydEngineeringDisplayGroups(result).find((candidate) => candidate.title === "Engineering Stream")!;

  assert.equal(stream.id, "stream-pool");
  assert.deepEqual(stream.items.map((item) => item.component?.name), ["Software Engineering", "Civil Engineering"]);
});

test("the compatibility adapter does not apply to other USYD degrees", () => {
  const other = detail();
  assert.equal(mapUsydEngineeringStructure({ ...other, degree: { ...other.degree, code: "OTHER" } }), null);
});

const plan = (id: string, pathway: string, title: string): StudyPlan => ({
  id, sourcePlanId: id, pathway, sourceType: "CUSP", handbookYear: 2026, title,
  description: null, sourceUrl: "https://cusp.sydney.edu.au/example",
  years: [{ id: `${id}:year-1`, name: "Year 1", sortOrder: 1, periods: [{ id: `${id}:semester-1`,
    name: "Semester 1", sortOrder: 0, items: [{ id: `${id}:info1110`, itemType: "SUBJECT",
      subject: { id: "info1110", code: "INFO1110", name: "Introduction to Programming", creditPoints: 6 },
      rawCode: "INFO1110", title: "Introduction to Programming", creditPoints: 6,
      numberOfPeriods: null, sortOrder: 0 }] }] }],
});

test("CUSP supplies stream labels without becoming Course Structure content", () => {
  const software = plan("software", "Software Engineering", "Software Engineering");
  const choices = usydEngineeringStreamChoices([
    plan("software-mid", "Software Engineering", "Software Engineering (mid-year)"),
    plan("software-specialisation", "Software Engineering", "Software Engineering: 1. Stream Specialisation in IoT"),
    software,
    plan("civil", "Civil Engineering", "Civil Engineering"),
  ]);

  assert.deepEqual(choices.map((choice) => choice.pathway), ["Civil Engineering", "Software Engineering"]);
  assert.equal(choices[1]?.plan.id, "software");
  assert.deepEqual(Object.keys(choices[1]!).sort(), ["pathway", "plan"]);
});
