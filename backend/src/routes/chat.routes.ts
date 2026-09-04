import { Router } from "express";
import { glossaryChatController } from "../controllers/chat.controller.js";

export const chatRouter = Router();

chatRouter.post("/glossary", glossaryChatController);
