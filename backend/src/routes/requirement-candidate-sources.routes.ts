import { Router } from "express";
import { requirementCandidateSubjectsController } from "../controllers/requirement-candidate-source.controller.js";

export const requirementCandidateSourcesRouter = Router();
requirementCandidateSourcesRouter.get("/:sourceId/subjects", requirementCandidateSubjectsController);
