import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

let client: PrismaClient | undefined;

export const getPrisma = (): PrismaClient => {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required to access handbook data");
  }

  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

  return client;
};

export const disconnectPrisma = async (): Promise<void> => {
  await client?.$disconnect();
};

