import { Router } from "express";
import { componentDetailController } from "../controllers/component.controller.js";

export const componentsRouter = Router();
componentsRouter.get("/:componentCode", componentDetailController);
