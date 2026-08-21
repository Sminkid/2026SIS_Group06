import { getPrisma } from "../db/prisma.js";
import type { UniversitySummary } from "../types/university.js";

const handbookFilter = (year: number | undefined) =>
  year === undefined ? {} : { year };

export const findUniversities = async (): Promise<UniversitySummary[]> =>
  getPrisma().university.findMany({
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

export const findUniversityHandbook = async (
  universityCode: string,
  year?: number,
) =>
  getPrisma().university.findUnique({
    where: { code: universityCode },
    select: {
      code: true,
      HandbookVersion: {
        where: handbookFilter(year),
        orderBy: { year: "desc" },
        take: 1,
        select: {
          id: true,
          year: true,
          sourceUrl: true,
        },
      },
    },
  });

export const findUniversityHandbookWithDegrees = async (
  universityCode: string,
  year?: number,
) =>
  getPrisma().university.findUnique({
    where: { code: universityCode },
    select: {
      code: true,
      HandbookVersion: {
        where: handbookFilter(year),
        orderBy: { year: "desc" },
        take: 1,
        select: {
          year: true,
          Degree: {
            orderBy: [{ name: "asc" }, { code: "asc" }],
            select: {
              id: true,
              code: true,
              name: true,
              creditPoints: true,
            },
          },
        },
      },
    },
  });
