import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, DegreeDetailResponse, RequirementCandidateSubjectsResponse, RequirementCandidateSourceSummary, RequirementGroup, RequirementSubject, StudyPlan } from "../types/handbook";
import { adaptUsydEngineeringPlan, resolveUsydEngineeringChoice, usydGroups, usydPlannerContext } from "./usydEngineeringPlanner";
import { usydEngineeringSpecialisations, usydFormalFocusId } from "./usydEngineeringSpecialisations";
import { resolveUsydEngineeringStudyPlanPreview } from "./usydStudyPlan";
import { usydFocusInputs, usydFocusedSections, verifyUsydFocusMembership } from "./usydEngineeringChoiceFocus";
import { usydEngineeringProgress } from "./usydEngineeringProgress";
import { cloneOfficialPlan } from "../types/planner";
import { plannerItems } from "./plannerSwap";

const formal = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-breadth-2026.json", import.meta.url), "utf8")) as {
  components: ComponentDetailResponse[]; plans: StudyPlan[];
};
const captured = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-planner-2026.json", import.meta.url), "utf8")) as {
  degree: DegreeDetailResponse; streams: ComponentDetailResponse[]; layouts: StudyPlan[];
  evidence: Array<{ id: string; layoutIndex: number; creditPoints: number }>;
  memberships: Array<{ source: RequirementCandidateSourceSummary; codes: string[]; firstPage: RequirementCandidateSubjectsResponse }>;
};
const allSubjects = [...new Map(formal.components.flatMap(c => usydGroups(c.requirements).flatMap(g => g.items.flatMap(i => i.subject ? [i.subject] : []))).map(s => [s.code, s])).values()];
const proofs = captured.memberships.map(m => ({ sourceId: m.source.id, subjects: allSubjects.filter(s => m.codes.includes(s.code)) }));
const plans = formal.plans.map(plan => ({ ...plan, years: captured.layouts[captured.evidence.find(e => e.id === plan.id)!.layoutIndex]!.years }));
const units = (detail: ComponentDetailResponse) => usydGroups(detail.requirements).flatMap(g => g.items.flatMap(i => i.subject ? [i.subject] : []));
const component = (name: string, streamName?: string) => {
  const stream = captured.streams.find(s => s.component.name.toUpperCase().includes(streamName?.replace(/[-:]+/g, " ").trim() ?? ""));
  return formal.components.find(c => c.component.name === name && (!streamName || usydEngineeringSpecialisations(stream).some(option => option.component.id === c.component.id)))!;
};

test("read-only API evidence preserves all 196 actual 192 CP plans, 24 layouts and repaired mathematics", () => {
  assert.equal(plans.length, 196); assert.equal(captured.layouts.length, 24);
  for (const plan of plans) {
    assert.equal(captured.evidence.find(e => e.id === plan.id)!.creditPoints, 192);
    assert.equal(plan.years.flatMap(y => y.periods.flatMap(p => p.items)).reduce((sum, i) => sum + (i.subject?.creditPoints ?? i.creditPoints ?? 0), 0), 192);
    for (const item of plan.years.flatMap(y => y.periods.flatMap(p => p.items))) if (/^MATH106[12]$/.test(item.subject?.code ?? "")) assert.equal(item.subject?.creditPoints, 6);
  }
  assert.deepEqual(captured.memberships.map(m => m.source.candidateCount).sort((a,b) => a-b), [17, 271, 1472]);
});

