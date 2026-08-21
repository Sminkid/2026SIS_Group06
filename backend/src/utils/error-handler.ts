import type { ErrorRequestHandler } from "express";
import { ApiError } from "./api-error.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof URIError) {
    response.status(400).json({ error: "Malformed URL encoding" });
    return;
  }

  console.error("Unhandled API error", error);
  response.status(500).json({
    error: "Internal server error",
  });
};
