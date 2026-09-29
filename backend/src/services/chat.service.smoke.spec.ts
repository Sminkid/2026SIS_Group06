import assert from "node:assert/strict";
import test from "node:test";
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { answerGlossaryQuestion } from "./chat.service.js";

const skip = env.geminiApiKey
  ? false
  : "GEMINI_API_KEY is not set — skipping live Gemini connectivity checks";

test("primary model answers a real glossary question", { skip }, async () => {
  const answer = await answerGlossaryQuestion("What does WAM mean?");
  assert.ok(answer.length > 0, "expected a non-empty answer");
});

test("fallback model answers a real glossary question", { skip }, async () => {
  const client = new GoogleGenAI({ apiKey: env.geminiApiKey! });
  const result = await client.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: "What does WAM mean?",
    config: { maxOutputTokens: 300 },
  });

  assert.ok((result.text ?? "").trim().length > 0, "expected a non-empty answer");
});

test("responds within a reasonable time", { skip }, async () => {
  const start = Date.now();
  await answerGlossaryQuestion("What is a prerequisite?");
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 10_000, `expected a response within 10s, took ${elapsed}ms`);
});

test("an invalid API key fails clearly instead of hanging", async () => {
  const client = new GoogleGenAI({ apiKey: "invalid-test-key" });

  await assert.rejects(() =>
    client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "What does WAM mean?",
      config: { maxOutputTokens: 300 },
    }),
  );
});
