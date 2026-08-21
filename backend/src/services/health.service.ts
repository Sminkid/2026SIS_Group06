import type { HealthResponse } from "../types/health.js";
import { checkDatabaseConnection } from "../repositories/health.repository.js";

export const getHealth = async (): Promise<HealthResponse> => {
  const databaseConnected = await checkDatabaseConnection();

  return {
    status: databaseConnected ? "ok" : "degraded",
    service: "uni-planner-api",
    database: databaseConnected ? "connected" : "unavailable",
    timestamp: new Date().toISOString(),
  };
};
