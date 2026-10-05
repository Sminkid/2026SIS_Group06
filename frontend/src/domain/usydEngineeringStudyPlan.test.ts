import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentDetailResponse, RequirementGroup, StudyPlan } from "../types/handbook";
import {
  defaultUsydCommencement,
  groupUsydStudyPlans,
  resolveUsydEngineeringStudyPlan,
  resolveUsydEngineeringStudyPlanPreview,
  suggestUsydEngineeringStudyPlanPreview,
  usydEngineeringAcademicSelection,
  type UsydEngineeringAcademicSelection,
} from "./usydStudyPlan";

const plan = (id: string, pathway: string, title: string): StudyPlan => ({
  id, pathway, title, description: null, sourceUrl: null, years: [],
});

const plans = [
  plan("software-base", "Software Engineering", "Software Engineering"),
  plan("software-computer", "Software Engineering",
    "Software Engineering: 1. Stream Specialisation in Computer Engineering"),
  plan("software-mid-base", "Software Engineering", "Software Engineering (mid-year)"),
  plan("software-mid-computer", "Software Engineering",
    "Software Engineering (mid-year): 1. Stream Specialisation in Computer Engineering"),
  plan("civil-base", "Civil Engineering", "Civil Engineering"),
  plan("civil-structures", "Civil Engineering",
    "Civil Engineering: 02. Stream Specialisation in Structures"),
  plan("electrical-base", "Electrical Engineering", "Electrical Engineering"),
  plan("electrical-power", "Electrical Engineering",
    "Electrical Engineering: 1. Stream Specialisation in Power Engineering"),
  plan("electrical-humanitarian", "Electrical Engineering",
    "Electrical Engineering: 2. Breadth Specialisation in Humanitarian Engineering"),
  plan("electrical-mid-base", "Electrical Engineering", "Electrical Engineering (mid-year)"),
];

const preview = (overrides: Partial<Parameters<typeof resolveUsydEngineeringStudyPlanPreview>[0]> = {}) =>
  resolveUsydEngineeringStudyPlanPreview({
    stream: "", specialisation: "", commencement: "", planId: "", plans, ...overrides,
  });

test("the independent preview exposes every stream even without a Course Structure selection", () => {
  const result = preview();
  assert.deepEqual(result.streams.map((group) => group.pathway), [
    "Civil Engineering", "Electrical Engineering", "Software Engineering",
  ]);
  assert.equal(result.selectedPlan, null);
  assert.equal(result.resolution, "waiting");
});

test("Course Structure choices seed, but do not own, the preview selection", () => {
  const academic = selected("Software Engineering", "Computer");
  assert.deepEqual(suggestUsydEngineeringStudyPlanPreview(academic, plans), {
    stream: "Software Engineering",
    specialisation: "STREAM_SPECIALISATION:computer",
  });
  const manuallyChanged = preview({ stream: "Civil Engineering", specialisation: "BASE" });
  assert.equal(manuallyChanged.selectedStream, "Civil Engineering");
  assert.equal(manuallyChanged.selectedPlan?.id, "civil-base");
  assert.deepEqual(academic, selected("Software Engineering", "Computer"));
});

test("specialisations are filtered per stream and retain Base, Stream, and Breadth categories", () => {
  const software = preview({ stream: "Software Engineering" });
  assert.deepEqual(software.specialisations.map((choice) => choice.label), ["Base plan", "Stream · Computer Engineering"]);

  const electrical = preview({ stream: "Electrical Engineering" });
  assert.deepEqual(electrical.specialisations.map((choice) => choice.label), [
    "Base plan", "Stream · Power Engineering", "Breadth · Humanitarian Engineering",
  ]);
  assert.equal(electrical.selectedPlan?.id, "electrical-base");
});

test("stream changes discard incompatible specialisations while preserving a valid commencement", () => {
  const changed = preview({
    stream: "Electrical Engineering",
    specialisation: "STREAM_SPECIALISATION:computer",
    commencement: "MID_YEAR",
  });
  assert.equal(changed.selectedSpecialisation, "BASE");
  assert.equal(changed.selectedCommencement, "MID_YEAR");
  assert.equal(changed.selectedPlan?.id, "electrical-mid-base");
});

