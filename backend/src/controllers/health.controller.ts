import type { RequestHandler } from "express";
import { getHealth } from "../services/health.service.js";

export const healthController: RequestHandler = async (_request, response) => {
  const health = await getHealth();
  response.status(health.status === "ok" ? 200 : 503).json(health);
};
