import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, RequirementGroup, StudyPlan } from "../types/handbook";
import { matchUsydEngineeringSpecialisation, usydEngineeringSpecialisations, usydFormalFocusId,
  usydStudyPlanFocusGroups, usydStudyPlanFocusHelper } from "./usydEngineeringSpecialisations";
import { resolveUsydEngineeringStudyPlanPreview, suggestUsydEngineeringStudyPlanPreview,
  usydEngineeringAcademicSelection } from "./usydStudyPlan";
import { resolveUsydEngineeringChoice } from "./usydEngineeringPlanner";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-breadth-2026.json", import.meta.url), "utf8")) as {
  streamGroup: RequirementGroup; streams: ComponentDetailResponse[]; components: ComponentDetailResponse[]; plans: StudyPlan[];
};
const stream = (name: string) => fixture.streams.find(s => s.component.name === name)!;
const breadth = (name: string) => usydEngineeringSpecialisations(stream(name)).filter(o => o.kind === "BREADTH_SPECIALISATION");
const resolve = (detail: ComponentDetailResponse, focus = "BASE", commencement: "STANDARD" | "MID_YEAR" = "STANDARD", planId = "") =>
  resolveUsydEngineeringStudyPlanPreview({ stream: fixture.plans.find(p => p.pathway?.replace(/&/g, "and") === detail.component.name)!.pathway!,
    specialisation: focus, commencement, planId, plans: fixture.plans, streamDetail: detail });

test("four formal Breadth components retain 24 CP, authoritative groups, subject IDs and distinct codes", () => {
  const options = breadth("Mechanical Engineering");
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map(o => o.component.code)).size, 4);
  for (const option of options) {
    assert.equal(option.component.type, "SPECIALISATION");
    assert.equal(option.component.creditPoints, 24);
    const detail = fixture.components.find(c => c.component.id === option.component.id)!;
    assert.equal(detail.requirements.reduce((sum, g) => sum + (g.requiredCreditPoints ?? 0), 0), 24);
    assert.ok(detail.requirements.flatMap(g => g.items).every(i => i.subject?.id && i.subject.code));
  }
});

test("availability comes from all 12 formal stream graphs, including the six special cases", () => {
  const expected: Record<string, string[]> = {
    "Software Engineering": ["Humanitarian Engineering (Breadth)", "Innovation and Entrepreneurship (Breadth)"],
    "Civil Engineering": ["Engineering Data Science (Breadth)", "Innovation and Entrepreneurship (Breadth)", "Computer Systems (Breadth)"],
    "Electrical Engineering": ["Engineering Data Science (Breadth)", "Innovation and Entrepreneurship (Breadth)"],
    "Chemical and Biomolecular Engineering": ["Engineering Data Science (Breadth)"],
  };
  assert.equal(fixture.streams.length, 12);
  for (const detail of fixture.streams) {
    const options = breadth(detail.component.name);
    if (expected[detail.component.name]) assert.deepEqual(options.map(o => o.component.name), expected[detail.component.name]);
    else assert.equal(options.length, 4);
    const preview = resolve(detail);
    assert.deepEqual(preview.specialisations.filter(c => c.kind === "BREADTH_SPECIALISATION").map(c => c.component?.code).sort(),
      options.map(o => o.component.code).sort());
    assert.ok(preview.specialisations.filter(c => c.component).every(c => usydEngineeringSpecialisations(detail).some(o => o.component.id === c.component?.id)));
  }
});

test("Software Data Science and Civil Humanitarian preserve their separate Stream requirements", () => {
  for (const [name, match, cp] of [["Software Engineering", "Data Science", 30], ["Civil Engineering", "Humanitarian", 18]] as const) {
    const option = usydEngineeringSpecialisations(stream(name)).find(o => o.kind === "STREAM_SPECIALISATION" && o.component.name.includes(match))!;
    assert.equal(option.component.creditPoints, cp);
    assert.ok(!breadth(name).some(o => o.component.name.includes(match)));
    const sameNamedBreadth = breadth("Mechanical Engineering").find(o => o.component.name.includes(match))!;
    assert.notEqual(option.component.id, sameNamedBreadth.component.id);
    assert.notEqual(usydFormalFocusId(option), usydFormalFocusId(sameNamedBreadth));
  }
});