test("the final variant list is filtered and supports an explicit override when compatible titles collide", () => {
  const duplicate = plan("software-computer-alt", "Software Engineering",
    "Software Engineering: 9. Stream Specialisation in Computer Engineering");
  const input = {
    stream: "Software Engineering",
    specialisation: "STREAM_SPECIALISATION:computer",
    commencement: "STANDARD" as const,
    plans: [...plans, duplicate],
  };
  const ambiguous = resolveUsydEngineeringStudyPlanPreview({ ...input, planId: "" });
  assert.equal(ambiguous.resolution, "ambiguous");
  assert.deepEqual(ambiguous.variants.map((item) => item.plan.id), ["software-computer", "software-computer-alt"]);
  assert.equal(ambiguous.selectedPlan?.id, "software-computer");
  assert.equal(resolveUsydEngineeringStudyPlanPreview({ ...input, planId: "software-computer-alt" }).selectedPlan?.id,
    "software-computer-alt");
});

test("variant-only CUSP categories remain available through the final filtered selector", () => {
  const chemicalPlans = [
    plan("chemical-base", "Chemical & Biomolecular Engineering", "Chemical & Biomolecular Engineering"),
    plan("chemical-mipps", "Chemical & Biomolecular Engineering",
      "Chemical & Biomolecular Engineering: 5. Alternate Thesis Pathway (MIPPS)"),
    plan("chemical-exchange", "Chemical & Biomolecular Engineering",
      "Chemical & Biomolecular Engineering: 6. Exchange Pathway"),
  ];
  const result = resolveUsydEngineeringStudyPlanPreview({
    stream: "Chemical & Biomolecular Engineering",
    specialisation: "OTHER",
    commencement: "STANDARD",
    planId: "chemical-exchange",
    plans: chemicalPlans,
  });
  assert.ok(result.specialisations.some((choice) => choice.id === "OTHER"
    && choice.label === "Other official variants"));
  assert.deepEqual(result.variants.map((item) => item.plan.id), ["chemical-mipps", "chemical-exchange"]);
  assert.equal(result.selectedPlan?.id, "chemical-exchange");
});

test("invalid preview values fail safely instead of leaking plans from another stream", () => {
  const result = preview({ stream: "Unknown Engineering", specialisation: "BASE", commencement: "STANDARD" });
  assert.equal(result.selectedPlan, null);
  assert.equal(result.selectedStream, "");
  assert.deepEqual(result.variants, []);
});

const selected = (stream: string, specialisation?: string): UsydEngineeringAcademicSelection => ({
  stream: { code: `STREAM:${stream}`, name: stream },
  specialisations: specialisation ? [{ code: `SPEC:${specialisation}`, name: specialisation }] : [],
});

test("Software and Civil resolve their actual base and Stream Specialisation titles", () => {
  assert.equal(resolveUsydEngineeringStudyPlan({
    selection: selected("Software Engineering"), commencement: "STANDARD", plans,
  }).plan?.id, "software-base");
  assert.equal(resolveUsydEngineeringStudyPlan({
    selection: selected("Software Engineering", "Computer"), commencement: "STANDARD", plans,
  }).plan?.id, "software-computer");
  assert.equal(resolveUsydEngineeringStudyPlan({
    selection: selected("Civil Engineering"), commencement: "STANDARD", plans,
  }).plan?.id, "civil-base");
  assert.equal(resolveUsydEngineeringStudyPlan({
    selection: selected("Civil Engineering", "Structures"), commencement: "STANDARD", plans,
  }).plan?.id, "civil-structures");
});

test("removing a Specialisation returns to Base and commencement is preserved when valid", () => {
  const groups = groupUsydStudyPlans(plans);
  const software = groups.find((group) => group.pathway === "Software Engineering")!;
  assert.equal(defaultUsydCommencement(software, "MID_YEAR"), "MID_YEAR");
  assert.equal(resolveUsydEngineeringStudyPlan({
    selection: selected("Software Engineering"), commencement: "MID_YEAR", plans,
  }).plan?.id, "software-mid-base");
  const civil = groups.find((group) => group.pathway === "Civil Engineering")!;
  assert.equal(defaultUsydCommencement(civil, "MID_YEAR"), "STANDARD");
});

const component = (id: string, code: string, name: string, type: string) => ({
  id, code, name, type, originalType: null, creditPoints: null, displayCode: null, sourceUrl: null,
  creditPointsAvailability: "UNAVAILABLE" as const,
});

