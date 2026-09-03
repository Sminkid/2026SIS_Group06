import { apiPost } from "./client";

export interface GlossaryChatResponse {
  answer: string;
}

export const askGlossaryQuestion = (question: string, signal?: AbortSignal): Promise<GlossaryChatResponse> =>
  apiPost<GlossaryChatResponse>("/api/chat/glossary", { question }, signal);
