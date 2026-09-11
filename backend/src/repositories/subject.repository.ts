import { getPrisma } from "../db/prisma.js";

const subjectAccessSelect = {
  select: { hasConditions: true },
} as const;

/** Searches imported subjects with optional component or requirement-group constraints. */
export const findSubjectSearchRecord = async (
  universityCode: string,
  handbookYear: number,
  query: string,
  limit: number,
  componentCode?: string,
  requirementGroupId?: string,
) => getPrisma().university.findUnique({
  where: { code: universityCode },
  select: {
    HandbookVersion: {
      where: { year: handbookYear },
      take: 1,
      select: {
        Component: componentCode
          ? { where: { code: componentCode }, take: 1, select: { id: true } }
          : false,
        Subject: {
          where: {
            ...(query
              ? { OR: [
                  { code: { contains: query, mode: "insensitive" as const } },
                  { name: { contains: query, mode: "insensitive" as const } },
                ] }
              : {}),
            ...(componentCode || requirementGroupId
              ? {
                  RequirementItem: {
                    some: {
                      RequirementGroup: requirementGroupId
                        ? { id: requirementGroupId }
                        : { Component: { is: { code: componentCode! } }, logic: { in: ["ANY", "ONE_OF"] } },
                    },
                  },
                }
              : {}),
          },
          orderBy: [{ code: "asc" }, { name: "asc" }],
          take: limit,
          select: {
            id: true,
            code: true,
            name: true,
            creditPoints: true,
            SubjectAccessCondition: subjectAccessSelect,
          },
        },
      },
    },
  },
});

/** Reads a handbook-scoped subject, its source URL and the original requisite references. */
export const findSubjectDetailRecord = async (
  universityCode: string,
  handbookYear: number,
  subjectCode: string,
) => getPrisma().university.findUnique({
  where: { code: universityCode },
  select: {
    HandbookVersion: {
      where: { year: handbookYear },
      take: 1,
      select: {
        Subject: {
          where: { code: subjectCode },
          take: 1,
          select: {
            id: true,
            code: true,
            name: true,
            creditPoints: true,
            description: true,
            offerings: true,
            sourceUrl: true,
            SubjectAccessCondition: {
              select: {
                hasConditions: true,
                SubjectRequisiteGroup: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  select: {
                    id: true,
                    groupType: true,
                    rule: true,
                    sortOrder: true,
                    SubjectRequisiteItem: {
                      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                      select: {
                        id: true,
                        itemKey: true,
                        requisiteType: true,
                        details: true,
                        rawReferencedCodes: true,
                        sortOrder: true,
                        Subject: { select: { id: true, code: true, name: true } },
                        Component: { select: { id: true, code: true, name: true, type: true } },
                        Degree: { select: { id: true, code: true, name: true } },
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

/** Reads access-condition records for a set of subjects in one handbook-scoped request. */
export const findSubjectAccessConditionsBatchRecord = async (
  universityCode: string,
  handbookYear: number,
  subjectCodes: string[],
) => getPrisma().university.findUnique({
  where: { code: universityCode },
  select: {
    HandbookVersion: {
      where: { year: handbookYear },
      take: 1,
      select: {
        Subject: {
          where: { code: { in: subjectCodes } },
          select: {
            id: true,
            code: true,
            name: true,
            SubjectAccessCondition: {
              select: {
                hasConditions: true,
                SubjectRequisiteGroup: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  select: {
                    id: true,
                    groupType: true,
                    rule: true,
                    sortOrder: true,
                    SubjectRequisiteItem: {
                      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                      select: {
                        id: true,
                        itemKey: true,
                        requisiteType: true,
                        details: true,
                        rawReferencedCodes: true,
                        sortOrder: true,
                        Subject: { select: { id: true, code: true, name: true } },
                        Component: { select: { id: true, code: true, name: true, type: true } },
                        Degree: { select: { id: true, code: true, name: true } },
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

export type SubjectSearchRecord = Awaited<ReturnType<typeof findSubjectSearchRecord>>;
export type SubjectDetailRecord = Awaited<ReturnType<typeof findSubjectDetailRecord>>;
export type SubjectAccessConditionsBatchRecord = Awaited<
  ReturnType<typeof findSubjectAccessConditionsBatchRecord>
>;