for (const stream of captured.streams) test(`${stream.component.name}: every formal focus × commencement × variant has scoped eligibility and safe progress`, () => {
  const pathway = plans.find(p => p.pathway?.replace(/&/g, "and") === stream.component.name)!.pathway!;
  const choices = usydEngineeringSpecialisations(stream);
  const focusIds = ["BASE", ...choices.map(usydFormalFocusId)];
  const overview = resolveUsydEngineeringStudyPlanPreview({ stream: pathway, specialisation: "BASE", commencement: "STANDARD", planId: "", plans, streamDetail: stream });
  for (const other of overview.specialisations.filter(c => c.kind === "OTHER")) focusIds.push(other.id);
  const visited = new Set<string>();
  for (const focusId of focusIds) for (const commencement of ["STANDARD", "MID_YEAR"] as const) {
    const preview = resolveUsydEngineeringStudyPlanPreview({ stream: pathway, specialisation: focusId, commencement, planId: "", plans, streamDetail: stream });
    assert.equal(preview.selectedSpecialisation, focusId);
    for (const variant of preview.variants) {
      const exact = resolveUsydEngineeringStudyPlanPreview({ stream: pathway, specialisation: focusId, commencement, planId: variant.plan.id, plans, streamDetail: stream });
      assert.equal(exact.selectedPlan?.id, variant.plan.id); assert.equal(exact.selectedPlan?.pathway, pathway); visited.add(variant.plan.id);
      const focused = choices.find(c => usydFormalFocusId(c) === focusId);
      const detail = formal.components.find(c => c.component.id === focused?.component.id);
      const draft = adaptUsydEngineeringPlan(variant.plan);
      for (const slot of draft.years.flatMap(y => y.periods.flatMap(p => p.items)).filter(i => i.itemType === "CHOICE")) {
        const scope = resolveUsydEngineeringChoice(slot, captured.degree.requirements, stream, detail, false);
        const inputs = usydFocusInputs(slot, scope, stream, detail);
        if (!inputs) continue;
        const result = usydFocusedSections(inputs, proofs).flatMap(section => section.rows);
        const expected = inputs.subjects.filter(subject => subject.creditPoints !== null && subject.creditPoints > 0 && subject.creditPoints <= (inputs.capacity ?? Infinity)
          && inputs.groups.some(group => usydGroups([group]).some(member => member.items.some(i => i.subject?.id === subject.id)
            || member.candidateSources.some(source => proofs.some(proof => proof.sourceId === source.id && proof.subjects.some(s => s.id === subject.id))))));
        assert.deepEqual(result.map(row => row.subject.code).sort(), expected.map(s => s.code).sort());
        assert.equal(new Set(result.map(row => row.subject.code)).size, result.length);
        for (const row of result) assert.ok(row.eligibleGroupIds.every(id => scope.groups!.some(g => g.id === id)));
        assert.ok(scope.groups!.every(group => !detail?.requirements.some(formalGroup => formalGroup.id === group.id)));
      }
      if (detail) {
        const empty = usydEngineeringProgress(detail, []); const filled = usydEngineeringProgress(detail, units(detail));
        if (detail.requirements.some(g => g.logic === "UNKNOWN")) { assert.equal(empty.state, "manual"); assert.equal(filled.state, "manual"); }
        assert.ok(filled.observedCreditPoints <= [...new Map(units(detail).map(s => [s.code,s])).values()].reduce((sum,s) => sum+(s.creditPoints ?? 0),0));
      }
    }
  }
  assert.equal(visited.size, plans.filter(p => p.pathway === pathway).length);
});

