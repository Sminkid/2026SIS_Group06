import type { RequestHandler } from "express";
import {
  getLatestHandbook,
  getUniversities,
  getUniversityDegrees,
} from "../services/university.service.js";
import {
  parseHandbookYear,
  parseUniversityCode,
} from "../utils/request-params.js";

export const listUniversitiesController: RequestHandler = async (
  _request,
  response,
) => {
  response.status(200).json(await getUniversities());
};

export const latestHandbookController: RequestHandler = async (
  request,
  response,
) => {
  const universityCode = parseUniversityCode(request.params.universityCode);
  response.status(200).json(await getLatestHandbook(universityCode));
};

export const listUniversityDegreesController: RequestHandler = async (
  request,
  response,
) => {
  const universityCode = parseUniversityCode(request.params.universityCode);
  const year = parseHandbookYear(request.query.year);
  response
    .status(200)
    .json(await getUniversityDegrees(universityCode, year));
};
