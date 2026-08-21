import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./utils/error-handler.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());
  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
};