for (const [name, parent, exactCodes, target] of [
  ["Engineering Data Science (Breadth)", undefined, ["DATA2001", "DATA2002", "STAT2011", "DATA3404"], 24],
  ["Humanitarian Engineering (Breadth)", undefined, ["CIVL3310", "CIVL5320", "ENGG3801", "PMGT3857"], 24],
  ["Innovation and Entrepreneurship (Breadth)", undefined, ["SIEN1000", "SIEN1001", "SIEN2001", "DECO2016"], 24],
  ["Computer Systems (Breadth)", undefined, ["ELEC1601", "ELEC2602", "ELEC3607", "ELEC3305"], 24],
  ["Engineering Data Science", "SOFTWARE", ["DATA2001", "DATA2002", "STAT2011", "DATA3404", "DATA3406"], 30],
  ["Humanitarian", "CIVIL", ["CIVL3310", "CIVL5320", "ENGG3801"], 18],
  ["Industrial Product Design", "MECHANICAL-ENGINEERING:", ["AMME4401", "MECH4460", "DECO2016"], 18],
] as Array<[string, string | undefined, string[], number]>) test(`${name} ${parent ?? ""}: empty/partial/exact/extra/move/holding/remove/reset/reload count unique subjects once`, () => {
  const detail = component(name, parent);
  assert.ok(detail, name);
  const exact = exactCodes.map(code => units(detail).find(s => s.code === code)!); assert.ok(exact.every(Boolean));
  assert.equal(usydEngineeringProgress(detail, []).state, "empty");
  assert.equal(usydEngineeringProgress(detail, exact.slice(0,1)).state, "partial");
  const progress = usydEngineeringProgress(detail, exact);
  assert.equal(progress.state, "met"); assert.equal(progress.creditedCreditPoints, target);
  const extra = units(detail).find(s => !exactCodes.includes(s.code))!;
  assert.equal(usydEngineeringProgress(detail, [...exact, extra, exact[0]!]).creditedCreditPoints, target);
  const planner = cloneOfficialPlan({ ...plans[0]!, years: [{ id:"test-year", name:"Year 1", sortOrder:0, periods:[{ id:"a", name:"Semester 1", sortOrder:0, items: exact.map((s,i) => ({ id:`item${i}`,itemType:"SUBJECT",subject:s,title:s.name,rawCode:s.code,creditPoints:s.creditPoints,numberOfPeriods:null,sortOrder:i })) }, { id:"b",name:"Semester 2",sortOrder:1,items:[] }] }] }, usydPlannerContext(2026,"BHENGINE-04"));
  const fromPlanner = () => [...plannerItems(planner), ...planner.unassignedItems].flatMap(i => i.subject ? [{...i.subject,id:i.subject.officialSubjectId}] : []);
  planner.years[0]!.periods[1]!.items.push(planner.years[0]!.periods[0]!.items.pop()!);
  assert.equal(usydEngineeringProgress(detail, fromPlanner()).state, "met");
  planner.unassignedItems.push(planner.years[0]!.periods[1]!.items.pop()!);
  assert.equal(usydEngineeringProgress(detail, fromPlanner()).state, "met");
  const reloaded = JSON.parse(JSON.stringify(planner));
  assert.equal(usydEngineeringProgress(detail, [...plannerItems(reloaded),...reloaded.unassignedItems].map(i=>({...i.subject!,id:i.subject!.officialSubjectId}))).state,"met");
  planner.unassignedItems = []; assert.equal(usydEngineeringProgress(detail, fromPlanner()).state,"partial");
  planner.years[0]!.periods[0]!.items = []; assert.equal(usydEngineeringProgress(detail, fromPlanner()).state,"empty");
});

test("UNKNOWN, missing records/CP, impossible bounds, overlap and inconsistent component totals never claim completion", () => {
  const original = component("Computer Systems (Breadth)");
  const selected = units(original);
  for (const mutate of [
    (d: ComponentDetailResponse) => { d.requirements[0]!.logic = "UNKNOWN"; },
    (d: ComponentDetailResponse) => { d.requirements[0]!.items[0]!.subject = null; },
    (d: ComponentDetailResponse) => { d.requirements[0]!.maximumCreditPoints = 6; },
    (d: ComponentDetailResponse) => { d.requirements[1]!.items.push(d.requirements[0]!.items[0]!); },
    (d: ComponentDetailResponse) => { d.component.creditPoints = 30; },
  ]) { const changed = structuredClone(original); mutate(changed); assert.equal(usydEngineeringProgress(changed, selected).state, "manual"); }
  assert.equal(usydEngineeringProgress(original, selected.map(s=>({...s,creditPoints:null}))).state,"manual");
});

