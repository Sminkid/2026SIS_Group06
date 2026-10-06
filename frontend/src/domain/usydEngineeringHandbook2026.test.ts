import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse } from "../types/handbook";
import { usydEngineeringSpecialisations } from "./usydEngineeringSpecialisations";
import { usydEngineeringProgress } from "./usydEngineeringProgress";

const formal = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-breadth-2026.json", import.meta.url), "utf8")) as { components: ComponentDetailResponse[] };
const captured = JSON.parse(readFileSync(new URL("./fixtures/usyd-engineering-planner-2026.json", import.meta.url), "utf8")) as { streams: ComponentDetailResponse[] };
// Independently transcribed membership facts from official 2026 handbook tables; links and limits are recorded in the provenance markdown.
const dsFirst = ["DATA2001","DATA2901","DATA2002","DATA2902","STAT2011","STAT2911"];
const dsSecond = ["COMP3308","COMP3608","DATA3404","DATA3406"];
const computerOptions = ["COMP3520","ELEC3104","ELEC3404","ELEC5405"];
const intelligentOptions = ["ELEC5305","ELEC5306","ELEC5308","ELEC5516","ELEC5517"];
const iotOptions = ["COMP4447","COMP4216","COMP4426","ELEC5208","ELEC5508","ELEC5616","ELEC5760"];
const ipd = [["AMME4401"],["MECH4460","AMME5902","MECH5310"],["DECO2016"]];
const computational = [["AMME4060","AMME5202","AMME5271"],["AMME5202","AMME5271","AMME4912"]];
const robotics = [["AMME5710","AMME5520","MECH5720"],["BMET4790","COMP3308","COMP4318"]];
const research = [["AERO2711","AERO3711","AERO4711","AERO5700"]];
// Live Edge DOM on 5 October includes AMME5710; the web text cache omitted that row.
const systems = [["AERO5200","AERO5206","AERO5400","AERO5500","AERO5750","AMME5060","AMME5520","AMME5710","AMME5902","MECH5461"],["AERO4260","AERO4360","AERO4560"]];
const cases: Array<[string | null,string,string[][]]> = [
  [null,"Engineering Data Science (Breadth)",[dsFirst,dsSecond]],
  [null,"Humanitarian Engineering (Breadth)",[["CIVL3310","CIVL5320"],["CIVL5330","ENGG3801","PMGT3857"]]],
  [null,"Innovation and Entrepreneurship (Breadth)",[["SIEN1000","SIEN1001","SIEN2001"],["ENGG3216","SIEN3001","PMGT3856","INFS2030","SIEN2210","MKTG3114","MKTG3120","CLAW2209","SIEN3204","DECO2016","DECO2015"]]],
  [null,"Computer Systems (Breadth)",[["ELEC1601","ELEC2602","ELEC3607"],["ELEC3608","ELEC3305"]]],
  ["Software Engineering","Computer",[["ELEC2602","ELEC3506","ELEC3607","ELEC3608"],[...computerOptions,"ELEC3304","ELEC3305"]]],
  ["Software Engineering","Engineering Data Science",[dsFirst,dsSecond]],
  ["Software Engineering","Intelligent Information Engineering",[["ELEC3506","ELEC5304","ELEC5307","ELEC5622"],["ELEC3305",...intelligentOptions]]],
  ["Software Engineering","Internet Things",[["ELEC3506","ELEC5514","ELEC5517","ELEC5518"],[...iotOptions,"ELEC5509"]]],
  ["Civil Engineering","Humanitarian",[["CIVL3310"],["CIVL5320","CIVL5330","ENGG3801"]]],
  ["Civil Engineering","Geotechnical",[["CIVL3411"],["CIVL5351","CIVL5452","CIVL5458","CIVL5460","CIVL5999"]]],
  ["Electrical Engineering","Computer",[["INFO1113","COMP2017","ELEC3607","ELEC3608"],computerOptions]],
  ["Electrical Engineering","Intelligent Information",[["ELEC5304","ELEC5307","ELEC5622"],intelligentOptions]],
  ["Electrical Engineering","Internet Things",[["ELEC5509","ELEC5514","ELEC5517","ELEC5518"],iotOptions]],
  ["Environmental Engineering","Chemical",[["CHNG5006","CHNG5604","CHNG5601"]]],
  ["Environmental Engineering","Geotechnical",[["CIVL3411"],["CIVL5452","CIVL5458","CIVL5460","CIVL5999"]]],
  ["Environmental Engineering","Energy Environment",[["AMME5101"],["AMME5202","MECH5255","MECH5265","AMME5292","MECH5275"]]],
  ["Mechanical Engineering","Industrial Product Design",ipd],
  ["Mechanical Engineering with Space","Industrial Product Design",ipd],
  ["Mechanical Engineering","Computational",computational],
  ["Mechanical Engineering with Space","Computational",computational],
  ["Mechatronic Engineering","Robotics Intelligent Systems",robotics],
  ["Mechatronic Engineering with Space","Robotics Intelligent Systems",robotics],
  ["Aeronautical Engineering","Aerospace Research",research],
  ["Aeronautical Engineering with Space","Aerospace Research",research],
  ["Aeronautical Engineering","Aerospace Systems",systems],
  ["Aeronautical Engineering with Space","Aerospace Systems",systems],
  ["Biomedical Engineering","Biocomputation",[["BMET2925","BMET3997","BMET5790","BMET5933","BMET5934","BMET5995","BMET5996"]]],
  ["Biomedical Engineering","Biomedical Modelling Design",[["AMME2301","BMET2400","BMET4981","MECH3361"],["BMET5907","BMET5944"]]],
  ["Biomedical Engineering","Bionics Bioelectronics",[["BMET3802","BMET5957","BMET5995"],["BMET3997","BMET5790","BMET5911","BMET5934","BMET5959","BMET5996"]]],
  ["Biomedical Engineering","Nanoscale Biotechnology",[["BMET3962"],["BMET5911","BMET5931","BMET5935","BMET5944","BMET5958","BMET5959","BMET5963","BMET5964"]]],
];
for(const [parent,name,expected] of cases) test(`official 2026 membership: ${parent ?? "Breadth"} / ${name}`,()=>{
  const stream = captured.streams.find(s=>s.component.name===parent);
  const reference = usydEngineeringSpecialisations(stream).find(option=>option.component.name===name)?.component;
  const detail = formal.components.find(c=>reference ? c.component.id===reference.id : c.component.name===name)!;
  assert.ok(detail,`${parent}/${name}`);
  assert.deepEqual(detail.requirements.map(group=>group.items.flatMap(i=>i.subject?[i.subject.code]:[]).sort()),expected.map(codes=>[...codes].sort()));
  if(detail.requirements.some(g=>g.logic==="UNKNOWN")) assert.equal(usydEngineeringProgress(detail,detail.requirements.flatMap(g=>g.items.flatMap(i=>i.subject?[i.subject]:[]))).state,"manual");
});

test("similar names under different stream parents retain independent identities and official requirement rows",()=>{
  for(const [left,right,pattern] of [["Software Engineering","Electrical Engineering",/^Computer$/],["Software Engineering","Electrical Engineering",/^Intelligent/],["Software Engineering","Electrical Engineering",/^Internet/],["Civil Engineering","Environmental Engineering",/^Geotechnical$/],["Mechanical Engineering","Environmental Engineering",/^Energy Environment$/]] as const) {
    const a=usydEngineeringSpecialisations(captured.streams.find(s=>s.component.name===left)).find(o=>pattern.test(o.component.name))!;
    const b=usydEngineeringSpecialisations(captured.streams.find(s=>s.component.name===right)).find(o=>pattern.test(o.component.name))!;
    assert.notEqual(a.component.id,b.component.id); assert.notEqual(a.component.code,b.component.code);
    assert.notDeepEqual(formal.components.find(c=>c.component.id===a.component.id)!.requirements,formal.components.find(c=>c.component.id===b.component.id)!.requirements);
  }
});
