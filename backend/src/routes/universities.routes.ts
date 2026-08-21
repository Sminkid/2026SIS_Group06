import { Router } from "express";
import {
  latestHandbookController,
  listUniversitiesController,
  listUniversityDegreesController,
} from "../controllers/university.controller.js";

export const universitiesRouter = Router();

universitiesRouter.get("/", listUniversitiesController);
universitiesRouter.get(
  "/:universityCode/handbooks/latest",
  latestHandbookController,
);
universitiesRouter.get(
  "/:universityCode/degrees",
  listUniversityDegreesController,
);
