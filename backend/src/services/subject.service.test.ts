import assert from "node:assert/strict";
import test from "node:test";

import { partitionAccessGroups } from "./subject.service.js";
import type { SubjectAccessConditionGroup } from "../types/subject.js";

const group = (id: string, groupType: SubjectAccessConditionGroup["groupType"]): SubjectAccessConditionGroup => ({
  id,
  groupType,
  rule: null,
  sortOrder: null,
  items: [],
});

test("current prerequisite, corequisite and prohibition enums feed planner validation", () => {
  const result = partitionAccessGroups([
    group("prerequisite", "PREREQUISITE"),
    group("corequisite", "COREQUISITE"),
    group("prohibition", "PROHIBITION"),
  ]);

  assert.deepEqual(result.requisiteGroups.map((candidate) => candidate.groupType),
    ["PREREQUISITE", "COREQUISITE"]);
  assert.deepEqual(result.antiRequisiteGroups.map((candidate) => candidate.groupType), ["PROHIBITION"]);
});

test("legacy UTS requisite enum values remain supported", () => {
  const result = partitionAccessGroups([
    group("requisite", "REQUISITE"),
    group("anti-requisite", "ANTI_REQUISITE"),
  ]);

  assert.deepEqual(result.requisiteGroups.map((candidate) => candidate.groupType), ["REQUISITE"]);
  assert.deepEqual(result.antiRequisiteGroups.map((candidate) => candidate.groupType), ["ANTI_REQUISITE"]);
});
