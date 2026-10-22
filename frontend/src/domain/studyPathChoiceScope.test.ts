import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ComponentDetailResponse, DegreeDetailResponse, RequirementGroup, StudyPlanItem } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import { resolveStudyPathChoiceScope } from "./studyPathChoiceScope";

const group = (id: string, title: string, extra: Partial<RequirementGroup> = {}): RequirementGroup => ({
  id, title, description: null, logic: "ALL", requiredCreditPoints: 12, maximumCreditPoints: null, sortOrder: null,
  items: [], candidateSources: [], children: [], pathways: [], ...extra,
});

// A pathway whose first 12 CP is a component choice and next 12 CP are electives, filled by four 6 CP slots.
const degree = group("degree", "Course structure", {
  children: [group("component", "Sub-major"), group("electives", "Electives")],
  pathways: [{ id: "path", title: "Sub-major + electives", requiredCreditPoints: 24, selections: [
    { requirementGroupId: "component", selectionType: "COMPONENT", requiredSelections: 1, requiredCreditPoints: 12 },
    { requirementGroupId: "electives", selectionType: "ELECTIVE_ALLOCATION", requiredSelections: 1, requiredCreditPoints: 12 },
  ] }],
});
const selections = { degree: "PATHWAY:path" };

const slot = (index: number, subjectPoints?: number) => ({
  plannerItemId: `slot-${index}`, title: "Choice", itemType: subjectPoints ? "SUBJECT" : "CHOICE",
  creditPoints: subjectPoints ?? 6,
  subject: subjectPoints ? { officialSubjectId: `s${index}`, code: `S${index}`, name: "Short subject", creditPoints: subjectPoints } : null,
  choiceOrigin: { officialChoiceItemId: `slot-${index}`, title: "Choice", rawCode: null, creditPoints: 6, originalPeriodId: "p1" },
});
const plannerWith = (items: ReturnType<typeof slot>[]) =>
  ({ years: [{ periods: [{ items }] }], unassignedItems: [] }) as unknown as PlannerState;
const asChoice = (item: ReturnType<typeof slot>) =>
  ({ id: item.plannerItemId, itemType: "CHOICE", subject: null, rawCode: null, title: item.title, creditPoints: 6,
    numberOfPeriods: null, sortOrder: null, choiceOrigin: item.choiceOrigin }) as StudyPlanItem;

test("pathway slots map by their own size, so a smaller subject in an earlier slot doesn't shift later slots", () => {
  const empty = [0, 1, 2, 3].map(index => slot(index));
  assert.equal(resolveStudyPathChoiceScope(asChoice(empty[2]), [degree], {}, selections, plannerWith(empty)).kind, "BROAD");

  // A 3 CP subject in the first 6 CP slot: the third slot still belongs to the electives, not the sub-major.
  const withShort = [slot(0, 3), slot(1), slot(2), slot(3)];
  const scope = resolveStudyPathChoiceScope(asChoice(withShort[2]), [degree], {}, selections, plannerWith(withShort));
  assert.equal(scope.kind, "BROAD");
  assert.equal(scope.requirementGroupId, "electives");
  assert.equal(resolveStudyPathChoiceScope(asChoice(withShort[1]), [degree], {}, selections, plannerWith(withShort)).kind, "UNRESOLVED");
});

// --- UTS Engineering "Electives" branch: Free Elective / Transdisciplinary slots
const fixture = JSON.parse(readFileSync(new URL("./fixtures/handbook-2026.json", import.meta.url), "utf8")) as { engineering: DegreeDetailResponse };
const engineering = fixture.engineering.requirements;
const allGroups = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap(member => [member, ...allGroups(member.children)]);
const byTitle = (title: string) => allGroups(engineering).find(member => member.title === title)!;
const electivesBranch = byTitle("Electives");
const freeElectives = allGroups([electivesBranch]).find(member => member.title === "Free Electives")!;
const subMajors = allGroups([electivesBranch]).find(member => member.title === "Sub-Majors")!;
const electiveSelections = { [byTitle("Electives or Specialist Stream").id]: `GROUP:${electivesBranch.id}` };

const detail = (code: string, name: string, subjects: string[]): ComponentDetailResponse => ({
  component: { id: `id-${code}`, code, name, type: "SUB_MAJOR", originalType: null, creditPoints: 24, sourceUrl: null, handbookYear: 2026,
    university: { id: "uts", code: "UTS", name: "UTS" } },
  requirements: [group(`${code}-options`, "Options", { logic: "ANY", items: subjects.map(subject => ({
    id: `${code}-${subject}`, itemType: "SUBJECT", subject: { id: subject, code: subject, name: subject, creditPoints: 6 },
  })) as unknown as RequirementGroup["items"] })],
});
const choiceSlot = (title: string) => ({ id: title, itemType: "CHOICE", subject: null, rawCode: null, title, creditPoints: 6,
  numberOfPeriods: null, sortOrder: null,
  choiceOrigin: { officialChoiceItemId: title, title, rawCode: null, creditPoints: 6, originalPeriodId: "p" } }) as StudyPlanItem;

test("a Free Elective or Sub-major slot without a sub-major is a free elective search", () => {
  const scope = resolveStudyPathChoiceScope(choiceSlot("Free Elective or Sub-major"), engineering, {}, electiveSelections, null);
  assert.equal(scope.kind, "BROAD");
  assert.equal(scope.requirementGroupId, freeElectives.id);
});

test("with a sub-major chosen, the slot lists its subjects and still offers a free elective search", () => {
  const subMajor = detail("SMJ03060", "Computer Science", ["31251", "41900"]);
  const scope = resolveStudyPathChoiceScope(choiceSlot("Free Elective or Sub-major"), engineering,
    { SMJ03060: subMajor }, { ...electiveSelections, [subMajors.id]: "SMJ03060" }, null);
  assert.equal(scope.kind, "FORMAL");
  assert.equal(scope.componentCode, "SMJ03060");
  assert.equal(scope.broadSearch?.group?.id, freeElectives.id);
});

test("a Transdisciplinary Elective slot lists the linked Transdisciplinary Electives stream", () => {
  const stream = detail("CBK92069", "Transdisciplinary Electives", ["95001", "95002"]);
  const scope = resolveStudyPathChoiceScope(choiceSlot("Transdisciplinary Elective or Sub-major"), engineering,
    { CBK92069: stream }, electiveSelections, null);
  assert.equal(scope.kind, "FORMAL");
  assert.equal(scope.componentCode, "CBK92069");
  assert.deepEqual(scope.groups, stream.requirements);
});
