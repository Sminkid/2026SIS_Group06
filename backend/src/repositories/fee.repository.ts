import { getPrisma } from "../db/prisma.js";

export const findCourseFees = async () =>
  getPrisma().courseFee.findMany({
    select: {
      feeYear: true,
      domesticFee: true,
      internationalFee: true,
      Degree: {
        select: {
          id: true,
          code: true,
          name: true,
          creditPoints: true,
          HandbookVersion: {
            select: {
              year: true,
              University: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ Degree: { name: "asc" } }, { Degree: { code: "asc" } }],
  });