const group = (id: string, components: ReturnType<typeof component>[]): RequirementGroup => ({
  id, title: id, description: null, logic: "ONE_OF", requiredCreditPoints: null,
  maximumCreditPoints: null, sortOrder: null, candidateSources: [], children: [], pathways: [],
  items: components.map((value, index) => ({ id: `${id}:${index}`, itemType: "COMPONENT",
    subject: null, component: value, rawCode: value.code, rawName: value.name,
    creditPoints: null, sortOrder: index })),
});

const detail = (stream: ReturnType<typeof component>, specialisations: ReturnType<typeof component>[]): ComponentDetailResponse => ({
  component: { ...stream, handbookYear: 2026,
    university: { id: "usyd", code: "USYD", name: "The University of Sydney" } },
  requirements: [group(`${stream.id}:specialisations`, specialisations)],
});

test("a stream switch ignores a stale Specialisation outside the active component graph", () => {
  const software = component("software", "USYD:ENGINEERING:STREAM:SOFTWARE-ENGINEERING", "Software Engineering", "STREAM");
  const civil = component("civil", "USYD:ENGINEERING:STREAM:CIVIL-ENGINEERING", "Civil Engineering", "STREAM");
  const computer = component("computer", "USYD:ENGINEERING:SPECIALISATION:COMPUTER", "Computer", "SPECIALISATION");
  const structures = component("structures", "USYD:ENGINEERING:SPECIALISATION:STRUCTURES", "Structures", "SPECIALISATION");
  const requirements = [group("stream-pool", [software, civil])];
  const details = {
    [software.code]: detail(software, [computer]),
    [civil.code]: detail(civil, [structures]),
  };
  const selections = {
    "stream-pool": civil.code,
    "software:specialisations": computer.code,
  };
  const academic = usydEngineeringAcademicSelection(requirements, selections, details);
  assert.equal(academic.stream?.name, "Civil Engineering");
  assert.deepEqual(academic.specialisations, []);
  assert.equal(resolveUsydEngineeringStudyPlan({ selection: academic, commencement: "STANDARD", plans }).plan?.id,
    "civil-base");
});

test("normalization covers real CUSP aliases without a stream-by-stream mapping table", () => {
  const chemicalPlans = [
    plan("chemical-base", "Chemical & Biomolecular Engineering", "Chemical & Biomolecular Engineering"),
    plan("chemical-energy", "Chemical & Biomolecular Engineering",
      "Chemical & Biomolecular Engineering: 1. Stream Specialisation in Chemical Engineering for Energy"),
  ];
  const result = resolveUsydEngineeringStudyPlan({
    selection: selected("Chemical and Biomolecular Engineering", "Chemical Engineering Energy"),
    commencement: "STANDARD",
    plans: chemicalPlans,
  });
  assert.equal(result.plan?.id, "chemical-energy");

  const environmentalPlans = [
    plan("environmental-base", "Environmental Engineering", "Environmental Engineering"),
    plan("environmental-chemical", "Environmental Engineering",
      "Environmental Engineering: 1. Specialisation in Chemical Engineering for the Environment"),
  ];
  assert.equal(resolveUsydEngineeringStudyPlan({
    selection: selected("Environmental Engineering", "Chemical"),
    commencement: "STANDARD",
    plans: environmentalPlans,
  }).plan?.id, "environmental-chemical");
});

test("unresolved and ambiguous selections retain manual fallback without mutating Course Structure", () => {
  const canonical = selected("Software Engineering", "Computer");
  const duplicate = plan("software-computer-copy", "Software Engineering",
    "Software Engineering: 9. Stream Specialisation in Computer Engineering");
  const ambiguous = resolveUsydEngineeringStudyPlan({
    selection: canonical, commencement: "STANDARD", plans: [...plans, duplicate],
  });
  assert.equal(ambiguous.resolution, "ambiguous");
  assert.equal(ambiguous.plan, null);
  assert.ok(ambiguous.variants.length > 0);
  assert.deepEqual(canonical, selected("Software Engineering", "Computer"));

  const missing = resolveUsydEngineeringStudyPlan({
    selection: selected("Unknown Engineering"), commencement: "STANDARD", plans,
  });
  assert.equal(missing.resolution, "fallback");
  assert.equal(missing.plan, null);

  const incomplete = resolveUsydEngineeringStudyPlan({
    selection: selected("Civil Engineering"), commencement: "STANDARD", plans, selectionStatus: "error",
  });
  assert.equal(incomplete.resolution, "fallback");
  assert.equal(incomplete.plan, null);
  assert.ok(incomplete.variants.length > 0);
});
