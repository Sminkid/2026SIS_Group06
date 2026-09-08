import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missingSubjectCodes, resolveSubjectReferences } from "./subject-reference.js";
import type { DegreeRequirementGroup } from "../types/degree.js";
const fixture = JSON.parse(readFileSync(new URL("../../../frontend/src/domain/fixtures/accounting-placement-audit.json", import.meta.url), "utf8"));
const groups = fixture.details.SMJ08109.requirements as DegreeRequirementGroup[];
const subject = { id: "verified-imported-id", code: "21228", name: "Management Consulting", creditPoints: 6 };
test("missing stable code resolves only to a unique supplied real Subject record", () => {
  assert.deepEqual(missingSubjectCodes(groups), ["21228"]);
  const resolved = resolveSubjectReferences(groups, [subject]);
  assert.equal(resolved.flatMap(group => group.items).find(item => item.rawCode === "21228")?.subject?.id, subject.id);
  assert.deepEqual(missingSubjectCodes(resolved), []);
  assert.deepEqual(missingSubjectCodes(groups), ["21228"]);
});
test("missing, ambiguous or description-only references never create candidates", () => {
  assert.deepEqual(resolveSubjectReferences(groups, []), groups);
  assert.deepEqual(resolveSubjectReferences(groups, [subject, { ...subject, id: "ambiguous" }]), groups);
  const prose = structuredClone(groups);
  const item = prose.flatMap(group => group.items).find(item => item.rawCode === "21228")!;
  item.rawCode = null; item.rawName = "21228 Management Consulting";
  assert.deepEqual(missingSubjectCodes(prose), []);
  assert.equal(resolveSubjectReferences(prose, [subject]).flatMap(group => group.items).find(row => row.id === item.id)?.subject, null);
});
