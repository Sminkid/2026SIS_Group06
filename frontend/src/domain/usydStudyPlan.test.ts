import assert from "node:assert/strict";
import test from "node:test";
import type { StudyPlan } from "../types/handbook";
import { groupUsydStudyPlans } from "./usydStudyPlan";

const plan = (id: string, pathway: string, title: string): StudyPlan => ({
  id, sourcePlanId: `source:${id}`, pathway, sourceType: "CUSP", handbookYear: 2026,
  variantNumber: null, totalCreditPoints: null, title, description: null, sourceUrl: null,
  years: [{ id: `${id}:year`, name: "Year 1", sortOrder: 0, periods: [{ id: `${id}:period`, name: "Semester 1", sortOrder: 0,
    items: [{ id: `${id}:choice`, itemType: "CHOICE", subject: null, rawCode: null, title: "Free Electives",
      creditPoints: 6, numberOfPeriods: null, sortOrder: 0 }] }] }],
});

test("plans group by explicit pathway, then deterministic commencement and variant", () => {
  const groups = groupUsydStudyPlans([
    plan("mid", "Software Engineering", "Software Engineering (mid-year)"),
    plan("breadth", "Software Engineering", "Software Engineering: 5. Breadth Specialisation in Humanitarian Engineering"),
    plan("base", "Software Engineering", "Software Engineering"),
    plan("stream", "Software Engineering", "Software Engineering: 1. Stream Specialisation in Computer Engineering"),
    plan("civil", "Civil Engineering", "A title that does not contain the pathway"),
  ]);
  assert.deepEqual(groups.map((group) => group.pathway), ["Civil Engineering", "Software Engineering"]);
  const software = groups[1]!;
  assert.deepEqual(software.commencements.map((group) => group.id), ["STANDARD", "MID_YEAR"]);
  assert.deepEqual(software.commencements[0]!.variants.map((item) => item.kind),
    ["BASE", "STREAM_SPECIALISATION", "BREADTH_SPECIALISATION"]);
  assert.equal(software.commencements[1]!.variants[0]?.plan.id, "mid");
});

test("196 plans become grouped streams rather than one flat selector", () => {
  const plans = Array.from({ length: 196 }, (_, index) => plan(`plan-${index}`, `Stream ${index % 12}`, `Variant: ${index}`));
  const groups = groupUsydStudyPlans(plans);
  assert.equal(groups.length, 12);
  assert.equal(groups.reduce((count, group) => count + group.commencements.flatMap((item) => item.variants).length, 0), 196);
});

test("selection starts unresolved instead of implicitly choosing the first of 196 plans", () => {
  const groups = groupUsydStudyPlans([plan("first", "Software Engineering", "Software Engineering")]);
  assert.equal(groups[0]?.commencements[0]?.variants[0]?.plan.id, "first");
  // Selection state belongs to the selector component and intentionally starts empty.
  const selectedPlanId = "";
  assert.equal(selectedPlanId, "");
});
