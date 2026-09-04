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

export const parseComponentIdentifier = (value: unknown): string => {
  const identifier = typeof value === "string" ? value.trim() : "";
  if (!identifier || identifier.length > 160 || !/^[A-Za-z0-9:_-]+$/.test(identifier)) {
    throw new ApiError(400, "Invalid component identifier");
  }
  return identifier;
};

export const parseRequirementGroupId = (value: unknown): string => {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new ApiError(400, "Invalid requirement group id");
  }
  return id;
};

export const parseSubjectCode = (value: unknown): string => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!code || !/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(code)) {
    throw new ApiError(400, "Invalid subject code");
  }
  return code;
};

export const parseSubjectSearchQuery = (
  value: unknown,
  hasComponentScope: boolean,
): string => {
  if (value === undefined && hasComponentScope) return "";
  if (typeof value !== "string") throw new ApiError(400, "q is required");
  const query = value.trim();
  if (query.length < 2 || query.length > 100) {
    throw new ApiError(400, "q must contain between 2 and 100 characters");
  }
  return query;
};

export const parseSearchLimit = (value: unknown): number => {
  if (value === undefined) return 20;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ApiError(400, "limit must be an integer between 1 and 50");
  }
  const limit = Number(value);
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "limit must be an integer between 1 and 50");
  }
  return limit;
const MAX_CHAT_QUESTION_LENGTH = 500;

export const parseChatQuestion = (value: unknown): string => {
  const question = typeof value === "string" ? value.trim() : "";

  if (!question) {
    throw new ApiError(400, "question is required");
  }

  if (question.length > MAX_CHAT_QUESTION_LENGTH) {
    throw new ApiError(
      400,
      `question must be ${MAX_CHAT_QUESTION_LENGTH} characters or fewer`,
    );
  }

  return question;
};
