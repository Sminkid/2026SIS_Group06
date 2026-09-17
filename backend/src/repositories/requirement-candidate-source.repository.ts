import { getPrisma } from "../db/prisma.js";

const candidateSourceSelect = {
  id: true,
  sourceKey: true,
  type: true,
  title: true,
  authoritative: true,
  tableName: true,
  _count: { select: { RequirementCandidateSubject: true } },
} as const;

export const findRequirementCandidateSubjects = async (
  sourceId: string,
  query: string,
  page: number,
  limit: number,
) => {
  const prisma = getPrisma();
  const source = await prisma.requirementCandidateSource.findUnique({
    where: { id: sourceId },
    select: candidateSourceSelect,
  });
  if (!source) return null;

  const where = {
    candidateSourceId: sourceId,
    ...(query ? {
      Subject: {
        is: {
          OR: [
            { code: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        },
      },
    } : {}),
  };
  const [total, memberships] = await prisma.$transaction([
    prisma.requirementCandidateSubject.count({ where }),
    prisma.requirementCandidateSubject.findMany({
      where,
      orderBy: [
        { Subject: { code: "asc" } },
        { Subject: { name: "asc" } },
        { subjectId: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        Subject: {
          select: { id: true, code: true, name: true, creditPoints: true },
        },
      },
    }),
  ]);

  return { source, total, memberships };
};
