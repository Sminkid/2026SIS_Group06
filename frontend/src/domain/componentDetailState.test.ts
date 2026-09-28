import assert from "node:assert/strict";
import test from "node:test";

import { componentCreditLabel, componentDetailView, createLatestRequestGate } from "./componentDetailState";
import type { ComponentDetailResponse, RequirementGroup } from "../types/handbook";

const group = (id: string, title: string, subjectCode?: string): RequirementGroup => ({
  id, title, description: null, logic: "ALL", requiredCreditPoints: 6,
  maximumCreditPoints: null, sortOrder: 0, pathways: [], candidateSources: [], children: [],
  items: subjectCode ? [{
    id: `${id}-item`, itemType: "SUBJECT", subject: { id: subjectCode, code: subjectCode, name: subjectCode, creditPoints: 6 },
    component: null, rawCode: subjectCode, rawName: subjectCode, creditPoints: 6, sortOrder: 0,
  }] : [],
});

const detail = (role: "MAJOR" | "MINOR", requirements: RequirementGroup[]): ComponentDetailResponse => ({
  component: {
    id: `stable-${role.toLowerCase()}`, code: `USYD:ENGINEERING:${role}:SHARED`, name: "Shared component",
    type: role, originalType: role, creditPoints: role === "MAJOR" ? 48 : 36,
    sourceUrl: "https://example.edu/shared-table", handbookYear: 2026,
    university: { id: "usyd", code: "USYD", name: "The University of Sydney" },
  },
  requirements,
});

test("major and minor sharing a source remain distinct stable-ID structures", () => {
  const major = detail("MAJOR", [group("major-core", "Core units (major only)", "MAJR3000")]);
  const minor = detail("MINOR", [group("minor-core", "Core units (minor only)", "MINR3000")]);
  assert.equal(major.component.sourceUrl, minor.component.sourceUrl);
  assert.notEqual(major.component.id, minor.component.id);
  assert.notDeepEqual(major.requirements, minor.requirements);
  assert.equal(major.requirements.some((item) => /minor only/i.test(item.title ?? "")), false);
  assert.equal(minor.requirements.some((item) => /major only/i.test(item.title ?? "")), false);
});

test("valid, successful-empty, loading and failed component states stay distinct", () => {
  assert.equal(componentDetailView("ready", detail("MAJOR", [group("core", "Core", "COMP1000")])), "success-with-groups");
  assert.equal(componentDetailView("ready", detail("MAJOR", [group("empty", "Core")])), "success-empty");
  assert.equal(componentDetailView("loading", null), "loading");
  assert.equal(componentDetailView("error", null), "failure");
});

test("component CP label uses the official component total", () => {
  assert.equal(componentCreditLabel(detail("MAJOR", [])), "48 CP");
  assert.equal(componentCreditLabel(detail("MINOR", [])), "36 CP");
});

test("rapid selection changes reject stale responses", () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.isLatest(first), false);
  assert.equal(gate.isLatest(second), true);
  gate.invalidate();
  assert.equal(gate.isLatest(second), false);
});

