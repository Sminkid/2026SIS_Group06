import type { RequestHandler } from "express";
import { getComponentDetail } from "../services/component.service.js";
import { parseComponentIdentifier, parseRequiredHandbookYear, parseUniversityCode } from "../utils/request-params.js";

export const componentDetailController: RequestHandler = async (request, response) => {
  const componentCode = parseComponentIdentifier(request.params.componentCode);
  const universityCode = parseUniversityCode(request.query.university);
  const year = parseRequiredHandbookYear(request.query.year);
  response.status(200).json(await getComponentDetail(componentCode, universityCode, year));
};
