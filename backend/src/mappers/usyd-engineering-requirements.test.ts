import assert from "node:assert/strict";
import test from "node:test";
import { mapDegreeDetail } from "./degree.mapper.js";

const group = (index: number, description: string, requiredCreditPoints: number | null, status = "AUTHORITATIVE") => ({
  id: `group-${index}`, parentGroupId: null, title: `requirements.${index}.rawText`, description,
  logic: "UNKNOWN", status, nodeType: "RAW", sourcePath: `requirements.${index}.rawText`,
  sourceUrl: null, rawData: null, requiredCreditPoints, maximumCreditPoints: null, sortOrder: index,
  RequirementItem: [], DegreeComponent: [], RequirementCandidateSource: [],
});

test("BHENGINE-04 source clauses retain every fact required by the USYD presentation adapter", () => {
  const degree = {
    id: "degree", code: "BHENGINE-04", name: "Bachelor of Engineering Honours", creditPoints: 192, description: null,
    RequirementGroup: [
      group(0, "the Engineering Specialisations Tables", null, "RAW_FALLBACK"),
      group(1, "a minimum of 18 credit points from the Engineering Foundations Table, including all required units", 18),
      group(2, "a minimum of 30 credit points from the Engineering Projects Table, including all required units", 30),
      group(3, "a minimum of 120 credit points from the Engineering Stream Table for the stream being undertaken", null, "RAW_FALLBACK"),
      group(4, "a maximum of 24 credit points from Table S or eligible Faculty of Engineering units", null, "RAW_FALLBACK"),
      group(5, "successfully complete the requirements of the Professional Engagement Program", null, "RAW_FALLBACK"),
      group(6, "for students enrolled in the Dalyell Stream, a minimum of 12 credit points of Dalyell units", null),
    ],
  };
  const result = mapDegreeDetail(
    { id: "usyd", code: "USYD", name: "The University of Sydney" } as never,
    { year: 2026 } as never,
    degree as never,
  );
  assert.equal(result.degree.creditPoints, 192);
  assert.ok(result.completionSummary.some((item) => item.minimumCreditPoints === 18 && /Foundations/.test(item.sourceText ?? "")));
  assert.ok(result.completionSummary.some((item) => item.minimumCreditPoints === 30 && /Projects/.test(item.sourceText ?? "")));
  assert.ok(result.completionSummary.some((item) => item.minimumCreditPoints === 120 && /Stream Table/.test(item.sourceText ?? "")));
  assert.ok(result.completionSummary.some((item) => item.minimumCreditPoints === 24 && /Table S/.test(item.sourceText ?? "")));
  assert.ok(result.completionSummary.some((item) => /Professional Engagement Program/.test(item.sourceText ?? "")));
  assert.ok(result.completionSummary.some((item) => /Specialisations Tables/.test(item.sourceText ?? "")));
  assert.equal(result.completionSummary.find((item) => /Dalyell units/.test(item.sourceText ?? ""))?.obligation, "CONDITIONAL");
});
