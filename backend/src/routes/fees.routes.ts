import { Router } from "express";
import { listCourseFeesController } from "../controllers/fee.controller.js";

export const feesRouter = Router();

feesRouter.get("/", listCourseFeesController);
