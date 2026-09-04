import { Router } from "express";
import { subjectAccessConditionsBatchController, subjectAccessConditionsController, subjectDetailController, subjectSearchController } from "../controllers/subject.controller.js";

export const subjectsRouter = Router();
subjectsRouter.get("/search", subjectSearchController);
subjectsRouter.post("/access-conditions/batch", subjectAccessConditionsBatchController);
subjectsRouter.get("/:subjectCode/access-conditions", subjectAccessConditionsController);
subjectsRouter.get("/:subjectCode", subjectDetailController);
