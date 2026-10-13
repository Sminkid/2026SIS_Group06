import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

// Usage:
//   tsx prisma/apply-riasec-scores.ts [--file=riasec-scores.usyd.draft.json]
//
// Reads one or more human-reviewed riasec-scores.<university>.draft.json files
// (produced by generate-riasec-scores.ts, written into the gitignored drafts/ folder next to
// this script) and upserts the scores into RiasecScore. With --file, applies just that file
// (a bare filename, resolved inside drafts/). With no argument, applies every
// riasec-scores.*.draft.json file found in drafts/.

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1];
const draftsDir = join(dirname(fileURLToPath(import.meta.url)), "drafts");

interface DraftEntry {
  targetType: "degree" | "component";
  targetId: string;
  code: string;
  name: string;
  scores: Record<
    "REALISTIC" | "INVESTIGATIVE" | "ARTISTIC" | "SOCIAL" | "ENTERPRISING" | "CONVENTIONAL",
    number
  >;
  subcategoryScores?: Record<string, number>;
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

async function resolveDraftFiles(): Promise<string[]> {
  if (fileArg) return [join(draftsDir, fileArg)];
  const entries = await readdir(draftsDir).catch(() => []);
  return entries
    .filter((name) => /^riasec-scores\..+\.draft\.json$/.test(name))
    .map((name) => join(draftsDir, name));
}

async function main() {
  const draftFiles = await resolveDraftFiles();
  if (draftFiles.length === 0) {
    console.log("No riasec-scores.*.draft.json files found in drafts/ - nothing to apply.");
    return;
  }
  console.log(`Applying ${draftFiles.length} draft file(s): ${draftFiles.map((f) => f.split("/").pop()).join(", ")}`);

  const categories = await prisma.riasecCategory.findMany();
  const categoryIdByCode = new Map(categories.map((c) => [c.code, c.id]));

  const subcategories = await prisma.riasecSubcategory.findMany({ select: { id: true } });
  const validSubcategoryIds = new Set(subcategories.map((sc) => sc.id));

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

  const existingSubcategoryRows = await prisma.riasecSubcategoryScore.findMany({
    select: { id: true, degreeId: true, componentId: true, subcategoryId: true },
  });
  const existingSubcategoryIdByKey = new Map(
    existingSubcategoryRows.map((r) => [rowKey(r.degreeId, r.componentId, r.subcategoryId), r.id]),
  );

  let totalWritten = 0;
  let totalFailed = 0;
  let totalEntries = 0;
  let totalSubcategoryWritten = 0;
  let totalSubcategoryFailed = 0;

  for (const draftPath of draftFiles) {
    const raw = await readFile(draftPath, "utf-8");
    const entries: DraftEntry[] = JSON.parse(raw);
    totalEntries += entries.length;

    let written = 0;
    let failed = 0;
    let subcategoryWritten = 0;
    let subcategoryFailed = 0;
    const totalWrites = entries.reduce((sum, e) => sum + Object.keys(e.scores).length, 0);

    for (const entry of entries) {
      const degreeId = entry.targetType === "degree" ? entry.targetId : null;
      const componentId = entry.targetType === "component" ? entry.targetId : null;

      for (const [code, score] of Object.entries(entry.scores)) {
        const categoryId = categoryIdByCode.get(code as keyof typeof entry.scores);
        if (!categoryId) {
          console.warn(`Unknown RIASEC category code "${code}" for ${entry.targetType}:${entry.targetId} - skipped`);
          continue;
        }

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
          console.log(`  Progress: ${written + failed}/${totalWrites} (${written} written, ${failed} failed)`);
        }
      }

      for (const [subcategoryId, score] of Object.entries(entry.subcategoryScores ?? {})) {
        if (!validSubcategoryIds.has(subcategoryId)) {
          console.warn(`Unknown RIASEC subcategory id "${subcategoryId}" for ${entry.targetType}:${entry.targetId} - skipped`);
          continue;
        }

        const key = rowKey(degreeId, componentId, subcategoryId);
        const existingId = existingSubcategoryIdByKey.get(key);

        try {
          if (existingId) {
            await prisma.riasecSubcategoryScore.update({
              where: { id: existingId },
              data: { score, updatedAt: new Date() },
            });
          } else {
            const created = await prisma.riasecSubcategoryScore.create({
              data: { id: randomUUID(), degreeId, componentId, subcategoryId, score, updatedAt: new Date() },
            });
            existingSubcategoryIdByKey.set(key, created.id);
          }
          subcategoryWritten += 1;
        } catch (error) {
          subcategoryFailed += 1;
          console.error(`Failed to write subcategory score ${entry.targetType}:${entry.targetId} / ${subcategoryId}:`, error);
        }
      }
    }

    console.log(
      `  ${draftPath.split("/").pop()}: wrote ${written} RiasecScore rows and ${subcategoryWritten} RiasecSubcategoryScore rows from ${entries.length} records (${failed} category failures, ${subcategoryFailed} subcategory failures).`,
    );
    totalWritten += written;
    totalFailed += failed;
    totalSubcategoryWritten += subcategoryWritten;
    totalSubcategoryFailed += subcategoryFailed;
  }

  console.log(
    `Done. Wrote ${totalWritten} RiasecScore rows and ${totalSubcategoryWritten} RiasecSubcategoryScore rows from ${totalEntries} reviewed records across ${draftFiles.length} file(s) (${totalFailed} category failures, ${totalSubcategoryFailed} subcategory failures).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
