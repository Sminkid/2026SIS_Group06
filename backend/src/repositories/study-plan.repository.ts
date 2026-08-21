import { getPrisma } from "../db/prisma.js";

export const findDegreeStudyPlansRecord = async (
  degreeCode: string,
  universityCode: string,
  handbookYear: number,
) => getPrisma().university.findUnique({
  where: { code: universityCode },
  select: {
    HandbookVersion: {
      where: { year: handbookYear },
      take: 1,
      select: {
        Degree: {
          where: { code: degreeCode },
          take: 1,
          select: {
            StudyPlan: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                title: true,
                description: true,
                sourceUrl: true,
                StudyPlanYear: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  select: {
                    id: true,
                    name: true,
                    sortOrder: true,
                    StudyPlanPeriod: {
                      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                      select: {
                        id: true,
                        name: true,
                        sortOrder: true,
                        StudyPlanItem: {
                          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                          select: {
                            id: true,
                            itemType: true,
                            rawCode: true,
                            title: true,
                            creditPoints: true,
                            numberOfPeriods: true,
                            sortOrder: true,
                            Subject: { select: { id: true, code: true, name: true, creditPoints: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

export type DegreeStudyPlansRecord = Awaited<ReturnType<typeof findDegreeStudyPlansRecord>>;
