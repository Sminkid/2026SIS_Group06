import assert from "node:assert/strict";
import test from "node:test";
import { addExplicitPathways } from "./degree.mapper.js";
import type { DegreeRequirementGroup } from "../types/degree.js";

test("Equivalent pathways use formal CP values rather than an Accounting-specific constant", () => {
  const group: DegreeRequirementGroup = { id: "parent", title: "Options", description: "One major, two sub-majors, one sub-major plus electives", logic: "ANY",
    requiredCreditPoints: 72, maximumCreditPoints: null, sortOrder: 0, items: [], candidateSources: [], pathways: [], children: [] };
  group.children = [["Majors", 72], ["Sub-Majors", 36], ["Electives", 36]].map(([title, cp]) => ({ ...group,
    id: String(title), title: String(title), description: null, requiredCreditPoints: Number(cp), children: [] }));
  addExplicitPathways(group);
  assert.equal(group.pathways.length, 3);
  assert.ok(group.pathways.every((pathway) => pathway.requiredCreditPoints === 72));
  assert.equal(group.pathways[2]!.selections[0]!.requiredCreditPoints, 36);
  const invalid = { ...group, pathways: [], requiredCreditPoints: 70 };
  addExplicitPathways(invalid);
  assert.deepEqual(invalid.pathways, []);
});
