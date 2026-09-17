import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

// Usage: tsx src/script/ranking/seed-engineering-rankings.ts
//
// Seeds QS and THE 2026 Engineering subject rankings for UTS's and USYD's
// flagship Bachelor of Engineering (Honours) degrees (UTS C09066, USYD
// BHENGINE-04).
//
// Data was gathered via an LLM research prompt, not scraped from a live
// source, and despite being asked for citation URLs the model returned
// descriptive labels instead of real links - these numbers have NOT been
// independently verified against the published QS/THE tables. Spot-check
// before relying on them beyond a placeholder.
//
// Requires the UniversityRanking/DegreeRanking tables to already exist -
// see prisma/add-ranking-tables.sql.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed ranking data");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

interface DegreeRankingSeed {
  universityCode: string;
  degreeCode: string;
  source: string;
  category: string;
  year: number;
  rank: number;
  rankBand: string | null;
}

// Bands are stored with `rank` set to the band's lower bound so
// sorting/filtering still works; `rankBand` keeps the original published
// text (e.g. "151-200") for accurate display.
const degreeRankings: DegreeRankingSeed[] = [
  { universityCode: "UTS", degreeCode: "C09066", source: "QS", category: "Engineering & Technology", year: 2026, rank: 77, rankBand: null },
  { universityCode: "USYD", degreeCode: "BHENGINE-04", source: "QS", category: "Engineering & Technology", year: 2026, rank: 46, rankBand: null },
  { universityCode: "UTS", degreeCode: "C09066", source: "QS", category: "Engineering - Civil & Structural", year: 2026, rank: 51, rankBand: "51-100" },
  { universityCode: "USYD", degreeCode: "BHENGINE-04", source: "QS", category: "Engineering - Civil & Structural", year: 2026, rank: 31, rankBand: null },
  { universityCode: "UTS", degreeCode: "C09066", source: "QS", category: "Engineering - Mechanical, Aeronautical & Manufacturing", year: 2026, rank: 151, rankBand: "151-200" },
  { universityCode: "USYD", degreeCode: "BHENGINE-04", source: "QS", category: "Engineering - Mechanical, Aeronautical & Manufacturing", year: 2026, rank: 56, rankBand: null },
  { universityCode: "UTS", degreeCode: "C09066", source: "QS", category: "Engineering - Electrical & Electronic", year: 2026, rank: 64, rankBand: null },
  { universityCode: "USYD", degreeCode: "BHENGINE-04", source: "QS", category: "Engineering - Electrical & Electronic", year: 2026, rank: 47, rankBand: null },
  { universityCode: "UTS", degreeCode: "C09066", source: "QS", category: "Engineering - Chemical", year: 2026, rank: 151, rankBand: "151-200" },
  { universityCode: "USYD", degreeCode: "BHENGINE-04", source: "QS", category: "Engineering - Chemical", year: 2026, rank: 72, rankBand: null },
  { universityCode: "UTS", degreeCode: "C09066", source: "THE", category: "Engineering", year: 2026, rank: 101, rankBand: "101-125" },
  { universityCode: "USYD", degreeCode: "BHENGINE-04", source: "THE", category: "Engineering", year: 2026, rank: 57, rankBand: null },
];

async function main() {
  const degreeCodes = [...new Set(degreeRankings.map((r) => r.degreeCode))];
  const degrees = await prisma.degree.findMany({
    where: { code: { in: degreeCodes } },
    select: {
      id: true,
      code: true,
      HandbookVersion: { select: { University: { select: { code: true } } } },
    },
  });
  const degreeIdByUniversityAndCode = new Map(
    degrees.map((d) => [`${d.HandbookVersion.University.code}|${d.code}`, d.id]),
  );

  const existingRows = await prisma.degreeRanking.findMany({
    select: { id: true, degreeId: true, source: true, category: true, year: true },
  });
  const existingIdByKey = new Map(
    existingRows.map((r) => [`${r.degreeId}|${r.source}|${r.category}|${r.year}`, r.id]),
  );

  let written = 0;
  let skipped = 0;

  for (const entry of degreeRankings) {
    const degreeId = degreeIdByUniversityAndCode.get(`${entry.universityCode}|${entry.degreeCode}`);
    if (!degreeId) {
      console.warn(`Skipping: no degree found for ${entry.universityCode} ${entry.degreeCode}`);
      skipped += 1;
      continue;
    }

    const key = `${degreeId}|${entry.source}|${entry.category}|${entry.year}`;
    const existingId = existingIdByKey.get(key);
    const data = { rank: entry.rank, rankBand: entry.rankBand, updatedAt: new Date() };

    if (existingId) {
      await prisma.degreeRanking.update({ where: { id: existingId }, data });
    } else {
      await prisma.degreeRanking.create({
        data: { id: randomUUID(), degreeId, source: entry.source, category: entry.category, year: entry.year, ...data },
      });
    }
    written += 1;
  }

  console.log(`Done. Wrote ${written} DegreeRanking rows (${skipped} skipped).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
