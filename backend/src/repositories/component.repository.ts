import { getPrisma } from "../db/prisma.js";

export const findComponentDetailRecord = async (
  componentIdentifier: string,
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
          Component: {
            where: { OR: [{ id: componentIdentifier }, { code: componentIdentifier.toUpperCase() }] },
            take: 1,
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              originalType: true,
              creditPoints: true,
              sourceUrl: true,
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
                      Subject: { select: { id: true, code: true, name: true, creditPoints: true } },
                      Component: { select: { id: true, code: true, name: true, type: true, creditPoints: true } },
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

export type ComponentDetailRecord = Awaited<ReturnType<typeof findComponentDetailRecord>>;
