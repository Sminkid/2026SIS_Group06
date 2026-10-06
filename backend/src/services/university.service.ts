import {
  findUniversities,
  findUniversityHandbook,
  findUniversityHandbookWithDegrees,
} from "../repositories/university.repository.js";
import type {
  DegreeSummary,
  HandbookSummary,
  UniversitySummary,
} from "../types/university.js";
import { ApiError } from "../utils/api-error.js";

export const getUniversities = async (): Promise<UniversitySummary[]> => {
  const universities = await findUniversities();

  return universities.map((university) => ({
    id: university.id,
    code: university.code,
    name: university.name,
    rankings: university.UniversityRanking.map((ranking) => ({
      source: ranking.source,
      category: ranking.category,
      year: ranking.year,
      rank: ranking.rank,
      rankBand: ranking.rankBand,
    })),
  }));
};

const handbookNotFound = (universityCode: string, year?: number): ApiError =>
  new ApiError(
    404,
    year === undefined
      ? `No handbook versions found for university '${universityCode}'`
      : `No ${year} handbook found for university '${universityCode}'`,
  );

export const getLatestHandbook = async (
  universityCode: string,
): Promise<HandbookSummary> => {
  const university = await findUniversityHandbook(universityCode);

  if (!university) {
    throw new ApiError(404, `University '${universityCode}' not found`);
  }

  const handbook = university.HandbookVersion[0];
  if (!handbook) {
    throw handbookNotFound(universityCode);
  }

  return {
    id: handbook.id,
    universityCode: university.code,
    year: handbook.year,
    sourceUrl: handbook.sourceUrl,
  };
};

export const getUniversityDegrees = async (
  universityCode: string,
  year?: number,
): Promise<DegreeSummary[]> => {
  const university = await findUniversityHandbookWithDegrees(
    universityCode,
    year,
  );

  if (!university) {
    throw new ApiError(404, `University '${universityCode}' not found`);
  }

  const handbook = university.HandbookVersion[0];
  if (!handbook) {
    throw handbookNotFound(universityCode, year);
  }

  return handbook.Degree.map((degree) => ({
    id: degree.id,
    code: degree.code,
    name: degree.name,
    creditPoints: degree.creditPoints,
    handbookYear: handbook.year,
  }));
};
