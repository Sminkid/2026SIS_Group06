import assert from "node:assert/strict";
import test from "node:test";
import { mapStudyPlans, studyPlanItemTitle } from "./study-plan.mapper.js";

test("CUSP plan metadata and nested subject relationships are preserved", () => {
  const plans = mapStudyPlans([{
    id: "plan", sourcePlanId: "BHENGINE-04:6701:BASE:Software Engineering",
    title: "Software Engineering", description: null, sourceUrl: "https://example.test/cusp",
    pathway: "Software Engineering", sourceType: "CUSP", handbookYear: 2026,
    variantNumber: null, totalCreditPoints: null,
    StudyPlanYear: [{ id: "year", name: "Year 1", sortOrder: 0,
      StudyPlanPeriod: [{ id: "period", name: "Semester 1", sortOrder: 0,
        StudyPlanItem: [
          { id: "subject-item", itemType: "SUBJECT" as const, rawCode: "INFO1110", title: "Introduction to Programming",
            creditPoints: 6, numberOfPeriods: null, sortOrder: 0, rawData: null,
            Subject: { id: "subject", code: "INFO1110", name: "Introduction to Programming", creditPoints: 6 } },
          { id: "choice-item", itemType: "CHOICE" as const, rawCode: null, title: "List", creditPoints: 6,
            numberOfPeriods: null, sortOrder: 1,
            rawData: { rawText: "Select from Software Stream 1000/2000 Level ElectivesFree Electives" }, Subject: null },
        ] }],
    }],
  }]);

  assert.equal(plans[0]?.pathway, "Software Engineering");
  assert.equal(plans[0]?.sourcePlanId, "BHENGINE-04:6701:BASE:Software Engineering");
  assert.equal(plans[0]?.years[0]?.name, "Year 1");
  assert.equal(plans[0]?.years.some((year) => /year 0/i.test(year.name)), false);
  assert.equal(plans[0]?.years[0]?.periods[0]?.items[0]?.subject?.id, "subject");
  assert.equal(plans[0]?.years[0]?.periods[0]?.items[1]?.subject, null);
  assert.equal(plans[0]?.years[0]?.periods[0]?.items[1]?.title,
    "Software Stream 1000/2000 Level Electives or Free Electives");
});

test("choice label cleanup never fabricates a subject candidate", () => {
  assert.equal(studyPlanItemTitle({ itemType: "CHOICE", title: "List", rawData: null }), "Elective choice");
  assert.equal(studyPlanItemTitle({ itemType: "SUBJECT", title: "List", rawData: { rawText: "Ignored" } }), "List");
});
