import { Router } from "express";
import {
  getResultController,
  getRiasecLabelsController,
  startDrillDownController,
  startSessionController,
  submitClosingResponsesController,
  submitDrillDownResponsesController,
  submitScreeningResponsesController,
} from "../controllers/assessment.controller.js";

export const assessmentRouter = Router();

assessmentRouter.get("/riasec-labels", getRiasecLabelsController);
assessmentRouter.post("/sessions", startSessionController);
assessmentRouter.post("/sessions/:id/screening-responses", submitScreeningResponsesController);
assessmentRouter.post("/sessions/:id/closing-responses", submitClosingResponsesController);
assessmentRouter.post("/sessions/:id/drill-down", startDrillDownController);
assessmentRouter.post("/sessions/:id/drill-down-responses", submitDrillDownResponsesController);
assessmentRouter.get("/sessions/:id/result", getResultController);
