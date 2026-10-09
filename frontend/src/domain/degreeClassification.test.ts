import assert from "node:assert/strict";
import test from "node:test";
import { classifyDegree } from "./degreeClassification";
import { groupCourses, matchCourses, otherCourses, primaryOfferings, universityCount } from "./courseAggregation";
import type { DegreeSummary, University } from "../types/handbook";

const sameCourse = (a: string, b: string) => assert.equal(classifyDegree(a).key, classifyDegree(b).key, `${a} ≠ ${b}`);
const differentCourse = (a: string, b: string) => assert.notEqual(classifyDegree(a).key, classifyDegree(b).key, `${a} = ${b}`);

test("honours written with or without brackets is the same course", () => {
  sameCourse("Bachelor of Engineering (Honours)", "Bachelor of Engineering Honours");
  sameCourse("Bachelor of Psychology (Honours)", "Bachelor of Psychology Honours");
  sameCourse("Bachelor of Design (Honours) in Architecture", "Bachelor of Design in Architecture (Honours)");
  assert.equal(classifyDegree("Bachelor of Engineering Honours").displayName, "Bachelor of Engineering (Honours)");
});

test("combined degrees match with or without 'and' and in either order", () => {
  sameCourse("Bachelor of Science Bachelor of Laws", "Bachelor of Science and Bachelor of Laws");
  sameCourse("Bachelor of Engineering (Honours) Bachelor of Science", "Bachelor of Engineering Honours and Bachelor of Science");
  sameCourse("Bachelor of Laws Bachelor of Science", "Bachelor of Science and Bachelor of Laws");
  assert.equal(classifyDegree("Bachelor of Economics Bachelor of Laws").displayName, "Bachelor of Economics and Bachelor of Laws");
});

test("'and' inside a field name doesn't split the degree", () => {
  assert.equal(classifyDegree("Bachelor of Architecture and Environments").key, "bachelor:architecture and environments");
  assert.equal(classifyDegree("Bachelor of Politics, Philosophy, and Economics").key, "bachelor:politics philosophy and economics");
  assert.equal(classifyDegree("Bachelor of Pharmacy and Management (Honours) and Master of Pharmacy Practice").key,
    "bachelor:pharmacy and management:honours + master:pharmacy practice");
});

test("delivery variants group with the standard degree", () => {
  sameCourse("Bachelor of Information Technology", "Bachelor of Information Technology (Co-op)");
  sameCourse("Bachelor of Business", "Bachelor of Business (Offshore)");
  sameCourse("Bachelor of Science", "Bachelor of Science (Extended)");
  assert.equal(classifyDegree("Bachelor of Information Technology (Offshore)").variant, "Offshore");
  assert.equal(classifyDegree("Bachelor of Information Technology").variant, null);
});

test("aliased fields are the same course", () => {
  sameCourse("Bachelor of Computing Science", "Bachelor of Computing");
});

test("different qualifications stay separate", () => {
  differentCourse("Bachelor of Science", "Bachelor of Science (Honours)");
  differentCourse("Bachelor of Science", "Bachelor of Medical Science");
  differentCourse("Bachelor of Engineering (Honours)", "Bachelor of Engineering Science");
  differentCourse("Bachelor of Laws", "Bachelor of Laws (Honours)");
  differentCourse("Bachelor of Business", "Bachelor of Business Bachelor of Laws");
  differentCourse("Diploma in Innovation", "Bachelor of Creative Intelligence and Innovation (Honours)");
});

const university = (code: string): University => ({ id: code.toLowerCase(), code, name: code, rankings: [] });
const degree = (code: string, name: string): DegreeSummary => ({ id: code, code, name, creditPoints: 144, handbookYear: 2026 });
const uts = university("UTS");
const usyd = university("USYD");
const courses = groupCourses([uts, usyd], {
  UTS: [
    degree("C09066", "Bachelor of Engineering (Honours)"),
    degree("C10488", "Bachelor of Information Technology (Offshore)"),
    degree("C10148", "Bachelor of Information Technology"),
    degree("C10143", "Bachelor of Information Technology (Co-op)"),
    degree("C10164", "Bachelor of Science"),
  ],
  USYD: [
    degree("BHENGINE-04", "Bachelor of Engineering Honours"),
    degree("BPSCIENC-01", "Bachelor of Science"),
    degree("BPSCIEXT-01", "Bachelor of Science (Extended)"),
  ],
});

test("counts universities offering a course, not degrees", () => {
  assert.equal(universityCount(courses.get(classifyDegree("Bachelor of Engineering Honours").key)!), 2);
  assert.equal(universityCount(courses.get(classifyDegree("Bachelor of Science").key)!), 2);
  assert.equal(universityCount(courses.get(classifyDegree("Bachelor of Information Technology").key)!), 1);
});

test("compares each university's standard degree first", () => {
  const it = courses.get(classifyDegree("Bachelor of Information Technology").key)!;
  assert.deepEqual(primaryOfferings(it).map((offering) => offering.degree.code), ["C10148"]);
  const science = courses.get(classifyDegree("Bachelor of Science").key)!;
  assert.deepEqual(primaryOfferings(science).map((offering) => offering.degree.code), ["C10164", "BPSCIENC-01"]);
});

test("recommendations from either university resolve to one shared course", () => {
  const recommended = matchCourses(["Bachelor of Engineering Honours", "Bachelor of Engineering (Honours)", "Bachelor of Science"], courses);
  assert.deepEqual(recommended.map((course) => course.courseName), ["Bachelor of Engineering (Honours)", "Bachelor of Science"]);
  assert.deepEqual(otherCourses(recommended, courses).map((course) => course.courseName), ["Bachelor of Information Technology"]);
});
