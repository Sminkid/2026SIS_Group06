import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a glossary assistant embedded in a university course-planning app.

Your ONLY job is to explain general academic and enrolment terminology in plain language, e.g.:
- credit points / credit point requirements
- WAM (weighted average mark) and GPA
- semester vs trimester vs term
- major, minor, sub-major, specialisation
- prerequisites, corequisites, antirequisites
- full-time vs part-time study load
- census date, unit of study, core vs elective

Keep answers short (2-4 sentences), plain-English, and generic (not specific to any single
university, degree, or subject, since you have no access to this app's course database).

If the user asks about anything outside general academic/enrolment terminology (e.g. their
specific course requirements, subject recommendations, study plans, financial advice, or
anything unrelated to academic terminology), politely decline and redirect them to use the
app's course comparison tool instead of answering the question.`;

let client: GoogleGenAI | undefined;

const getClient = (): GoogleGenAI => {
  if (!env.geminiApiKey) {
    throw new ApiError(503, "Chat assistant is not configured");
  }

  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
};

export const answerGlossaryQuestion = async (question: string): Promise<string> => {
  const ai = getClient();

  const result = await ai.models.generateContent({
    model: MODEL,
    contents: question,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 300,
    },
  });

  const answer = result.text?.trim();

  if (!answer) {
    throw new ApiError(502, "Chat assistant returned an empty response");
  }

  return answer;
};
