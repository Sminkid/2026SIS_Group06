import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ComponentDetailResponse, DegreeDetailResponse, RequirementCandidateSourceSummary, RequirementCandidateSubjectsResponse, StudyPlan } from "../src/types/handbook";
import { adaptUsydEngineeringPlan, resolveUsydEngineeringChoice, usydGroups } from "../src/domain/usydEngineeringPlanner";
import { usydEngineeringSpecialisations, usydFormalFocusId } from "../src/domain/usydEngineeringSpecialisations";
import { usydFocusedSections, usydFocusInputs } from "../src/domain/usydEngineeringChoiceFocus";
import { resolveUsydEngineeringStudyPlanPreview } from "../src/domain/usydStudyPlan";

const formal = JSON.parse(readFileSync(new URL("../src/domain/fixtures/usyd-engineering-breadth-2026.json", import.meta.url), "utf8")) as { components: ComponentDetailResponse[]; plans: StudyPlan[] };
const captured = JSON.parse(readFileSync(new URL("../src/domain/fixtures/usyd-engineering-planner-2026.json", import.meta.url), "utf8")) as {
  degree: DegreeDetailResponse; streams: ComponentDetailResponse[]; layouts: StudyPlan[];
  evidence: Array<{id: string; layoutIndex: number; creditPoints: number}>;
  memberships: Array<{source: RequirementCandidateSourceSummary; codes: string[]; firstPage: RequirementCandidateSubjectsResponse}>;
};
const plans = formal.plans.map(plan => ({...plan,years:captured.layouts[captured.evidence.find(e=>e.id===plan.id)!.layoutIndex]!.years}));
const allSubjects = [...new Map([...formal.components,...captured.streams].flatMap(c=>usydGroups(c.requirements).flatMap(g=>g.items.flatMap(i=>i.subject?[i.subject]:[]))).map(s=>[s.code,s])).values()];
const proofs = captured.memberships.map(m=>({sourceId:m.source.id,subjects:allSubjects.filter(s=>m.codes.includes(s.code))}));
const failures = new WeakMap<Page,string[]>();
const requests = new WeakMap<Page,URL[]>();
test.beforeEach(async ({page})=>{
  failures.set(page,[]); requests.set(page,[]); page.on("pageerror",error=>failures.get(page)!.push(error.message));
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url()); const path=url.pathname; let body:unknown;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    requests.get(page)!.push(url);
    if(path==="/api/universities") body=[captured.degree.degree.university];
    else if(path.includes("handbooks/latest")) body={year:2026};
    else if(/universities\/.*\/degrees$/.test(path)) body=[captured.degree.degree];
    else if(path.endsWith("/study-plans")) body=plans;
    else if(path.includes("/degrees/")) body=captured.degree;
    else if(path.includes("/components/")) body=[...captured.streams,...formal.components].find(c=>[c.component.id,c.component.code].includes(decodeURIComponent(path.split("/").at(-1)!)));
    else if(path.includes("requirement-candidate-sources")) {
      const pool=captured.memberships.find(m=>m.source.id===path.split("/").at(-2))!;
      const query=url.searchParams.get("q")?.toLowerCase() ?? "";
      const subjects=query ? [...new Map([...pool.firstPage.subjects,...allSubjects.filter(s=>pool.codes.includes(s.code))].map(s=>[s.code,s])).values()].filter(s=>`${s.code} ${s.name}`.toLowerCase().includes(query)) : pool.firstPage.subjects;
      body={candidateSource:pool.source,subjects,pagination:{page:1,limit:20,total:query?subjects.length:pool.source.candidateCount,totalPages:query?1:Math.ceil(pool.source.candidateCount/20)}};
    } else if(path.endsWith("access-conditions/batch")) body={};
    else if(path.includes("/subjects/")) { const code=decodeURIComponent(path.split("/").at(-1)!); body={...allSubjects.find(s=>s.code===code),code,name:code,creditPoints:6,prerequisiteStatus:"NO_CONDITIONS",accessConditions:null,offerings:null,sourceUrl:null,description:null}; }
    if(body===undefined) throw Error(`Unhandled USYD acceptance API: ${path}`);
    await route.fulfill({json:body});
  });
});
test.afterEach(async ({page})=>{ expect(failures.get(page)).toEqual([]); });
async function open(page:Page) { await page.goto("/"); await page.locator(".university-card").filter({hasText:"USYD"}).click(); await page.locator(".degree-row").filter({hasText:"BHENGINE-04"}).click(); }
const focusControl=(page:Page)=>page.getByRole("combobox",{name:"Study plan focus",exact:true});
const academicStorage=(page:Page)=>page.evaluate(()=>localStorage.getItem("degree-planner:components:USYD:2026:BHENGINE-04"));

