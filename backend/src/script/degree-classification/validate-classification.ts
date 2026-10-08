import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { PrismaClient } from "../../generated/prisma/client.js";

// Mirrors the key-generation logic in frontend/src/domain/degreeClassification.ts, inlined
// rather than imported - a static import pulls that file into backend's tsc compile, which
// violates backend/tsconfig.json's rootDir ("src") and also applies backend's stricter
// noUncheckedIndexedAccess option to a file that isn't written against it. Keep this in sync by
// hand if that file's AWARD_PATTERN/FIELD_ALIASES/normalisation logic changes.
const AWARD_PATTERN = "(?:Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma)\\s+(?:of|in)\\b";
const AWARD_SPLIT = new RegExp(`\\s+(?:and\\s+)?(?=${AWARD_PATTERN})`, "i");
const AWARD_PARTS = /^(Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma)\s+(of|in)\s+(.+)$/i;
const HONOURS = /\s*\(?\bHonours\b\)?/gi;
const DELIVERY_VARIANTS = /\s*\((Offshore|off-shore|on-shore|Co-op|Extended)\)/gi;
const FIELD_ALIASES: Record<string, { key: string; label: string }> = {
  "computing science": { key: "computing", label: "Computing" },
};

const normaliseField = (field: string): string =>
  field.toLowerCase().replace(/&/g, "and").replace(/,/g, "").replace(/\s+/g, " ").trim();

const classifyAward = (award: string): { key: string } => {
  const honours = /\bHonours\b/i.test(award);
  const withoutHonours = award.replace(HONOURS, "").replace(/\s+/g, " ").trim();
  const parts = AWARD_PARTS.exec(withoutHonours);
  if (!parts) {
    const field = normaliseField(withoutHonours);
    return { key: `${field}${honours ? ":honours" : ""}` };
  }
  const [, level, , rawField] = parts;
  const levelName = (level ?? "").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const alias = FIELD_ALIASES[normaliseField(rawField ?? "")];
  const field = alias?.key ?? normaliseField(rawField ?? "");
  return { key: `${levelName.toLowerCase()}:${field}${honours ? ":honours" : ""}` };
};

/** Local stand-in for the frontend's classifyDegree() - see the comment above. */
const classifyDegreeKey = (name: string): string => {
  const awards = name.replace(DELIVERY_VARIANTS, "").trim().split(AWARD_SPLIT).filter(Boolean).map(classifyAward);
  return awards.map((award) => award.key).sort().join(" + ");
};

// Usage:
//   tsx src/script/degree-classification/validate-classification.ts --university=UTS
//   tsx src/script/degree-classification/validate-classification.ts --names=./some-names.json
//   (optionally add --provider=anthropic|gemini to force a provider; otherwise auto-detected
//   from whichever of ANTHROPIC_API_KEY / GEMINI_API_KEY is set, preferring Anthropic if both are)
//
// Dev-time validation tool: compares the frontend's regex-based classifyDegree() against a
// LIVE (non-batch) LLM call per degree name, to spot degree names that SHOULD be grouped as the
// same course across universities but currently get different classifyDegree() keys (a missed
// FIELD_ALIASES entry). Read-only - no DB writes, no draft file. Only call this against a small
// slice (one university, or a hand-picked --names list), not the whole catalog - each call costs
// real money and this is meant for spot-checking, not continuous use.
//
// Before deploying, replace this with an offline batch step (same draft -> review -> apply
// pattern as generate-riasec-scores.ts / apply-riasec-scores.ts) that writes reviewed additions
// into FIELD_ALIASES - this script does not do that.

const args = process.argv.slice(2);
const universityFilter = args.find((a) => a.startsWith("--university="))?.split("=")[1];
const namesFile = args.find((a) => a.startsWith("--names="))?.split("=")[1];
const providerArg = args.find((a) => a.startsWith("--provider="))?.split("=")[1];

if (!universityFilter && !namesFile) {
  console.log("Pass --university=CODE or --names=path/to/names.json");
  process.exit(1);
}

type Provider = "anthropic" | "gemini";

