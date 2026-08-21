import { getPrisma } from "../db/prisma.js";

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};
