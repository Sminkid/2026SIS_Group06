import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Usage: tsx prisma/apply-riasec-scores.ts
//
// Reads the human-reviewed prisma/riasec-scores.draft.json (produced by
// generate-riasec-scores.ts) and upserts the scores into RiasecScore.

interface DraftEntry {
  targetType: "degree" | "component";
  targetId: string;
  code: string;
  name: string;
  scores: Record<
    "REALISTIC" | "INVESTIGATIVE" | "ARTISTIC" | "SOCIAL" | "ENTERPRISING" | "CONVENTIONAL",
    number
  >;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply RIASEC scores");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const draftPath = new URL("./riasec-scores.draft.json", import.meta.url);
  const raw = await readFile(draftPath, "utf-8");
  const entries: DraftEntry[] = JSON.parse(raw);

  const categories = await prisma.riasecCategory.findMany();
  const categoryIdByCode = new Map(categories.map((c) => [c.code, c.id]));

  let written = 0;

  for (const entry of entries) {
    for (const [code, score] of Object.entries(entry.scores)) {
      const categoryId = categoryIdByCode.get(code as keyof typeof entry.scores);
      if (!categoryId) {
        console.warn(`Unknown RIASEC category code "${code}" for ${entry.targetType}:${entry.targetId} - skipped`);
        continue;
      }

      const degreeId = (entry.targetType === "degree" ? entry.targetId : null) as string;
      const componentId = (entry.targetType === "component" ? entry.targetId : null) as string;

      await prisma.riasecScore.upsert({
        where: {
          degreeId_componentId_categoryId: { degreeId, componentId, categoryId },
        },
        update: { score, updatedAt: new Date() },
        create: { id: randomUUID(), degreeId, componentId, categoryId, score, updatedAt: new Date() },
      });
      written += 1;
    }
  }

  console.log(`Wrote ${written} RiasecScore rows from ${entries.length} reviewed records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
