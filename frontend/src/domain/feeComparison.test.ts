import assert from "node:assert/strict";
import test from "node:test";
import {
  annualFee, applyQuery, closestCourse, compareToLowest, courseOptions, estimatedTotal, filterCourses, formatAud,
  formatDuration, initialColumns, leastUsedUniversity, lowestOf, type ComparisonColumn,
} from "./feeComparison";
import type { CourseFee } from "../types/fee";

const course = (universityCode: string, degreeCode: string, degreeName: string, overrides: Partial<CourseFee> = {}): CourseFee => ({
  degreeId: `${universityCode}-${degreeCode}`, degreeCode, degreeName, creditPoints: 144, handbookYear: 2026,
  universityCode, universityName: universityCode, feeYear: "2026-2027", domesticFee: 9880, internationalFee: 54770,
  ...overrides,
});

const column = (universityCode: string, degreeId: string | null, query = ""): ComparisonColumn => ({ universityCode, degreeId, query });

const uts = [
  course("UTS", "C09070", "Bachelor of Engineering (Honours) Bachelor of Business"),
  course("UTS", "C09066", "Bachelor of Engineering (Honours)"),
  course("UTS", "C10066", "Bachelor of Engineering Science"),
  course("UTS", "C10488", "Bachelor of Information Technology (Offshore)"),
  course("UTS", "C10143", "Bachelor of Information Technology (Co-op)"),
  course("UTS", "C10148", "Bachelor of Information Technology"),
];
const usyd = [
  course("USYD", "BPARTSAR-09", "Bachelor of Arts"),
  course("USYD", "BHENGINE-04", "Bachelor of Engineering Honours"),
];
const all = [...usyd, ...uts];

test("annual fee reads the figure for the chosen basis, keeping N/A as null", () => {
  const accounting = course("UTS", "C10235", "Bachelor of Accounting", { domesticFee: 18025, internationalFee: null });
  assert.equal(annualFee(accounting, "domestic"), 18025);
  assert.equal(annualFee(accounting, "international"), null);
});

test("duration converts credit points to full-time years without trailing decimals", () => {
  assert.equal(formatDuration(144), "3 years");
  assert.equal(formatDuration(198), "4.1 years");
  assert.equal(formatDuration(168), "3.5 years");
  assert.equal(formatDuration(150), "3.1 years");
  assert.equal(formatDuration(48), "1 year");
  assert.equal(formatDuration(24), "0.5 years");
  assert.equal(formatDuration(null), "Not listed");
});

test("estimated total scales the annual fee by course length and stays unknown when either input is", () => {
  assert.equal(estimatedTotal(9537, 192), 38148);
  assert.equal(estimatedTotal(4738, 48), 4738, "a one-year honours entry costs one annual fee");
  assert.equal(estimatedTotal(9880, 198), 40755);
  assert.equal(estimatedTotal(null, 192), null);
  assert.equal(estimatedTotal(9537, null), null);
});

test("currency formatting rounds to whole dollars with thousands separators", () => {
  assert.equal(formatAud(38148.4), "A$38,148");
  assert.equal(formatAud(38148.5), "A$38,149");
  assert.equal(formatAud(333300), "A$333,300");
  assert.equal(formatAud(0), "A$0");
});

test("lowest ignores courses without a fee and needs two figures to compare", () => {
  assert.equal(lowestOf([18025, null, 9880]), 9880);
  assert.equal(lowestOf([18025, null]), null);
  assert.equal(lowestOf([null, null]), null);
  assert.equal(lowestOf([]), null);
});

test("comparison marks the cheapest course and the extra cost of the others", () => {
  assert.deepEqual(compareToLowest(9537, 9537), { kind: "lowest" });
  assert.deepEqual(compareToLowest(9880, 9537), { kind: "more", difference: 343 });
});

test("courses tied on price are all marked lowest", () => {
  const lowest = lowestOf([9880, 9880]);
  assert.deepEqual(compareToLowest(9880, lowest), { kind: "lowest" });
});

test("comparison is omitted for a course without a fee or when nothing is being compared", () => {
  assert.equal(compareToLowest(null, 9537), null);
  assert.equal(compareToLowest(9537, null), null);
});

test("filter matches name or code within one university, ignoring case and surrounding spaces", () => {
  const courses = [...uts, course("USYD", "BHENGINE-04", "Bachelor of Engineering Honours")];
  assert.deepEqual(filterCourses(courses, "UTS", "c0906").map((item) => item.degreeCode), ["C09066"]);
  assert.equal(filterCourses(courses, "UTS", "ENGINEERING").length, 3);
  assert.equal(filterCourses(courses, "UTS", "  ").length, uts.length);
  assert.deepEqual(filterCourses(courses, "UTS", "nothing like this"), []);
});

