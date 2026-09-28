import assert from "node:assert/strict";
import test from "node:test";
import { closestCourse, estimatedTotal, filterCourses, formatAud, formatDuration, lowestOf } from "./feeComparison";
import type { CourseFee } from "../types/fee";

const course = (universityCode: string, degreeCode: string, degreeName: string): CourseFee => ({
  degreeId: `${universityCode}-${degreeCode}`, degreeCode, degreeName, creditPoints: 144, handbookYear: 2026,
  universityCode, universityName: universityCode, feeYear: "2026-2027", domesticFee: 9880, internationalFee: 54770,
});

const uts = [
  course("UTS", "C09070", "Bachelor of Engineering (Honours) Bachelor of Business"),
  course("UTS", "C09066", "Bachelor of Engineering (Honours)"),
  course("UTS", "C10066", "Bachelor of Engineering Science"),
  course("UTS", "C10488", "Bachelor of Information Technology (Offshore)"),
  course("UTS", "C10143", "Bachelor of Information Technology (Co-op)"),
  course("UTS", "C10148", "Bachelor of Information Technology"),
];

test("duration converts credit points to full-time years without trailing decimals", () => {
  assert.equal(formatDuration(144), "3 years");
  assert.equal(formatDuration(198), "4.1 years");
  assert.equal(formatDuration(48), "1 year");
  assert.equal(formatDuration(24), "0.5 years");
  assert.equal(formatDuration(null), "Not listed");
});

test("estimated total scales the annual fee by course length and stays unknown when either input is", () => {
  assert.equal(estimatedTotal(9537, 192), 38148);
  assert.equal(estimatedTotal(null, 192), null);
  assert.equal(estimatedTotal(9537, null), null);
  assert.equal(formatAud(38148.4), "A$38,148");
});

test("lowest ignores courses without a fee and needs two figures to compare", () => {
  assert.equal(lowestOf([18025, null, 9880]), 9880);
  assert.equal(lowestOf([18025, null]), null);
});

test("filter matches name or code within one university only", () => {
  const courses = [...uts, course("USYD", "BHENGINE-04", "Bachelor of Engineering Honours")];
  assert.deepEqual(filterCourses(courses, "UTS", "c0906").map((item) => item.degreeCode), ["C09066"]);
  assert.equal(filterCourses(courses, "UTS", "engineering").length, 3);
  assert.equal(filterCourses(courses, "UTS", "  ").length, uts.length);
});

test("closest course prefers the single degree over double degrees and variants", () => {
  assert.equal(closestCourse(uts, "UTS", "Bachelor of Engineering Honours")?.degreeCode, "C09066");
  assert.equal(closestCourse(uts, "UTS", "Bachelor of Information Technology")?.degreeCode, "C10148");
});

test("closest course skips courses already being compared and other universities", () => {
  assert.equal(closestCourse(uts, "UTS", "Bachelor of Engineering Honours", new Set(["UTS-C09066"]))?.degreeCode, "C09070");
  assert.equal(closestCourse(uts, "USYD", "Bachelor of Engineering Honours"), null);
});
