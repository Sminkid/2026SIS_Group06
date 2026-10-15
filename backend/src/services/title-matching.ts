/**
 * Title-based matching of equivalent degrees/components across universities. Pure (no Prisma/DB access) so it is
 * unit-testable in isolation, like assessment-scoring.ts.
 *
 * Universities name the same course slightly differently ("Bachelor of Engineering (Honours)" vs "Bachelor of
 * Engineering Honours", "Psychology" vs "Psychological Science"). Titles are normalised into an award level, an
 * honours flag and a set of field tokens, then compared with a fuzzy token-set Dice score.
 */

const AWARD_LEVELS = "Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma";
const AWARD_SPLIT = new RegExp(`\\s+(?:and\\s+)?(?=(?:${AWARD_LEVELS})\\s+(?:of|in)\\b)`, "i");
const AWARD_PARTS = new RegExp(`^(${AWARD_LEVELS})\\s+(?:of|in)\\s+(.+)$`, "i");

/** Bracketed text that carries no field information. Any other bracket is unwrapped, since the field can live in it. */
const NOISE_BRACKET = /\(\s*(honours?|hons|offshore|off-shore|on-shore|co-op|extended|advanced|pass)\s*\)/gi;
const HONOURS = /\bhonou?rs\b|\bhons\b/gi;

/** Words that label the kind of component rather than the field, e.g. "Computer Science Major". */
const LABEL_WORDS = new Set(["major", "minor", "stream", "specialisation", "specialization", "sequence"]);
const STOPWORDS = new Set(["of", "in", "and", "the", "for", "a", "to", "with"]);
/** Qualifiers that rarely distinguish one course from another; ignored when other tokens remain. */
const SOFT_WORDS = new Set(["studies", "general", "program", "programme", "applied"]);

/**
 * Titles that are the same course under a different name, keyed by normalised field text. Add an entry when the
 * fuzzy comparison can't tell (token logic alone can't separate "Psychology"/"Psychological Science" from
 * "Engineering"/"Engineering Science", so known equivalences go here).
 */
const TITLE_ALIASES: Record<string, string> = {
  "psychological science": "psychology",
  "computing science": "computing",
};

export interface NormalisedTitle {
  /** Award level(s), e.g. "bachelor" or "bachelor+bachelor" for a combined degree; "" for components. */
  level: string;
  honours: boolean;
  tokens: string[];
}

const stem = (word: string): string => {
  if (word.length <= 5) return word;
  return word.replace(/(ological|ology|ical|ics|ing|ies|es|s|y|al|ic)$/, "") || word;
};

const tokenise = (text: string): string[] =>
  text
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word) && !LABEL_WORDS.has(word))
    .map(stem);

const normaliseField = (raw: string): string[] => {
  const cleaned = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alias = TITLE_ALIASES[cleaned];
  const tokens = tokenise(alias ?? cleaned);
  const withoutSoft = tokens.filter((token) => !SOFT_WORDS.has(token));
  return withoutSoft.length > 0 ? withoutSoft : tokens;
};

export const normaliseTitle = (name: string): NormalisedTitle => {
  const honours = /\bhonou?rs\b|\bhons\b/i.test(name);
  const withoutNoise = name
    .replace(NOISE_BRACKET, " ")
    .replace(HONOURS, " ")
    .replace(/\s+/g, " ")
    .trim();

  const levels: string[] = [];
  const tokens = new Set<string>();
  for (const award of withoutNoise.split(AWARD_SPLIT).filter(Boolean)) {
    const parts = AWARD_PARTS.exec(award.trim());
    if (parts) levels.push(parts[1]!.toLowerCase());
    for (const token of normaliseField(parts ? parts[2]! : award)) tokens.add(token);
  }
  return { level: levels.sort().join("+"), honours, tokens: [...tokens].sort() };
};

const editDistance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
};

/** Tokens match when equal, or close enough to be a spelling variant (organisation/organization). */
const tokensMatch = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length) >= 0.8;
};

const diceSimilarity = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const unmatched = [...b];
  let matches = 0;
  for (const token of a) {
    const index = unmatched.findIndex((candidate) => tokensMatch(token, candidate));
    if (index >= 0) {
      matches++;
      unmatched.splice(index, 1);
    }
  }
  return (2 * matches) / (a.length + b.length);
};

/** 0..1 similarity between two titles; 0 when award level or honours differ (those are different courses). */
export const titleSimilarity = (a: string, b: string): number => {
  const left = normaliseTitle(a);
  const right = normaliseTitle(b);
  if (left.level !== right.level || left.honours !== right.honours) return 0;
  return diceSimilarity(left.tokens, right.tokens);
};

export const DEFAULT_TITLE_THRESHOLD = 0.8;

export interface TitleItem {
  id: string;
  name: string;
  /** Only items of the same kind are compared, e.g. "DEGREE", or a component type such as "MAJOR". */
  kind: string;
}

/** Maps each item id to a group id shared by all items judged to be the same course. */
export const groupEquivalentTitles = (
  items: TitleItem[],
  threshold: number = DEFAULT_TITLE_THRESHOLD,
): Map<string, string> => {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    parent[index] = root;
    return root;
  };

  const normalised = items.map((item) => normaliseTitle(item.name));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i]!.kind !== items[j]!.kind) continue;
      const left = normalised[i]!;
      const right = normalised[j]!;
      if (left.level !== right.level || left.honours !== right.honours) continue;
      if (diceSimilarity(left.tokens, right.tokens) >= threshold) {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) parent[Math.max(rootI, rootJ)] = Math.min(rootI, rootJ);
      }
    }
  }
  return new Map(items.map((item, index) => [item.id, items[find(index)]!.id]));
};
