import assert from "node:assert/strict";
import test from "node:test";
import { mergeCandidateSubjectPages } from "./candidateSubjects";
import type { RequirementCandidateSourceSummary } from "../types/handbook";

const source = (id: string, title: string): RequirementCandidateSourceSummary => ({
  id, sourceKey: id, title, type: id === "engineering" ? "SUBJECT_FILTER" : "TABLE_SUBJECT_POOL",
  authoritative: true, tableName: null, candidateCount: 2,
});

test("candidate pages form a canonical ordered union while retaining every eligibility source", () => {
  const engineering = source("engineering", "Engineering undergraduate units");
  const tableS = source("table-s", "Table S units");
  const shared = { id: "shared", code: "COMP1000", name: "Shared subject", creditPoints: 6 };
  const result = mergeCandidateSubjectPages([
    { source: engineering, subjects: [shared, { id: "aero", code: "AERO1000", name: "Aero", creditPoints: 6 }] },
    { source: tableS, subjects: [{ ...shared }, { id: "acct", code: "ACCT1000", name: "Accounting", creditPoints: 6 }] },
  ]);

  assert.deepEqual(result.map((subject) => subject.id), ["acct", "aero", "shared"]);
  assert.deepEqual(result.find((subject) => subject.id === "shared")?.eligibilitySources.map((item) => item.id),
    ["engineering", "table-s"]);
});
