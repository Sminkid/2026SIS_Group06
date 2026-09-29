import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api-error.js";
import { parseChatQuestion } from "./request-params.js";

test("trims and returns a valid question", () => {
  assert.equal(parseChatQuestion("  What is WAM?  "), "What is WAM?");
});

test("rejects non-string input", () => {
  assert.throws(() => parseChatQuestion(undefined), ApiError);
  assert.throws(() => parseChatQuestion(42), ApiError);
});

test("rejects empty or whitespace-only input", () => {
  assert.throws(() => parseChatQuestion(""), ApiError);
  assert.throws(() => parseChatQuestion("   "), ApiError);
});

test("accepts exactly 500 characters and rejects 501", () => {
  assert.doesNotThrow(() => parseChatQuestion("a".repeat(500)));
  assert.throws(() => parseChatQuestion("a".repeat(501)), ApiError);
});
