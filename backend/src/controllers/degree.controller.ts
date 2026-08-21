import type { RequestHandler } from "express";
import { getDegreeDetail, getDegreeStudyPlans } from "../services/degree.service.js";
import {
  parseDegreeCode,
  parseRequiredHandbookYear,
  parseUniversityCode,
} from "../utils/request-params.js";

export const degreeDetailController: RequestHandler = async (
  request,
  response,
) => {
  const degreeCode = parseDegreeCode(request.params.degreeCode);
  const universityCode = parseUniversityCode(request.query.university);
  const handbookYear = parseRequiredHandbookYear(request.query.year);

  response
    .status(200)
    .json(await getDegreeDetail(degreeCode, universityCode, handbookYear));
};

export const degreeStudyPlansController: RequestHandler = async (request, response) => {
  const degreeCode = parseDegreeCode(request.params.degreeCode);
  const universityCode = parseUniversityCode(request.query.university);
  const handbookYear = parseRequiredHandbookYear(request.query.year);
  response.status(200).json(await getDegreeStudyPlans(degreeCode, universityCode, handbookYear));
};
