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

function rowKey(degreeId: string | null, componentId: string | null, categoryId: string): string {
  return `${degreeId ?? ""}|${componentId ?? ""}|${categoryId}`;
}

async function main() {
  const draftPath = new URL("./riasec-scores.draft.json", import.meta.url);
  const raw = await readFile(draftPath, "utf-8");
  const entries: DraftEntry[] = JSON.parse(raw);

  const categories = await prisma.riasecCategory.findMany();
  const categoryIdByCode = new Map(categories.map((c) => [c.code, c.id]));

  // Prisma's compound-unique shorthand requires every field non-null, even
  // though degreeId/componentId are nullable columns - so this can't use
  // upsert()'s where shorthand. Load existing rows once and emulate it with
  // an in-memory lookup instead of a findFirst() per write (halves round trips).
  const existingRows = await prisma.riasecScore.findMany({
    select: { id: true, degreeId: true, componentId: true, categoryId: true },
  });
  const existingIdByKey = new Map(
    existingRows.map((r) => [rowKey(r.degreeId, r.componentId, r.categoryId), r.id]),
  );

  let written = 0;
  let failed = 0;
  const totalWrites = entries.reduce((sum, e) => sum + Object.keys(e.scores).length, 0);

  for (const entry of entries) {
    for (const [code, score] of Object.entries(entry.scores)) {
      const categoryId = categoryIdByCode.get(code as keyof typeof entry.scores);
      if (!categoryId) {
        console.warn(`Unknown RIASEC category code "${code}" for ${entry.targetType}:${entry.targetId} - skipped`);
        continue;
      }

      const degreeId = entry.targetType === "degree" ? entry.targetId : null;
      const componentId = entry.targetType === "component" ? entry.targetId : null;
      const key = rowKey(degreeId, componentId, categoryId);
      const existingId = existingIdByKey.get(key);

      try {
        if (existingId) {
          await prisma.riasecScore.update({
            where: { id: existingId },
            data: { score, updatedAt: new Date() },
          });
        } else {
          const created = await prisma.riasecScore.create({
            data: { id: randomUUID(), degreeId, componentId, categoryId, score, updatedAt: new Date() },
          });
          existingIdByKey.set(key, created.id);
        }
        written += 1;
      } catch (error) {
        failed += 1;
        console.error(`Failed to write ${entry.targetType}:${entry.targetId} / ${code}:`, error);
      }

      if ((written + failed) % 200 === 0) {
        console.log(`Progress: ${written + failed}/${totalWrites} (${written} written, ${failed} failed)`);
      }
    }
  }

  console.log(`Done. Wrote ${written} RiasecScore rows from ${entries.length} reviewed records (${failed} failed).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
