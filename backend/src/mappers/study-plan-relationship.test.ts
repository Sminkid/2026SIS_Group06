import assert from "node:assert/strict";
import test from "node:test";
import { attachMajorRelationships } from "./study-plan-relationship.js";
import type { StudyPlanSummary } from "../types/study-plan.js";

const plan: StudyPlanSummary = { id: "plan", title: "Data Science Engineering major, Autumn commencing, full time", description: null, sourceUrl: null,
  years: [{ id: "year", name: "Year 1", sortOrder: 0, periods: [{ id: "period", name: "Autumn", sortOrder: 0, items: [{ id: "item", itemType: "SUBJECT",
    subject: { id: "subject", code: "41082", name: "Example", creditPoints: 6 }, rawCode: null, title: "Example", creditPoints: 6, numberOfPeriods: null, sortOrder: 0 }] }] }] };
test("A variant relationship requires exact major identity and corroborating subject IDs", () => {
  const major = { id: "major", code: "M", name: "Data Science Engineering", subjectIds: ["subject"] };
  assert.equal(attachMajorRelationships([plan], [major])[0]!.major?.id, major.id);
  assert.equal(attachMajorRelationships([plan], [{ ...major, subjectIds: [] }])[0]!.major, null);
  assert.equal(attachMajorRelationships([plan], [{ ...major, name: "Science Engineering" }])[0]!.major, null);
  assert.equal(attachMajorRelationships([plan], [major, { ...major, id: "duplicate" }])[0]!.major, null);
});