for(const stream of captured.streams) test(`${stream.component.name}: all focus/commencement variants in the browser`,async({page})=>{
  test.setTimeout(180_000);
  page.setDefaultTimeout(10_000);
  await open(page);
  const pathway=plans.find(p=>p.pathway?.replace(/&/g,"and")===stream.component.name)!.pathway!;
  await page.getByRole("combobox",{name:"Engineering Stream",exact:true}).selectOption(pathway);
  await expect(focusControl(page)).toHaveValue("BASE");
  const before=await academicStorage(page);
  const options=usydEngineeringSpecialisations(stream);
  const overview=resolveUsydEngineeringStudyPlanPreview({stream:pathway,specialisation:"BASE",commencement:"STANDARD",planId:"",plans,streamDetail:stream});
  const focuses=[...overview.specialisations];
  const visited=new Set<string>();
  for(const focus of focuses) for(const commencement of ["STANDARD","MID_YEAR"] as const) {
    await focusControl(page).selectOption(focus.id);
    await page.getByRole("combobox",{name:"Commencement",exact:true}).selectOption(commencement);
    const preview=resolveUsydEngineeringStudyPlanPreview({stream:pathway,specialisation:focus.id,commencement,planId:"",plans,streamDetail:stream});
    for(const variant of preview.variants) {
      await page.getByRole("combobox",{name:"Study plan variant",exact:true}).selectOption(variant.plan.id);
      await expect(page.locator(`[data-usyd-plan-id="${variant.plan.id}"]`)).toBeVisible();
      await expect(page.getByRole("button",{name:"Customize Plan",exact:true})).toBeVisible();
      visited.add(variant.plan.id);
      const option=options.find(o=>usydFormalFocusId(o)===focus.id);
      const detail=formal.components.find(c=>c.component.id===option?.component.id);
      if(detail) {
        await expect(page.getByRole("complementary",{name:"Roadmap focus summary"})).toContainText(detail.component.name);
        await expect(page.getByRole("complementary",{name:"Roadmap focus summary"})).toContainText("keeps elective slots open");
      } else await expect(page.getByRole("complementary",{name:"Roadmap focus summary"})).toHaveCount(0);
      await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
      await expect(page.getByRole("region",{name:"Personal plan summary"})).toContainText("/ 192 CP selected");
      await expect(page.getByRole("region",{name:"Formal specialisation progress"})).toHaveCount(0);
      const slots=adaptUsydEngineeringPlan(variant.plan).years.flatMap(y=>y.periods.flatMap(p=>p.items)).filter(i=>i.itemType==="CHOICE");
      const contexts=slots.map(slot=>{
        const scope=resolveUsydEngineeringChoice(slot,captured.degree.requirements,stream,detail,false);
        const inputs=usydFocusInputs(slot,scope,stream,detail);
        return {slot,scope,sections:inputs?usydFocusedSections(inputs,proofs):[]};
      });
      const context=contexts.find(c=>c.sections.length) ?? contexts.find(c=>c.scope.kind==="FORMAL");
      if(context) {
        await page.locator(`[data-planner-item-id="official:${context.slot.id}"]`).getByRole("button",{name:"Choose",exact:true}).click();
        const dialog=page.getByRole("dialog",{name:"Choose a subject",exact:true});
        const pool=dialog.getByLabel("Eligible pool",{exact:true});
        if(context.sections.length) {
          await expect(pool).toHaveValue(`focus:${detail!.component.code}`);
          await expect(dialog.getByText("Checking specialisation subjects against this slot",{exact:true})).toHaveCount(0);
          const expected=context.sections.flatMap(s=>s.rows.map(r=>r.subject.code)).sort();
          await expect.poll(async()=>dialog.locator("[data-candidate-code]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-candidate-code")).sort())).toEqual(expected);
          const code=expected[0]!;
          await dialog.getByRole("searchbox").fill(code); await dialog.getByRole("button",{name:"Search eligible subjects",exact:true}).click();
          await expect(dialog.locator("[data-candidate-code]")).toHaveCount(1);
          await dialog.getByRole("searchbox").fill(""); await dialog.getByRole("button",{name:"Search eligible subjects",exact:true}).click();
          await expect(dialog.locator("[data-candidate-code]")).toHaveCount(expected.length);
        } else await expect(pool).toHaveValue(context.scope.defaultPoolGroupId ?? "");
        await pool.selectOption(""); await expect(dialog.locator("[data-candidate-code]").first()).toBeVisible();
        await dialog.getByRole("button",{name:"Close subject selector"}).click();
      }
      expect(await academicStorage(page)).toBe(before);
    }
  }
  expect(visited.size).toBe(plans.filter(p=>p.pathway===pathway).length);
  expect(requests.get(page)!.filter(url=>url.pathname.includes("requirement-candidate-sources")).every(url=>url.searchParams.get("limit")==="20")).toBe(true);
});

