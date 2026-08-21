export interface HealthResponse {
  status: "ok" | "degraded";
  service: "uni-planner-api";
  database: "connected" | "unavailable";
  timestamp: string;
}