test("same-name Stream/Breadth aliases cannot merge and fabricated CUSP options cannot create eligibility", () => {
  const original = stream("Software Engineering");
  const dataScience = breadth("Mechanical Engineering").find(o => /Data Science/.test(o.component.name))!;
  const mixed = structuredClone(original);
  mixed.requirements.push({ ...mixed.requirements.at(-1)!, id: "both-kinds", title: "Optional Breadth specialisation", items: [
    { ...mixed.requirements.at(-1)!.items[0]!, component: dataScience.component },
  ] });
  const options = usydEngineeringSpecialisations(mixed);
  assert.equal(matchUsydEngineeringSpecialisation(options, "Engineering Data Science"), undefined);
  assert.equal(matchUsydEngineeringSpecialisation(options, "Engineering Data Science", "BREADTH_SPECIALISATION")?.component.id, dataScience.component.id);
  const fake: StudyPlan = { id: "fake-breadth", title: "Software Engineering: 99. Breadth Specialisation in Made Up",
    pathway: "Software Engineering", sourceUrl: null, description: null, years: [] };
  const result = resolveUsydEngineeringStudyPlanPreview({ stream: "Software Engineering", specialisation: "BASE", commencement: "STANDARD", planId: fake.id,
    plans: [...fixture.plans, fake], streamDetail: original });
  assert.ok(!result.specialisations.some(c => /Made Up/.test(c.label)));
  assert.notEqual(result.selectedPlan?.id, fake.id);
});

test("formal focus identity survives commencement switching and rejects foreign variant IDs for every stream", () => {
  for (const detail of fixture.streams) {
    for (const option of usydEngineeringSpecialisations(detail)) {
      const standard = resolve(detail, usydFormalFocusId(option));
      const mid = resolve(detail, usydFormalFocusId(option), "MID_YEAR", standard.selectedPlan?.id);
      assert.ok(standard.selectedPlan, `${detail.component.name}: ${option.component.name}`);
      assert.ok(mid.selectedPlan, `${detail.component.name} mid-year: ${option.component.name}`);
      assert.equal(mid.selectedCommencement, "MID_YEAR");
      assert.notEqual(mid.selectedPlan.id, standard.selectedPlan.id);
      assert.equal(mid.selectedPlan.totalCreditPoints, 192);
      assert.ok(mid.variants.every(v => v.plan.pathway === standard.selectedPlan?.pathway));
    }
  }
});

test("formal Course Structure selections seed an independent preview by code, with multiple selections kept academic", () => {
  const detail = stream("Software Engineering");
  const option = breadth(detail.component.name)[0]!;
  const selections = { [fixture.streamGroup.id]: detail.component.code, [option.requirementGroupId]: option.component.code };
  const before = structuredClone(selections);
  const academic = usydEngineeringAcademicSelection([fixture.streamGroup], selections, { [detail.component.code]: detail });
  assert.equal(academic.specialisations[0]?.kind, "BREADTH_SPECIALISATION");
  assert.equal(suggestUsydEngineeringStudyPlanPreview(academic, fixture.plans, detail)?.specialisation, usydFormalFocusId(option));
  resolve(detail, "BASE", "MID_YEAR");
  assert.deepEqual(selections, before);
  academic.specialisations.push({ code: "second", name: "Second" });
  assert.equal(suggestUsydEngineeringStudyPlanPreview(academic, fixture.plans, detail)?.specialisation, "BASE");
});

test("formal options remain visible with a missing roadmap, and saved title aliases migrate only when unique", () => {
  const detail = stream("Software Engineering");
  const option = breadth(detail.component.name)[0]!;
  const request = { stream: "Software Engineering", specialisation: usydFormalFocusId(option), commencement: "STANDARD" as const, planId: "", streamDetail: detail };
  const missing = resolveUsydEngineeringStudyPlanPreview({ ...request, plans: fixture.plans.filter(p => !p.title.includes("Humanitarian")) });
  assert.equal(missing.selectedSpecialisation, usydFormalFocusId(option));
  assert.equal(missing.selectedPlan, null);
  assert.equal(missing.resolution, "fallback");
  assert.equal(resolveUsydEngineeringStudyPlanPreview({ ...request, specialisation: "SPECIALISATION:humanitarian", plans: fixture.plans }).selectedSpecialisation, usydFormalFocusId(option));
});

