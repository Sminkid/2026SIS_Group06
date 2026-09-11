import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

interface CategorySeed {
  id: string;
  code: "REALISTIC" | "INVESTIGATIVE" | "ARTISTIC" | "SOCIAL" | "ENTERPRISING" | "CONVENTIONAL";
  name: string;
  description: string;
  subcategories: { id: string; name: string }[];
}

// RIASEC categories and O*NET Basic Interest Marker subcategories.
// Categories are standard and unambiguous; the subcategory list below is a
// best-effort reconstruction and has NOT been verified against the current
// official O*NET taxonomy — spot-check before treating this as final data.
const categories: CategorySeed[] = [
  {
    id: "riasec-realistic",
    code: "REALISTIC",
    name: "Realistic",
    description: "Interest in working with things, tools, machines, and the outdoors.",
    subcategories: [
      { id: "riasec-realistic-mechanics", name: "Mechanics/Electronics" },
      { id: "riasec-realistic-construction", name: "Building/Construction" },
      { id: "riasec-realistic-manual-labor", name: "Physical/Manual Labor" },
      { id: "riasec-realistic-agriculture", name: "Agriculture" },
      { id: "riasec-realistic-transportation", name: "Transportation/Machine Operation" },
      { id: "riasec-realistic-protective-service", name: "Protective Service" },
      { id: "riasec-realistic-athletics", name: "Athletics" },
    ],
  },
  {
    id: "riasec-investigative",
    code: "INVESTIGATIVE",
    name: "Investigative",
    description: "Interest in researching, analyzing, and understanding how things work.",
    subcategories: [
      { id: "riasec-investigative-life-sciences", name: "Life Sciences" },
      { id: "riasec-investigative-physical-sciences", name: "Physical Sciences" },
      { id: "riasec-investigative-medical-science", name: "Medical Science" },
      { id: "riasec-investigative-social-sciences", name: "Social Sciences" },
      { id: "riasec-investigative-mathematics", name: "Mathematics/Statistics" },
    ],
  },
  {
    id: "riasec-artistic",
    code: "ARTISTIC",
    name: "Artistic",
    description: "Interest in creative, original, and unstructured self-expression.",
    subcategories: [
      { id: "riasec-artistic-visual-arts", name: "Visual Arts/Design" },
      { id: "riasec-artistic-performing-arts", name: "Performing Arts" },
      { id: "riasec-artistic-music", name: "Music" },
      { id: "riasec-artistic-writing-media", name: "Writing/Media" },
      { id: "riasec-artistic-culinary", name: "Culinary Arts" },
    ],
  },
  {
    id: "riasec-social",
    code: "SOCIAL",
    name: "Social",
    description: "Interest in helping, teaching, and working closely with people.",
    subcategories: [
      { id: "riasec-social-teaching", name: "Teaching/Education" },
      { id: "riasec-social-counseling", name: "Counseling/Social Work" },
      { id: "riasec-social-health-care", name: "Health Care Service" },
      { id: "riasec-social-religious-activities", name: "Religious Activities" },
      { id: "riasec-social-community-service", name: "Personal/Community Service" },
    ],
  },
  {
    id: "riasec-enterprising",
    code: "ENTERPRISING",
    name: "Enterprising",
    description: "Interest in leading, persuading, selling, and managing for organizational goals.",
    subcategories: [
      { id: "riasec-enterprising-sales", name: "Sales" },
      { id: "riasec-enterprising-management", name: "Management/Administration" },
      { id: "riasec-enterprising-marketing", name: "Marketing/Advertising" },
      { id: "riasec-enterprising-entrepreneurship", name: "Entrepreneurship" },
      { id: "riasec-enterprising-law-politics", name: "Law/Politics" },
      { id: "riasec-enterprising-human-resources", name: "Human Resources" },
    ],
  },
  {
    id: "riasec-conventional",
    code: "CONVENTIONAL",
    name: "Conventional",
    description: "Interest in organizing, structured data, and following clear procedures.",
    subcategories: [
      { id: "riasec-conventional-clerical", name: "Office/Clerical Work" },
      { id: "riasec-conventional-accounting", name: "Accounting/Auditing" },
      { id: "riasec-conventional-banking-finance", name: "Banking/Finance" },
      { id: "riasec-conventional-records", name: "Records/Information Management" },
    ],
  },
];

async function main() {
  for (const category of categories) {
    await prisma.riasecCategory.upsert({
      where: { id: category.id },
      update: {
        code: category.code,
        name: category.name,
        description: category.description,
        updatedAt: new Date(),
      },
      create: {
        id: category.id,
        code: category.code,
        name: category.name,
        description: category.description,
        updatedAt: new Date(),
      },
    });

    for (const subcategory of category.subcategories) {
      await prisma.riasecSubcategory.upsert({
        where: { id: subcategory.id },
        update: {
          categoryId: category.id,
          name: subcategory.name,
          updatedAt: new Date(),
        },
        create: {
          id: subcategory.id,
          categoryId: category.id,
          code: subcategory.id,
          name: subcategory.name,
          updatedAt: new Date(),
        },
      });
    }
  }

  const subcategoryCount = categories.reduce((sum, c) => sum + c.subcategories.length, 0);
  console.log(`Seeded ${categories.length} RIASEC categories and ${subcategoryCount} subcategories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
