import type { CourseFee } from "../types/fee";
import { apiGet } from "./client";

export const fetchCourseFees = (signal?: AbortSignal): Promise<CourseFee[]> => apiGet("/api/fees", signal);
