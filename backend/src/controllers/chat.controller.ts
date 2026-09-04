import type { RequestHandler } from "express";
import { answerGlossaryQuestion } from "../services/chat.service.js";
import { parseChatQuestion } from "../utils/request-params.js";
import type { ChatGlossaryResponse } from "../types/chat.js";

export const glossaryChatController: RequestHandler = async (request, response) => {
  const question = parseChatQuestion((request.body as { question?: unknown } | undefined)?.question);
  const answer = await answerGlossaryQuestion(question);
  const body: ChatGlossaryResponse = { answer };
  response.status(200).json(body);
};