test("a stale formal stream response cannot expose another stream's components", () => {
  const result = resolveUsydEngineeringStudyPlanPreview({ stream: "Civil Engineering", specialisation: "BASE", commencement: "STANDARD",
    planId: "", plans: fixture.plans, streamDetail: stream("Software Engineering") });
  assert.equal(result.selectedPlan, null);
  assert.deepEqual(result.specialisations, []);
});

test("focus groups and helper copy distinguish Base, Stream, Breadth and genuine alternative roadmaps", () => {
  assert.deepEqual(usydStudyPlanFocusGroups.map(g => g.label), ["Base roadmap", "Stream specialisations", "Breadth specialisations", "Other roadmaps"]);
  assert.match(usydStudyPlanFocusHelper("BREADTH_SPECIALISATION"), /24 CP/);
  const chemical = resolve(stream("Chemical and Biomolecular Engineering"));
  assert.equal(chemical.specialisations.filter(c => c.kind === "OTHER").length, 1);
  assert.ok(resolve(stream("Environmental Engineering")).specialisations.every(c => c.kind !== "OTHER"));
});

test("Breadth focus does not become a fake allocation pool or assume lazy source membership", () => {
  const detail = stream("Software Engineering");
  const option = breadth(detail.component.name)[0]!;
  const specialisation = fixture.components.find(c => c.component.id === option.component.id)!;
  const free: RequirementGroup = { ...fixture.streamGroup, id: "free", items: [], logic: "ANY", candidateSources: [{ id: "s", sourceKey: "s", title: "Table S units",
    type: "TABLE_SUBJECT_POOL", authoritative: true, tableName: "Table S", candidateCount: 1472 }, { id: "ug", sourceKey: "ug", title: "Engineering undergraduate units",
    type: "SUBJECT_FILTER", authoritative: true, tableName: null, candidateCount: 271 }] };
  const item = { id: "slot", itemType: "CHOICE" as const, subject: null, rawCode: null, title: "Free Electives", creditPoints: 6, numberOfPeriods: null, sortOrder: 0 };
  const scope = resolveUsydEngineeringChoice(item, [free], detail, specialisation, false);
  assert.equal(scope.defaultPoolGroupId, free.id);
  assert.deepEqual(scope.groups?.map(g => g.id), [free.id]);
  assert.equal(scope.groups?.[0]?.items.length, 0);
  assert.equal(scope.componentCodesByGroup?.[specialisation.requirements[0]!.id], undefined);
  assert.equal(resolveUsydEngineeringChoice({ ...item, title: "Stream Elective units" }, [free], detail, specialisation, false).kind, "UNRESOLVED");
  const elective = { ...free, id: "stream-only", title: "Stream Elective units", candidateSources: [], items: specialisation.requirements[0]!.items };
  const withStreamPool = { ...detail, requirements: [...detail.requirements, elective] };
  const streamOnly = resolveUsydEngineeringChoice({ ...item, title: "Stream Elective units" }, [free], withStreamPool, specialisation, false);
  assert.deepEqual(streamOnly.groups?.map(g => g.id), [elective.id]);
  const unavailable = { ...detail, requirements: detail.requirements.filter(g => !/Breadth/.test(g.title ?? "")) };
  assert.deepEqual(resolveUsydEngineeringChoice(item, [free], unavailable, specialisation, false).groups?.map(g => g.id), [free.id]);
});

test("repaired Mechanical Industrial Product Design retains three separate 6 CP requirements", () => {
  const ipd = fixture.components.find(c => c.component.name === "Industrial Product Design")!;
  assert.equal(ipd.requirements.length, 3);
  assert.deepEqual(ipd.requirements.map(g => g.requiredCreditPoints), [6, 6, 6]);
  assert.deepEqual(ipd.requirements.filter(g => g.logic === "ALL").flatMap(g => g.items.map(i => i.subject?.code)).sort(), ["AMME4401", "DECO2016"]);
  assert.deepEqual(ipd.requirements.find(g => g.logic === "ONE_OF")?.items.map(i => i.subject?.code), ["MECH4460", "AMME5902", "MECH5310"]);
});
