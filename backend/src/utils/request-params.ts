import { ApiError } from "./api-error.js";

const UNIVERSITY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const DEGREE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const COMPONENT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,63}$/;
const HANDBOOK_YEAR_PATTERN = /^\d{4}$/;

export const parseUniversityCode = (value: unknown): string => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (!code || !UNIVERSITY_CODE_PATTERN.test(code)) {
    throw new ApiError(400, "Invalid university code");
  }

  return code;
};

export const parseHandbookYear = (
  value: unknown,
): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !HANDBOOK_YEAR_PATTERN.test(value)) {
    throw new ApiError(400, "year must be a four-digit year");
  }

  return Number(value);
};

export const parseRequiredHandbookYear = (value: unknown): number => {
  const year = parseHandbookYear(value);

  if (year === undefined) {
    throw new ApiError(400, "year is required");
  }

  return year;
};

export const parseDegreeCode = (value: unknown): string => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (!code || !DEGREE_CODE_PATTERN.test(code)) {
    throw new ApiError(400, "Invalid degree code");
  }

  return code;
};

export const parseComponentCode = (value: unknown): string => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (!code || !COMPONENT_CODE_PATTERN.test(code)) {
    throw new ApiError(400, "Invalid component code");
  }

  return code;
};