test("whole-subject ANY bounds and ONE_OF semantics cannot be met with arbitrary CP sums", () => {
  const detail = structuredClone(component("Computer Systems (Breadth)"));
  detail.component.creditPoints = 9; detail.requirements = [detail.requirements[1]!];
  detail.requirements[0]!.requiredCreditPoints = 9; detail.requirements[0]!.maximumCreditPoints = 9;
  assert.notEqual(usydEngineeringProgress(detail,units(detail)).state,"met");
  detail.requirements[0]!.logic = "ANY"; assert.notEqual(usydEngineeringProgress(detail,units(detail)).state,"met");
});

test("foreign/absent focus and ineligible slots fall back; Humanitarian CIVL5330 is explicitly outside persisted Free Elective sources", () => {
  const software = captured.streams.find(s=>s.component.name==="Software Engineering")!;
  const focus = component("Humanitarian Engineering (Breadth)");
  const slot = { id:"free", itemType:"CHOICE" as const, title:"Free Electives", subject:null, rawCode:null, creditPoints:6, numberOfPeriods:null, sortOrder:0 };
  const scope = resolveUsydEngineeringChoice(slot,captured.degree.requirements,software,focus,false);
  assert.equal(usydFocusInputs(slot,scope,software,component("Computer","ELECTRICAL")),null);
  assert.equal(usydFocusInputs(slot,scope,software,undefined),null);
  const inputs = usydFocusInputs(slot,scope,software,focus)!;
  assert.equal(usydFocusedSections(inputs).length,0);
  assert.deepEqual(usydFocusedSections(inputs,proofs).flatMap(s=>s.rows.map(r=>r.subject.code)).sort(),["CIVL3310","CIVL5320","ENGG3801","PMGT3857"]);
});

test("Environmental Free Elective exception uses only that stream's persisted elective subjects and preserves 24 CP capacity", () => {
  const env = captured.streams.find(s=>s.component.name==="Environmental Engineering")!;
  const slot = { id:"free", itemType:"CHOICE" as const, title:"Free Electives", subject:null, rawCode:null, creditPoints:6, numberOfPeriods:null, sortOrder:0 };
  const envScope = resolveUsydEngineeringChoice(slot,captured.degree.requirements,env,undefined,false);
  assert.ok(envScope.groups![0]!.items.some(i=>i.subject?.code==="AMME5101"));
  assert.equal(envScope.groups![0]!.maximumCreditPoints,24);
  const mech = captured.streams.find(s=>s.component.name==="Mechanical Engineering")!;
  assert.equal(resolveUsydEngineeringChoice(slot,captured.degree.requirements,mech,undefined,false).groups![0]!.items.length,0);
});

test("membership lookups remain bounded, reject name-only/foreign results and honour cancellation", async () => {
  const stream = captured.streams.find(s=>s.component.name==="Software Engineering")!;
  const focus = component("Humanitarian Engineering (Breadth)");
  const slot = { id:"free", itemType:"CHOICE" as const, title:"Free Electives", subject:null, rawCode:null, creditPoints:6, numberOfPeriods:null, sortOrder:0 };
  const scope = resolveUsydEngineeringChoice(slot,captured.degree.requirements,stream,focus,false);
  const inputs = usydFocusInputs(slot,scope,stream,focus)!;
  let active=0,maximum=0,calls=0;
  const result = await verifyUsydFocusMembership(inputs,async (_source,subject) => {
    calls++; active++; maximum=Math.max(maximum,active); await new Promise(resolve=>setTimeout(resolve,1)); active--;
    return {...subject,code:"WRONG",id:"foreign"};
  },new AbortController().signal);
  assert.equal(result.length,0); assert.ok(maximum<=4); assert.equal(calls,inputs.subjects.length*inputs.sources.length);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(verifyUsydFocusMembership(inputs,async()=>null,aborted.signal),{name:"AbortError"});
});
