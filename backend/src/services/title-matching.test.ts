import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupEquivalentTitles, normaliseTitle, titleSimilarity } from "./title-matching.js";

describe("normaliseTitle", () => {
  it("treats honours in brackets and unbracketed the same", () => {
    assert.deepEqual(
      normaliseTitle("Bachelor of Engineering (Honours)"),
      normaliseTitle("Bachelor of Engineering Honours"),
    );
  });

  it("keeps a field that lives inside brackets", () => {
    assert.deepEqual(normaliseTitle("Bachelor of Science (Computer Science)").tokens, ["computer", "science"]);
  });

  it("drops component label words", () => {
    assert.deepEqual(normaliseTitle("Computer Science Major").tokens, normaliseTitle("Computer Science").tokens);
  });

  it("is order independent for combined degrees", () => {
    assert.deepEqual(
      normaliseTitle("Bachelor of Science Bachelor of Laws"),
      normaliseTitle("Bachelor of Laws and Bachelor of Science"),
    );
  });
});

describe("titleSimilarity", () => {
  it("matches titles differing only by brackets or delivery variant", () => {
    assert.equal(titleSimilarity("Bachelor of Engineering (Honours)", "Bachelor of Engineering Honours"), 1);
    assert.equal(titleSimilarity("Bachelor of Business (Co-op)", "Bachelor of Business"), 1);
  });

  it("matches known equivalents and spelling variants", () => {
    assert.ok(titleSimilarity("Psychology", "Psychological Science") >= 0.8);
    assert.ok(titleSimilarity("Organisational Behaviour", "Organizational Behavior") >= 0.8);
  });

  it("keeps genuinely different courses apart", () => {
    assert.ok(titleSimilarity("Computer Science", "Cognitive Science") < 0.8);
    assert.ok(titleSimilarity("Bachelor of Arts", "Bachelor of Science") < 0.8);
  });

  it("keeps different award levels and honours vs pass apart", () => {
    assert.equal(titleSimilarity("Bachelor of Science", "Master of Science"), 0);
    assert.equal(titleSimilarity("Bachelor of Science", "Bachelor of Science (Honours)"), 0);
  });
});

describe("groupEquivalentTitles", () => {
  it("groups equivalent items of the same kind and leaves others alone", () => {
    const groups = groupEquivalentTitles([
      { id: "uts", name: "Bachelor of Engineering (Honours)", kind: "DEGREE" },
      { id: "usyd", name: "Bachelor of Engineering Honours", kind: "DEGREE" },
      { id: "unsw", name: "Bachelor of Engineering (Honours)", kind: "DEGREE" },
      { id: "arts", name: "Bachelor of Arts", kind: "DEGREE" },
      { id: "major", name: "Bachelor of Engineering", kind: "MAJOR" },
    ]);
    assert.equal(groups.get("uts"), groups.get("usyd"));
    assert.equal(groups.get("uts"), groups.get("unsw"));
    assert.notEqual(groups.get("arts"), groups.get("uts"));
    assert.notEqual(groups.get("major"), groups.get("uts"));
  });
});
