import type { EmploymentRate, RankingSummary, University } from "../types/handbook";
import type { FeeBasis } from "./feeComparison";

/** QS subject areas, tried in order against the lower-cased course name; the first match wins. */
export const SUBJECT_RULES: Array<[RegExp, string]> = [
  [/accounting|finance/, "Accounting and Finance"],
  [/veterinary/, "Veterinary Science"],
  [/agricultur|agribusiness/, "Agriculture and Forestry"],
  [/wildlife|marine biology|environmental biology|molecular biotech|forensic/, "Biological Sciences"],
  [/architect|built environment|construction/, "Architecture and Built Environment"],
  [/nursing|midwifery/, "Nursing"],
  [/pharmacy/, "Pharmacy and Pharmacology"],
  [/dental|oral health/, "Dentistry"],
  [/psycholog/, "Psychology"],
  [/sport|exercise/, "Sports-Related Subjects"],
  [/radiography|occupational therapy|physiotherapy|speech pathology|biomedicine|medical science|public health|medicine/, "Life Sciences and Medicine"],
  [/\blaws?\b/, "Law and Legal Studies"],
  [/politics|international studies/, "Politics"],
  [/economics/, "Economics and Econometrics"],
  [/social work/, "Social Policy and Administration"],
  [/criminology/, "Sociology"],
  [/music/, "Music"],
  [/design|visual arts|animation/, "Art and Design"],
  [/media|communication|journalism|creative writing|public relations/, "Communication and Media Studies"],
  [/artificial intelligence/, "Data Science and Artificial Intelligence"],
  [/comput|cybersecurity|information technology|information systems|games/, "Computer Science and Information Systems"],
  [/engineering/, "Engineering and Technology"],
  [/commerce|business|management/, "Business and Management Studies"],
  [/mathemat/, "Mathematics"],
  [/education/, "Education and Training"],
  [/language/, "Modern Languages"],
  [/sustainab|environment/, "Environmental Sciences"],
  [/science/, "Natural Sciences"],
  [/\barts\b/, "Arts and Humanities"],
];

export const QS_WORLD_CATEGORY = "Overall";

/** Double degrees span two subjects, so they aren't matched to either yet. */
export const isDoubleDegree = (courseName: string): boolean => {
  const name = courseName.toLowerCase();
  const awards = name.match(/bachelor of|master of|doctor of/g)?.length ?? 0;
  const bachelorAt = name.indexOf("bachelor of");
  return awards > 1 || (bachelorAt !== -1 && name.indexOf("diploma in", bachelorAt) !== -1);
};

export const subjectOf = (courseName: string): string | null => {
  if (isDoubleDegree(courseName)) return null;
  const name = courseName.toLowerCase();
  return SUBJECT_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? null;
};

const qsRanking = (university: University, category: string): RankingSummary | null =>
  university.rankings.find((ranking) => ranking.source === "QS" && ranking.category === category) ?? null;

export const worldRanking = (university: University): RankingSummary | null => qsRanking(university, QS_WORLD_CATEGORY);

/** "#85" for a single position; a band is shown as-is, e.g. "101–150". */
export const formatRank = (ranking: RankingSummary): string =>
  ranking.rankBand ? ranking.rankBand.replace("-", "–") : `#${ranking.rank}`;

/** e.g. "Art and Design: #85"; null when the course has no single matching subject. */
export const subjectRankingLine = (university: University, courseName: string): string | null => {
  const subject = subjectOf(courseName);
  if (subject === null) return null;
  const ranking = qsRanking(university, subject);
  return `${subject}: ${ranking ? formatRank(ranking) : "Not ranked"}`;
};

/** QILT rows store the rate in tenths of a percent; international figures pool the three survey years ending in `year`. */
export const employmentFor = (university: University | undefined, basis: FeeBasis): EmploymentRate | null => {
  const row = university?.rankings.find((ranking) =>
    ranking.source === "QILT" && ranking.category === `Full-time employment (${basis})`);
  if (!row) return null;
  const period = basis === "domestic" ? String(row.year) : `${row.year - 2}–${String(row.year).slice(2)}`;
  return { fullTimeRate: row.rank / 10, period };
};

/** 72.2 → "72.2%", 49 → "49%". */
export const formatPercent = (rate: number): string => `${Math.round(rate * 10) / 10}%`;