test("closest course prefers the single degree over double degrees and variants", () => {
  assert.equal(closestCourse(uts, "UTS", "Bachelor of Engineering Honours")?.degreeCode, "C09066");
  assert.equal(closestCourse(uts, "UTS", "Bachelor of Information Technology")?.degreeCode, "C10148");
});

test("closest course ranks offshore variants below other variants of the same degree", () => {
  const withoutMain = uts.filter((item) => item.degreeCode !== "C10148");
  assert.equal(closestCourse(withoutMain, "UTS", "Bachelor of Information Technology")?.degreeCode, "C10143");
});

test("closest course skips courses already being compared and other universities", () => {
  assert.equal(closestCourse(uts, "UTS", "Bachelor of Engineering Honours", new Set(["UTS-C09066"]))?.degreeCode, "C09070");
  assert.equal(closestCourse(uts, "USYD", "Bachelor of Engineering Honours"), null);
});

test("closest course returns null once every course at that university is taken", () => {
  assert.equal(closestCourse(usyd, "USYD", "Bachelor of Arts", new Set(usyd.map((item) => item.degreeId))), null);
});

test("initial columns open on the default degree at each university", () => {
  assert.deepEqual(initialColumns(all, ["USYD", "UTS"]), [
    column("USYD", "USYD-BHENGINE-04"),
    column("UTS", "UTS-C09066"),
  ]);
});

test("initial columns fall back to the first course when a default degree is missing", () => {
  assert.deepEqual(initialColumns(all, ["USYD", "UTS"], ["NOT-A-CODE", "C09066"]), [
    column("USYD", "USYD-BPARTSAR-09"),
    column("UTS", "UTS-C09066"),
  ]);
});

test("initial columns use at most two universities and leave a university without courses empty", () => {
  assert.equal(initialColumns(all, ["USYD", "UTS", "UNSW"]).length, 2);
  assert.deepEqual(initialColumns(all, ["UNSW"]), [column("UNSW", null)]);
  assert.deepEqual(initialColumns(all, []), []);
});

test("add suggests the university with the fewest columns, keeping list order on a tie", () => {
  assert.equal(leastUsedUniversity(["USYD", "UTS"], [column("USYD", "a"), column("USYD", "b"), column("UTS", "c")]), "UTS");
  assert.equal(leastUsedUniversity(["USYD", "UTS"], [column("USYD", "a"), column("UTS", "b")]), "USYD");
  assert.equal(leastUsedUniversity(["USYD", "UTS"], []), "USYD");
  assert.equal(leastUsedUniversity([], []), null);
});

test("typing a filter keeps the current course while it still matches", () => {
  const next = applyQuery(all, column("UTS", "UTS-C09066"), "engineering");
  assert.deepEqual(next, column("UTS", "UTS-C09066", "engineering"));
});

test("typing a filter switches to the closest match once the current course is filtered out", () => {
  const next = applyQuery(all, column("UTS", "UTS-C09066"), "information");
  assert.deepEqual(next, column("UTS", "UTS-C10148", "information"));
});

test("a filter with no matches keeps the current course so the comparison doesn't go blank", () => {
  const next = applyQuery(all, column("UTS", "UTS-C09066"), "zzz");
  assert.deepEqual(next, column("UTS", "UTS-C09066", "zzz"));
});

test("dropdown options keep the current course listed first when the filter hides it", () => {
  const current = uts.find((item) => item.degreeCode === "C09066")!;
  const options = courseOptions(all, column("UTS", current.degreeId, "information"), current);
  assert.equal(options[0], current);
  assert.equal(options.length, 4);
});

test("dropdown options don't duplicate a current course that already matches", () => {
  const current = uts.find((item) => item.degreeCode === "C09066")!;
  const options = courseOptions(all, column("UTS", current.degreeId, "engineering"), current);
  assert.equal(options.filter((item) => item === current).length, 1);
  assert.equal(options.length, 3);
});

test("dropdown options without a current course are just the filtered list", () => {
  assert.deepEqual(courseOptions(all, column("USYD", null), null), usyd);
});

test("closest course counts a repeated word once, so long combined degrees don't outrank the plain one", () => {
  const courses = [
    course("UTS", "C09148", "Bachelor of Engineering (Honours) Bachelor of International Studies (Honours) Diploma in Professional Engineering Practice"),
    course("UTS", "C09066", "Bachelor of Engineering (Honours)"),
  ];
  assert.equal(closestCourse(courses, "UTS", "engineering")?.degreeCode, "C09066");
});