test("formal Breadth progress persists under Base and a different manual focus; selected subjects survive holding, reload, remove and reset",async({page})=>{
  await open(page);
  const stream=captured.streams.find(s=>s.component.name==="Software Engineering")!;
  const option=usydEngineeringSpecialisations(stream).find(o=>o.component.name==="Humanitarian Engineering (Breadth)")!;
  const course=page.getByRole("button",{name:/Engineering Stream.*120 credit points.*Choose one/i}).locator("..");
  await course.getByRole("radio",{name:/Software Engineering/}).check();
  const breadth=course.getByRole("button",{name:/Optional Breadth specialisation/}).locator("..");
  await breadth.getByRole("button",{name:/Optional Breadth specialisation/}).click();
  await breadth.getByRole("radio",{name:/Humanitarian Engineering \(Breadth\)/}).check();
  await expect(focusControl(page)).toHaveValue(usydFormalFocusId(option));
  await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
  const progress=page.getByRole("region",{name:"Humanitarian Engineering (Breadth) formal progress"});
  await expect(progress).toContainText("0 / 24 CP");
  const choice=page.locator(".plan-item--choice").filter({hasText:/Free Electives/}).first();
  await choice.getByRole("button",{name:"Choose",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Choose a subject",exact:true});
  await expect(dialog.locator('[data-candidate-code="CIVL3310"]')).toHaveCount(1);
  await dialog.locator('[data-candidate-code="CIVL3310"]').getByRole("button",{name:"Select",exact:true}).click();
  await expect(progress).toContainText("6 / 24 CP");
  const summaryCard=page.getByRole("region",{name:"Personal plan summary"});
  await expect(summaryCard.locator("summary")).toContainText("Review plan warnings");
  const warningCount=await summaryCard.locator("[data-usyd-plan-warning]").count();
  const noteCount=await summaryCard.locator("[data-usyd-verification-note]").count();
  await expect(summaryCard).toContainText(`${warningCount} plan warnings`);
  await expect(summaryCard.locator("summary")).toContainText(`Review plan warnings (${warningCount})`);
  if(noteCount) {
    await expect(summaryCard).toContainText(`${noteCount} verification notes`);
    await expect(summaryCard.locator("summary")).toContainText(`verification notes (${noteCount})`);
  }
  const summary=await summaryCard.textContent();
  const selected=page.locator(".plan-item--filled").filter({hasText:"CIVL3310"});
  const period=selected.locator("xpath=ancestor::*[contains(@class,'study-plan-period')]");
  if(await period.count()) await period.getByRole("button",{name:"Clear movable subjects from period"}).click();
  else { const parent=selected.locator("xpath=ancestor::section[1]"); await parent.getByRole("button",{name:"Clear movable subjects from period"}).click(); }
  await expect(progress).toContainText("6 / 24 CP");
  await page.reload();
  await page.locator(".university-card").filter({hasText:"USYD"}).click();
  await page.locator(".degree-row").filter({hasText:"BHENGINE-04"}).click();
  await expect(progress).toContainText("6 / 24 CP");
  await page.locator(".plan-item--filled").filter({hasText:"CIVL3310"}).getByRole("button",{name:"Remove subject & restore choice"}).click();
  await expect(progress).toContainText("0 / 24 CP");
  const before=await academicStorage(page);
  await focusControl(page).selectOption("BASE"); await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
  await expect(progress).toContainText("0 / 24 CP"); expect(await academicStorage(page)).toBe(before);
  await page.getByRole("button",{name:"Reset to official plan",exact:true}).click(); await expect(progress).toContainText("0 / 24 CP");
  await page.getByRole("button",{name:"Remove personal draft",exact:true}).click();
  await expect(page.getByText("Personal draft removed.",{exact:true})).toBeVisible();
  await expect(page.getByText("Personal draft removed.",{exact:true})).toHaveCount(0,{timeout:7000});
  const other=usydEngineeringSpecialisations(stream).find(o=>o.component.name==="Innovation and Entrepreneurship (Breadth)")!;
  await focusControl(page).selectOption(usydFormalFocusId(other));
  await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
  await expect(progress).toBeVisible();
  await expect(page.getByRole("region",{name:"Innovation and Entrepreneurship (Breadth) formal progress"})).toHaveCount(0);
  expect(await academicStorage(page)).toBe(before);
  await course.getByRole("radio",{name:/Civil Engineering/}).check();
  await page.getByRole("combobox",{name:"Engineering Stream",exact:true}).selectOption("Civil Engineering");
  await expect(focusControl(page)).toHaveValue("BASE");
  await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
  await expect(progress).toHaveCount(0);
  expect(summary).toContain("/ 192 CP selected");
});

test("focused membership failure falls back to the normal pool and retry restores a verified focused view",async({page})=>{
  let fail=true;
  await page.route("**/api/requirement-candidate-sources/**",async route=>{
    if(fail && new URL(route.request().url()).searchParams.has("q")) await route.fulfill({status:503,json:{error:"Membership unavailable"}});
    else await route.fallback();
  });
  await open(page);
  const stream=captured.streams.find(s=>s.component.name==="Software Engineering")!;
  const option=usydEngineeringSpecialisations(stream).find(o=>o.component.name==="Humanitarian Engineering (Breadth)")!;
  await page.getByRole("combobox",{name:"Engineering Stream",exact:true}).selectOption("Software Engineering");
  await focusControl(page).selectOption(usydFormalFocusId(option));
  await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
  await page.locator(".plan-item--choice").filter({hasText:/Free Electives/}).first().getByRole("button",{name:"Choose",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Choose a subject",exact:true});
  await expect(dialog).toContainText("Couldn't verify all focused subjects");
  await expect(dialog.getByLabel("Eligible pool",{exact:true})).not.toHaveValue(`focus:${option.component.code}`);
  await dialog.getByLabel("Eligible pool",{exact:true}).selectOption("");
  await expect(dialog.locator("[data-candidate-code]").first()).toBeVisible();
  fail=false;
  await dialog.getByRole("button",{name:"Try again",exact:true}).click();
  await expect(dialog.getByText("Couldn't verify all focused subjects. Existing eligible pools remain available.",{exact:true})).toHaveCount(0);
  await dialog.getByLabel("Eligible pool",{exact:true}).selectOption(`focus:${option.component.code}`);
  await expect(dialog.locator("[data-candidate-code]")).toHaveCount(4);
});

test("UNKNOWN Computational requirements show manual progress even when every listed unit is planned",async({page})=>{
  await open(page);
  const course=page.getByRole("button",{name:/Engineering Stream.*120 credit points.*Choose one/i}).locator("..");
  await course.getByRole("radio",{name:/^Mechanical Engineering stream/i}).check();
  const spec=course.getByRole("region",{name:"Selected stream"}).getByRole("button",{name:/^Specialisation/}).locator("..");
  await spec.getByRole("button",{name:/^Specialisation/}).click();
  await spec.getByRole("radio",{name:/Computational/}).check();
  await page.getByRole("button",{name:"Customize Plan",exact:true}).click();
  const progress=page.getByRole("region",{name:"Computational formal progress"});
  await expect(progress).toContainText("manual verification required");
  await expect(progress).not.toContainText("Structured requirement CP met");
  const stream=captured.streams.find(s=>s.component.name==="Mechanical Engineering")!;
  const reference=usydEngineeringSpecialisations(stream).find(o=>o.component.name==="Computational")!.component;
  const component=formal.components.find(c=>c.component.id===reference.id)!;
  await page.evaluate(subjects=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith("planner:USYD"))!;
    const stored=JSON.parse(localStorage.getItem(key)!);
    stored.unassignedItems=subjects.map((subject,i)=>({plannerItemId:`manual-${i}`,officialItemId:`manual-${i}`,originalPeriodId:stored.years[0].periods[0].officialPeriodId,itemType:"SUBJECT",subject:{...subject,officialSubjectId:subject.id},title:subject.name,rawCode:subject.code,creditPoints:subject.creditPoints,numberOfPeriods:null,choiceOrigin:null,officialSortOrder:i}));
    localStorage.setItem(key,JSON.stringify(stored));
  },[...new Map(component.requirements.flatMap(g=>g.items.flatMap(i=>i.subject?[i.subject]:[])).map(s=>[s.code,s])).values()]);
  await open(page);
  await expect(progress).toContainText("manual verification required");
  await expect(progress).not.toContainText("Structured requirement CP met");
});
