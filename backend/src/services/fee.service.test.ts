import assert from "node:assert/strict";
import test from "node:test";

import { toCourseFeeSummary } from "./fee.service.js";

type CourseFeeRow = Parameters<typeof toCourseFeeSummary>[0];

const row = (overrides: Partial<Omit<CourseFeeRow, "Degree">> = {}): CourseFeeRow => ({
  feeYear: "2026-2027",
  domesticFee: 9537,
  internationalFee: 60600,
  Degree: {
    id: "degree-1",
    code: "BHENGINE-04",
    name: "Bachelor of Engineering Honours",
    creditPoints: 192,
    HandbookVersion: {
      year: 2026,
      University: { code: "USYD", name: "The University of Sydney" },
    },
  },
  ...overrides,
});

test("fee rows flatten degree, handbook and university details for the comparison page", () => {
  assert.deepEqual(toCourseFeeSummary(row()), {
    degreeId: "degree-1",
    degreeCode: "BHENGINE-04",
    degreeName: "Bachelor of Engineering Honours",
    creditPoints: 192,
    handbookYear: 2026,
    universityCode: "USYD",
    universityName: "The University of Sydney",
    feeYear: "2026-2027",
    domesticFee: 9537,
    internationalFee: 60600,
  });
});

test("fees listed as N/A stay null rather than becoming zero", () => {
  const summary = toCourseFeeSummary(row({ domesticFee: null, internationalFee: null }));
  assert.equal(summary.domesticFee, null);
  assert.equal(summary.internationalFee, null);
});

test("a degree without listed credit points is passed through as null", () => {
  const input = row();
  input.Degree.creditPoints = null;
  assert.equal(toCourseFeeSummary(input).creditPoints, null);
});
