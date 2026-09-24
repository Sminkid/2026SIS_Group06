import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { universitiesRouter } from "./universities.routes.js";
import { degreesRouter } from "./degrees.routes.js";
import { componentsRouter } from "./components.routes.js";
import { subjectsRouter } from "./subjects.routes.js";
import { chatRouter } from "./chat.routes.js";
import { requirementCandidateSourcesRouter } from "./requirement-candidate-sources.routes.js";
import { assessmentRouter } from "./assessment.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/universities", universitiesRouter);
apiRouter.use("/degrees", degreesRouter);
apiRouter.use("/components", componentsRouter);
apiRouter.use("/subjects", subjectsRouter);
apiRouter.use("/requirement-candidate-sources", requirementCandidateSourcesRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/assessment", assessmentRouter);
