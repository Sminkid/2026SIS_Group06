import assert from "node:assert/strict";
import test from "node:test";
import { employmentFor, formatPercent, subjectOf, subjectRankingLine } from "./universityOutcomes";
import type { University } from "../types/handbook";

const qs = (category: string, rank: number, rankBand: string | null = null) => ({ source: "QS", category, year: 2027, rank, rankBand });
const uts: University = {
  id: "uts", code: "UTS", name: "University of Technology Sydney",
  rankings: [
    qs("Overall", 87), qs("Art and Design", 85),
    { source: "QILT", category: "Full-time employment (domestic)", year: 2025, rank: 722, rankBand: null },
  ],
};
const usyd: University = { ...uts, id: "usyd", code: "USYD", rankings: [qs("Overall", 28), qs("Art and Design", 101, "101-150")] };

test("subjectOf takes the first rule that matches the course name", () => {
  assert.equal(subjectOf("Bachelor of Design in Product Design"), "Art and Design");
  assert.equal(subjectOf("Bachelor of Design in Architecture"), "Architecture and Built Environment");
  assert.equal(subjectOf("Bachelor of Design in Visual Communication"), "Art and Design");
  assert.equal(subjectOf("Bachelor of Laws"), "Law and Legal Studies");
  assert.equal(subjectOf("Bachelor of Underwater Basket Weaving"), null);
});

test("subjectOf leaves double degrees unmatched", () => {
  assert.equal(subjectOf("Bachelor of Commerce and Bachelor of Laws"), null);
  assert.equal(subjectOf("Bachelor of Engineering (Honours) Diploma in Professional Engineering Practice"), null);
});

test("subject ranking line shows positions, bands and unranked subjects", () => {
  assert.equal(subjectRankingLine(uts, "Bachelor of Design in Product Design"), "Art and Design: #85");
  assert.equal(subjectRankingLine(usyd, "Bachelor of Design"), "Art and Design: 101–150");
  assert.equal(subjectRankingLine(uts, "Bachelor of Nursing"), "Nursing: Not ranked");
  assert.equal(subjectRankingLine(uts, "Bachelor of Commerce and Bachelor of Laws"), null);
});

test("employment comes from QILT rows and is null when missing", () => {
  const domestic = employmentFor(uts, "domestic")!;
  assert.equal(formatPercent(domestic.fullTimeRate), "72.2%");
  assert.equal(domestic.period, "2025");
  assert.equal(employmentFor(uts, "international"), null);
  assert.deepEqual(
    employmentFor({ ...uts, rankings: [{ source: "QILT", category: "Full-time employment (international)", year: 2025, rank: 490, rankBand: null }] }, "international"),
    { fullTimeRate: 49, period: "2023–25" },
  );
});
