-- Adds UniversityRanking and DegreeRanking tables.
-- NOT yet applied to the shared dev database — for review and manual
-- application (see README: migrations aren't run against the shared DB
-- from this repo yet).
--
-- Generated with:
--   npx prisma migrate diff --from-schema <schema before these models> \
--     --to-schema prisma/schema.prisma --script
-- so it matches backend/prisma/schema.prisma exactly. Regenerate the same
-- way if the schema changes before this is applied.
--
-- `category` disambiguates multiple rankings from the same source/year for
-- the same entity (e.g. QS 2026 publishes both an overall "Engineering &
-- Technology" rank and separate sub-discipline ranks like "Civil &
-- Structural" for the same university in the same year).
-- `rankBand` preserves the original text when a source publishes a range
-- instead of an exact position (e.g. "151-200"); `rank` still holds a
-- plain integer in that case (the band's lower bound) so sorting/filtering
-- keeps working without special-casing bands.

-- CreateTable
CREATE TABLE "DegreeRanking" (
    "id" TEXT NOT NULL,
    "degreeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "rankBand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DegreeRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversityRanking" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "rankBand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversityRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DegreeRanking_degreeId_idx" ON "DegreeRanking"("degreeId");

-- CreateIndex
CREATE UNIQUE INDEX "DegreeRanking_degreeId_source_category_year_key" ON "DegreeRanking"("degreeId", "source", "category", "year");

-- CreateIndex
CREATE INDEX "UniversityRanking_universityId_idx" ON "UniversityRanking"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "UniversityRanking_universityId_source_category_year_key" ON "UniversityRanking"("universityId", "source", "category", "year");

-- AddForeignKey
ALTER TABLE "DegreeRanking" ADD CONSTRAINT "DegreeRanking_degreeId_fkey" FOREIGN KEY ("degreeId") REFERENCES "Degree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityRanking" ADD CONSTRAINT "UniversityRanking_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
