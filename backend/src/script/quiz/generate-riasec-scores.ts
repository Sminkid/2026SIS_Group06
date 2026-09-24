import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PrismaClient } from "../../generated/prisma/client.js";

// Usage:
//   tsx prisma/generate-riasec-scores.ts [--university=USYD] [--limit=N] [--degrees-only] [--components-only] [--rescore]
//
// Scores existing Degree/Component rows against the 6 RIASEC categories using
// Claude Haiku 4.5 via the Batch API, and writes one draft file per university
// for human review (riasec-scores.<university-code>.draft.json). Does NOT write
// to the database - see apply-riasec-scores.ts for that step.
//
// By default, degrees/components that already have a RiasecScore are skipped,
// so re-running this only scores what's still missing. Pass --rescore to score
// everything matching the other filters regardless of existing scores.

const args = process.argv.slice(2);
const universityFilter = args.find((a) => a.startsWith("--university="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : undefined;
const degreesOnly = args.includes("--degrees-only");
const componentsOnly = args.includes("--components-only");
const rescore = args.includes("--rescore");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to generate RIASEC scores");
}
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is required to generate RIASEC scores");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const anthropic = new Anthropic();

const CATEGORY_CODES = [
  "REALISTIC",
  "INVESTIGATIVE",
  "ARTISTIC",
  "SOCIAL",
  "ENTERPRISING",
  "CONVENTIONAL",
] as const;

const RiasecScoreSchema = z.object({
  REALISTIC: z.number().min(0).max(1),
  INVESTIGATIVE: z.number().min(0).max(1),
  ARTISTIC: z.number().min(0).max(1),
  SOCIAL: z.number().min(0).max(1),
  ENTERPRISING: z.number().min(0).max(1),
  CONVENTIONAL: z.number().min(0).max(1),
  rationale: z.object({
    REALISTIC: z.string(),
    INVESTIGATIVE: z.string(),
    ARTISTIC: z.string(),
    SOCIAL: z.string(),
    ENTERPRISING: z.string(),
    CONVENTIONAL: z.string(),
  }),
});

interface DraftEntry {
  targetType: "degree" | "component";
  targetId: string;
  university: string;
  code: string;
  name: string;
  scores: Record<(typeof CATEGORY_CODES)[number], number>;
  rationale: Record<(typeof CATEGORY_CODES)[number], string>;
}

async function buildSystemPrompt(): Promise<string> {
  const categories = await prisma.riasecCategory.findMany({
    orderBy: { code: "asc" },
  });

  const categoryLines = categories
    .map((c) => `- ${c.code}: ${c.description ?? c.name}`)
    .join("\n");

  return [
    "You are scoring a university degree or major against the RIASEC vocational interest model.",
    "The 6 categories are:",
    categoryLines,
    "",
    "For the record given by the user, rate how relevant EACH category is to studying it,",
    "independently, on a 0.0-1.0 scale. Categories are not mutually exclusive and scores do",
    "not need to sum to 1 - a record can score high on multiple categories at once.",
    "Base your rating only on the record's actual content (name, code, description).",
    "Respond using the required JSON schema only, with a one-sentence rationale per category.",
  ].join("\n");
}

async function main() {
  const systemPrompt = await buildSystemPrompt();

  const degreeWhere = {
    ...(universityFilter ? { HandbookVersion: { University: { code: universityFilter } } } : {}),
    ...(rescore ? {} : { RiasecScore: { none: {} } }),
  };
  const componentWhere = {
    ...(universityFilter ? { HandbookVersion: { University: { code: universityFilter } } } : {}),
    ...(rescore ? {} : { RiasecScore: { none: {} } }),
  };

  const degrees = componentsOnly
    ? []
    : await prisma.degree.findMany({
        where: degreeWhere,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          HandbookVersion: { select: { University: { select: { code: true } } } },
        },
        ...(limit ? { take: limit } : {}),
      });

  const components = degreesOnly
    ? []
    : await prisma.component.findMany({
        where: componentWhere,
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          rawData: true,
          HandbookVersion: { select: { University: { select: { code: true } } } },
        },
        ...(limit ? { take: limit } : {}),
      });

  console.log(
    `Scoring ${degrees.length} degrees and ${components.length} components` +
      (rescore ? "" : " (already-scored records skipped)") +
      "...",
  );

  const requests: Anthropic.Messages.Batches.BatchCreateParams["requests"] = [];

  for (const degree of degrees) {
    const content = [
      `Name: ${degree.name}`,
      `Code: ${degree.code}`,
      degree.description ? `Description: ${degree.description}` : "Description: (none)",
    ].join("\n");

    requests.push({
      custom_id: `degree-${degree.id}`,
      params: {
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(RiasecScoreSchema) },
      },
    });
  }

  for (const component of components) {
    const rawDataSnippet = component.rawData
      ? JSON.stringify(component.rawData).slice(0, 800)
      : "(none)";
    const content = [
      `Name: ${component.name}`,
      `Code: ${component.code}`,
      `Type: ${component.type}`,
      `Additional data: ${rawDataSnippet}`,
    ].join("\n");

    requests.push({
      custom_id: `component-${component.id}`,
      params: {
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(RiasecScoreSchema) },
      },
    });
  }

  if (requests.length === 0) {
    console.log("Nothing to score - no matching records found.");
    return;
  }

  console.log(`Submitting batch of ${requests.length} requests...`);
  const batch = await anthropic.messages.batches.create({ requests });
  console.log(`Batch ID: ${batch.id}`);

  let current = batch;
  while (current.processing_status !== "ended") {
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    current = await anthropic.messages.batches.retrieve(batch.id);
    console.log(
      `Status: ${current.processing_status} — succeeded: ${current.request_counts.succeeded}, errored: ${current.request_counts.errored}, processing: ${current.request_counts.processing}`,
    );
  }

  const byId = new Map<
    string,
    { targetType: "degree" | "component"; targetId: string; university: string; code: string; name: string }
  >();
  for (const d of degrees) {
    byId.set(`degree-${d.id}`, {
      targetType: "degree",
      targetId: d.id,
      university: d.HandbookVersion.University.code,
      code: d.code,
      name: d.name,
    });
  }
  for (const c of components) {
    byId.set(`component-${c.id}`, {
      targetType: "component",
      targetId: c.id,
      university: c.HandbookVersion.University.code,
      code: c.code,
      name: c.name,
    });
  }

  const draft: DraftEntry[] = [];
  const failures: { customId: string; reason: string }[] = [];

  for await (const result of await anthropic.messages.batches.results(batch.id)) {
    const meta = byId.get(result.custom_id);
    if (!meta) {
      failures.push({ customId: result.custom_id, reason: "unknown custom_id" });
      continue;
    }

    if (result.result.type !== "succeeded") {
      failures.push({ customId: result.custom_id, reason: result.result.type });
      continue;
    }

    const textBlock = result.result.message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      failures.push({ customId: result.custom_id, reason: "no text block in response" });
      continue;
    }

    const parsed = RiasecScoreSchema.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) {
      failures.push({ customId: result.custom_id, reason: `schema validation failed: ${parsed.error.message}` });
      continue;
    }

    const { rationale, ...scores } = parsed.data;
    draft.push({
      targetType: meta.targetType,
      targetId: meta.targetId,
      university: meta.university,
      code: meta.code,
      name: meta.name,
      scores,
      rationale,
    });
  }

  const byUniversity = new Map<string, DraftEntry[]>();
  for (const entry of draft) {
    const list = byUniversity.get(entry.university) ?? [];
    list.push(entry);
    byUniversity.set(entry.university, list);
  }

  for (const [university, entries] of byUniversity) {
    const outPath = new URL(`./riasec-scores.${university.toLowerCase()}.draft.json`, import.meta.url);
    await writeFile(outPath, JSON.stringify(entries, null, 2));
    console.log(`Wrote ${entries.length} scored records for ${university} to ${outPath.pathname}`);
  }

  if (failures.length > 0) {
    console.log(`${failures.length} failures (not written to draft):`);
    for (const f of failures) console.log(`  ${f.customId}: ${f.reason}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
