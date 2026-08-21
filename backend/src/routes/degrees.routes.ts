import { Router } from "express";
import { degreeDetailController, degreeStudyPlansController } from "../controllers/degree.controller.js";

export const degreesRouter = Router();

degreesRouter.get("/:degreeCode/study-plans", degreeStudyPlansController);
degreesRouter.get("/:degreeCode", degreeDetailController);