const resolveProvider = (): Provider => {
  if (providerArg === "anthropic" || providerArg === "gemini") return providerArg;
  if (providerArg) {
    throw new Error(`Unknown --provider "${providerArg}" - expected "anthropic" or "gemini"`);
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  throw new Error("ANTHROPIC_API_KEY or GEMINI_API_KEY is required to validate degree classification");
};

const provider = resolveProvider();

const CanonicalFieldSchema = z.object({
  canonicalLabel: z.string(),
});

const SYSTEM_PROMPT = [
  "You are given a single university degree name (e.g. \"Bachelor of Psychological Science\").",
  "Identify the core field of study, ignoring the award level (Bachelor/Master/etc.), ignoring",
  "\"Honours\", and ignoring delivery variants like \"(Offshore)\".",
  "Return a short, canonical, university-neutral label for that field - the kind of label that",
  "should be IDENTICAL for two degree names that are the same real-world field under different",
  "wording (e.g. \"Psychology\" and \"Psychological Science\" should both return \"Psychology\").",
].join("\n");

let anthropicClient: Anthropic | undefined;
const getAnthropicClient = (): Anthropic => {
  anthropicClient ??= new Anthropic();
  return anthropicClient;
};

let geminiClient: GoogleGenAI | undefined;
const getGeminiClient = (): GoogleGenAI => {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required to use --provider=gemini");
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
};

const classifyWithAnthropic = async (name: string): Promise<string> => {
  const response = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: SYSTEM_PROMPT + "\nRespond using the required JSON schema only.",
    messages: [{ role: "user", content: `Degree name: ${name}` }],
    output_config: { format: zodOutputFormat(CanonicalFieldSchema) },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in Anthropic response for "${name}"`);
  }
  return CanonicalFieldSchema.parse(JSON.parse(textBlock.text)).canonicalLabel;
};

const classifyWithGemini = async (name: string): Promise<string> => {
  const result = await getGeminiClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Degree name: ${name}`,
    config: {
      systemInstruction:
        SYSTEM_PROMPT +
        '\nRespond with ONLY a JSON object of the shape {"canonicalLabel": "..."} - no other text.',
      maxOutputTokens: 256,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = result.text?.trim();
  if (!text) {
    throw new Error(`Empty Gemini response for "${name}"`);
  }
  // Models sometimes wrap JSON in a ```json fence despite instructions - strip it if present.
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return CanonicalFieldSchema.parse(JSON.parse(jsonText)).canonicalLabel;
};

const classifyLive = (name: string): Promise<string> =>
  provider === "anthropic" ? classifyWithAnthropic(name) : classifyWithGemini(name);

interface DegreeName {
  name: string;
  code?: string;
  university?: string;
}

async function loadDegreeNames(): Promise<DegreeName[]> {
  if (namesFile) {
    const raw = await readFile(namesFile, "utf-8");
    const parsed = JSON.parse(raw) as string[];
    return parsed.map((name) => ({ name }));
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when using --university");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const university = await prisma.university.findUnique({ where: { code: universityFilter! } });
    if (!university) {
      console.log(`"${universityFilter}" was not found in the database - add its handbook data first.`);
      return [];
    }
    const degrees = await prisma.degree.findMany({
      where: { HandbookVersion: { University: { code: universityFilter! } } },
      select: { name: true, code: true, HandbookVersion: { select: { University: { select: { code: true } } } } },
    });
    return degrees.map((d) => ({ name: d.name, code: d.code, university: d.HandbookVersion.University.code }));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const degreeNames = await loadDegreeNames();
  if (degreeNames.length === 0) {
    console.log("Nothing to validate.");
    return;
  }

  console.log(`Validating ${degreeNames.length} degree name(s) against a live ${provider} call each...`);

  const rows: { name: string; code?: string; university?: string; regexKey: string; llmLabel: string }[] = [];
  for (const degree of degreeNames) {
    const regexKey = classifyDegreeKey(degree.name);
    const llmLabel = await classifyLive(degree.name);
    rows.push({ ...degree, regexKey, llmLabel });
  }

  console.log("\nname | regexKey | llmCanonicalLabel");
  for (const row of rows) {
    console.log(`${row.name} | ${row.regexKey} | ${row.llmLabel}`);
  }

  // Group by LLM label so cases where distinct regexKeys share an LLM label stand out - that's
  // the signal for a missed FIELD_ALIASES entry.
  const byLlmLabel = new Map<string, Set<string>>();
  for (const row of rows) {
    const keys = byLlmLabel.get(row.llmLabel) ?? new Set<string>();
    keys.add(row.regexKey);
    byLlmLabel.set(row.llmLabel, keys);
  }

  const mismatches = [...byLlmLabel.entries()].filter(([, keys]) => keys.size > 1);
  if (mismatches.length > 0) {
    console.log("\nPossible missed aliases (same LLM label, different regexKey):");
    for (const [llmLabel, keys] of mismatches) {
      console.log(`  "${llmLabel}": ${[...keys].join(", ")}`);
    }
  } else {
    console.log("\nNo mismatches found - regex classification agrees with the LLM for this set.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
