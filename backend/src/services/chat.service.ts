import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

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

interface GenerateContentClient {
  models: {
    generateContent: (params: {
      model: string;
      contents: string;
      config: { systemInstruction: string; maxOutputTokens: number };
    }) => Promise<{ text?: string | undefined }>;
  };
}

const generate = (client: GenerateContentClient, model: string, question: string) => {
  return client.models.generateContent({
    model,
    contents: question,
    config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 300 },
  });
};

export const answerGlossaryQuestion = async (
  question: string,
  client: GenerateContentClient = getClient(),
): Promise<string> => {
  let result;
  try {
    result = await generate(client, PRIMARY_MODEL, question);
  } catch (primaryError) {
    console.warn(`Gemini ${PRIMARY_MODEL} call failed, retrying with ${FALLBACK_MODEL}`, primaryError);
    result = await generate(client, FALLBACK_MODEL, question);
  }

  const answer = result.text?.trim();
  if (!answer) {
    throw new ApiError(502, "Chat assistant returned an empty response");
  }
  return answer;
};

