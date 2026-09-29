import type { RequestHandler } from "express";
import { getCourseFees } from "../services/fee.service.js";

export const listCourseFeesController: RequestHandler = async (
  _request,
  response,
) => {
  response.status(200).json(await getCourseFees());
};
