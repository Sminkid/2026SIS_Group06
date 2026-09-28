import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentDetailResponse } from "../types/handbook";
import { selectedComponentPreview } from "./selectedComponentPreview";

const detail = (code: string, name: string, subjectCode: string): ComponentDetailResponse => ({
  component: {
    id: `component-${code}`,
    code,
    name,
    type: "SUB_MAJOR",
    originalType: "Sub-major",
    creditPoints: 24,
    sourceUrl: null,
    handbookYear: 2026,
    university: { id: "uts", code: "UTS", name: "University of Technology Sydney" },
  },
  requirements: [{
    id: `group-${code}`,
    title: "Core",
    description: null,
    logic: "ALL",
    requiredCreditPoints: 6,
    maximumCreditPoints: null,
    sortOrder: 0,
    items: [{
      id: `item-${subjectCode}`,
      itemType: "SUBJECT",
      rawCode: subjectCode,
      rawName: `${name} subject`,
      creditPoints: 6,
      sortOrder: 0,
      subject: { id: `subject-${subjectCode}`, code: subjectCode, name: `${name} subject`, creditPoints: 6 },
      component: null,
    }],
    candidateSources: [],
    children: [],
    pathways: [],
  }],
});

test("each selected pathway slot resolves only its own component detail", () => {
  const consulting = detail("CONSULTING", "Management Consulting", "21001");
  const marketing = detail("MARKETING", "Marketing", "24001");
  const details = { CONSULTING: consulting, MARKETING: marketing };

  assert.equal(selectedComponentPreview("CONSULTING", details, "ready").detail, consulting);
  assert.equal(selectedComponentPreview("MARKETING", details, "ready").detail, marketing);
  assert.notEqual(selectedComponentPreview("CONSULTING", details, "ready").detail, marketing);
});

test("a changed, cleared, loading, or failed selection cannot retain another slot's preview", () => {
  const details = { CONSULTING: detail("CONSULTING", "Management Consulting", "21001") };

  assert.equal(selectedComponentPreview("MARKETING", details, "loading").state, "loading");
  assert.equal(selectedComponentPreview("MARKETING", details, "error").state, "error");
  assert.equal(selectedComponentPreview("MARKETING", details, "ready").state, "empty");
});
