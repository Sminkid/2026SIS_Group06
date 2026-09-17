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
              DegreeRanking: {
                orderBy: [{ year: "desc" }, { source: "asc" }, { category: "asc" }],
                select: {
                  source: true,
                  category: true,
                  year: true,
                  rank: true,
                  rankBand: true,
                },
              },
              RequirementGroup: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  parentGroupId: true,
                  title: true,
                  description: true,
                  logic: true,
                  status: true,
                  nodeType: true,
                  sourcePath: true,
                  sourceUrl: true,
                  rawData: true,
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
                  DegreeComponent: {
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                    select: {
                      id: true,
                      relationshipKind: true,
                      requiredCreditPoints: true,
                      sortOrder: true,
                      Component: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                          type: true,
                          creditPoints: true,
                          RequirementGroup: {
                            where: { parentGroupId: null },
                            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                            select: {
                              id: true,
                              logic: true,
                              requiredCreditPoints: true,
                              maximumCreditPoints: true,
                              status: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  RequirementCandidateSource: {
                    orderBy: [{ title: "asc" }, { id: "asc" }],
                    select: {
                      id: true,
                      sourceKey: true,
                      type: true,
                      title: true,
                      authoritative: true,
                      tableName: true,
                      _count: {
                        select: { RequirementCandidateSubject: true },
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
