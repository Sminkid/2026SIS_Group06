import { getPrisma } from "../db/prisma.js";

export const findDegreeDetailRecord = async (
  degreeCode: string,
  universityCode: string,
  handbookYear: number,
) =>
  getPrisma().university.findUnique({
    where: { code: universityCode },
    select: {
      id: true,
      code: true,
      name: true,
      HandbookVersion: {
        where: { year: handbookYear },
        take: 1,
        select: {
          year: true,
          Degree: {
            where: { code: degreeCode },
            take: 1,
            select: {
              id: true,
              code: true,
              name: true,
              creditPoints: true,
              description: true,
              RequirementGroup: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  parentGroupId: true,
                  title: true,
                  description: true,
                  logic: true,
                  requiredCreditPoints: true,
                  maximumCreditPoints: true,
                  sortOrder: true,
                  RequirementItem: {
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                    select: {
                      id: true,
                      itemType: true,
                      rawCode: true,
                      rawName: true,
                      creditPoints: true,
                      sortOrder: true,
                      Subject: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                          creditPoints: true,
                        },
                      },
                      Component: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                          type: true,
                          creditPoints: true,
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

export type DegreeDetailRecord = Awaited<
  ReturnType<typeof findDegreeDetailRecord>
>;
