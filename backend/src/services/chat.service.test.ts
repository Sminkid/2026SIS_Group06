import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { answerGlossaryQuestion } from "./chat.service.js";

const makeClient = (generateContent: (params: { model: string }) => Promise<{ text?: string }>) => ({
  models: { generateContent },
});

test("returns the trimmed answer from the primary model", async () => {
  const generateContent = mock.fn(async (_params: { model: string }) => ({
    text: "  A credit point measures workload.  ",
  }));
  const answer = await answerGlossaryQuestion("What is a credit point?", makeClient(generateContent));

  assert.equal(answer, "A credit point measures workload.");
  assert.equal(generateContent.mock.callCount(), 1);
  const [call] = generateContent.mock.calls;
  assert.ok(call);
  assert.equal(call.arguments[0].model, "gemini-2.5-flash");
});

test("falls back to the secondary model when the primary call fails", async () => {
  const generateContent = mock.fn(async (params: { model: string }) => {
    if (params.model === "gemini-2.5-flash") throw new Error("primary model unavailable");
    return { text: "Fallback answer" };
  });

  const answer = await answerGlossaryQuestion("What is WAM?", makeClient(generateContent));

  assert.equal(answer, "Fallback answer");
  assert.equal(generateContent.mock.callCount(), 2);
  const fallbackCall = generateContent.mock.calls[1];
  assert.ok(fallbackCall);
  assert.equal(fallbackCall.arguments[0].model, "gemini-3.5-flash-lite");
});

test("propagates the error when both primary and fallback calls fail", async () => {
  const generateContent = mock.fn(async (_params: { model: string }) => {
    throw new Error("service down");
  });

  await assert.rejects(
    () => answerGlossaryQuestion("What is a major?", makeClient(generateContent)),
    /service down/,
  );
  assert.equal(generateContent.mock.callCount(), 2);
});

test("throws ApiError(502) when the response text is empty", async () => {
  const generateContent = mock.fn(async (_params: { model: string }) => ({ text: "   " }));

  await assert.rejects(
    () => answerGlossaryQuestion("What is a prerequisite?", makeClient(generateContent)),
    (error: unknown) => error instanceof Error && (error as { statusCode?: number }).statusCode === 502,
  );
});
