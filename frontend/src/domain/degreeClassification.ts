/**
 * Universities name the same qualification differently, e.g. UTS "Bachelor of Engineering (Honours)" and USYD
 * "Bachelor of Engineering Honours", or UTS "Bachelor of Science Bachelor of Laws" and USYD "Bachelor of Science
 * and Bachelor of Laws". Classifying a name into a canonical key lets those offerings be counted and compared as
 * one course, while keeping genuinely different degrees (honours vs pass, single vs combined) apart.
 *
 * UNSW lists most programs by title alone ("Computer Science", "Engineering (Honours)") and shortens the rest
 * ("1st Yr - Bachelor Computer Science / Arts", "Grad Dip - Engineering Science - Biomedical Engineering"), so its
 * names are first expanded into the same "Bachelor of …" form using the program code.
 */

const AWARD_PATTERN = "(?:Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma)\\s+(?:of|in)\\b";
// Never split inside "Graduate Diploma", whose "Diploma in" would otherwise look like a second award.
const AWARD_SPLIT = new RegExp(`(?<!Graduate)\\s+(?:and\\s+)?(?=${AWARD_PATTERN})`, "i");
const AWARD_PARTS = /^(Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma)\s+(of|in)\s+(.+)$/i;
const HONOURS = /\s*\(?\bHonours\b\)?/gi;

/** Delivery options of the same qualification; they're grouped with it rather than counted as another course. */
const DELIVERY_VARIANTS = /\s*\((Offshore|off-shore|on-shore|Co-op|Extended|Bengaluru)\)/gi;
/** UNSW marks its main campus on some titles, e.g. "Cyber Security (Sydney)"; that's the standard offering. */
const MAIN_CAMPUS = /\s*\(Sydney\)/gi;

/** UNSW program codes are four digits, and the first digits give the award level. */
const UNSW_PROGRAM_CODE = /^\d{4}$/;
/** UNSW specialisation codes, e.g. AEROAH. Those ending in H are Bachelor of Engineering (Honours) streams; the rest are minors. */
const UNSW_SPECIALISATION_CODE = /^[A-Z]{4}[A-Z0-9]{2}$/;
const ENGINEERING_HONOURS = "Bachelor of Engineering (Honours)";

const levelForProgramCode = (code: string): string => {
  if (code.startsWith("5")) return "Graduate Diploma in";
  if (code.startsWith("70")) return "Undergraduate Certificate in";
  if (code.startsWith("7")) return "Graduate Certificate in";
  if (code.startsWith("8")) return "Master of";
  return "Bachelor of";
};

/** UNSW shorthand, expanded before the name is split into awards. */
const SHORTHAND: Array<[RegExp, string]> = [
  [/^1st Yr - /i, ""],
  [/^Grad(?:uate)? Dip(?:loma)?(?: in| -)\s*/i, "Graduate Diploma in "],
  [/^Grad(?:uate)? Cert(?:ificate)?(?: in| -)\s*/i, "Graduate Certificate in "],
  [/\bEng\b/g, "Engineering"],
  [/\bHons\b/g, "Honours"],
  [/\s+w\s+/g, " with "],
  // "Master Food Science - Food Science and Technology": the part after " - " is the specialisation.
  [/\s+-\s+.*$/, ""],
  [/^(Bachelor|Master)\s+(?!of\b)/i, "$1 of "],
];
const COMBINED_SEPARATOR = /\s+\/\s+/;
const PART_LEVEL = /^(Bachelor|Master)(?:\s+of)?\s+/i;

/**
 * Fields that are the same qualification under a different name at another university, keyed by the normalised
 * field. Add an entry here when two universities' degrees should be compared as one course.
 */
const FIELD_ALIASES: Record<string, { key: string; label: string }> = {
  "computing science": { key: "computing", label: "Computing" },
  "computer science": { key: "computing", label: "Computing" },
  "cyber security": { key: "cybersecurity", label: "Cybersecurity" },
  law: { key: "laws", label: "Laws" },
  "criminology and criminal justice": { key: "criminology", label: "Criminology" },
  "exercise science": { key: "sport and exercise science", label: "Sport and Exercise Science" },
};

export interface DegreeClassification {
  /** Equal for equivalent degrees across universities. */
  key: string;
  /** University-neutral name for the course. */
  displayName: string;
  /** Delivery option such as "Offshore" or a UNSW engineering specialisation, or null for the standard offering. */
  variant: string | null;
  /** False for entries that aren't a degree a student enrols in, such as a UNSW minor. */
  isCourse: boolean;
}

const normaliseField = (field: string): string =>
  field.toLowerCase().replace(/&/g, "and").replace(/,/g, "").replace(/\s+/g, " ").trim();

const classifyAward = (award: string): { key: string; label: string } => {
  const honours = /\bHonours\b/i.test(award);
  const withoutHonours = award.replace(HONOURS, "").replace(/\s+/g, " ").trim();
  const parts = AWARD_PARTS.exec(withoutHonours);
  if (!parts) {
    const field = normaliseField(withoutHonours);
    return { key: `${field}${honours ? ":honours" : ""}`, label: award.trim() };
  }
  const [, level, connector, rawField] = parts;
  const levelName = level.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const alias = FIELD_ALIASES[normaliseField(rawField)];
  const field = alias?.key ?? normaliseField(rawField);
  const fieldLabel = alias?.label ?? rawField.trim();
  return {
    key: `${levelName.toLowerCase()}:${field}${honours ? ":honours" : ""}`,
    label: `${levelName} ${connector.toLowerCase()} ${fieldLabel}${honours ? " (Honours)" : ""}`,
  };
};

/**
 * Rewrites a UNSW-style name into "Bachelor of X and Bachelor of Y" form. Names that already start with an award,
 * like every UTS and USYD name, come back unchanged apart from the shorthand.
 */
const expandName = (name: string, code: string | undefined): string => {
  const expanded = SHORTHAND.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), name.trim());
  const firstLevel = code && UNSW_PROGRAM_CODE.test(code) ? levelForProgramCode(code) : null;
  const parts = expanded.split(COMBINED_SEPARATOR);
  if (parts.length === 1) return firstLevel && !new RegExp(AWARD_PATTERN, "i").test(expanded) ? `${firstLevel} ${expanded}` : expanded;

  // "Bachelor Computer Science / Arts": later parts take the level of the part before them, except that the same
  // field twice ("Engineering (Honours) / Engineering") is an integrated bachelor and master.
  let level = firstLevel ?? "Bachelor of";
  const fields: string[] = [];
  return parts.map((part) => {
    const withoutLevel = part.replace(PART_LEVEL, "");
    const ownLevel = PART_LEVEL.exec(part)?.[1];
    const field = normaliseField(withoutLevel.replace(HONOURS, ""));
    if (ownLevel) level = `${ownLevel.replace(/\b\w/g, (letter) => letter.toUpperCase())} of`;
    else if (fields.includes(field)) level = "Master of";
    fields.push(field);
    return `${level} ${withoutLevel}`;
  }).join(" and ");
};

/** `code` is optional; UNSW names need it to tell programs from specialisations and to know the award level. */
export const classifyDegree = (name: string, code?: string): DegreeClassification => {
  if (code && UNSW_SPECIALISATION_CODE.test(code)) {
    return code.endsWith("H")
      ? { ...classifyDegree(ENGINEERING_HONOURS), variant: `${name.trim()} specialisation` }
      : { key: `minor:${normaliseField(name)}`, displayName: `${name.trim()} (minor)`, variant: null, isCourse: false };
  }
  const expanded = expandName(name, code).replace(MAIN_CAMPUS, "");
  const variants = [...expanded.matchAll(DELIVERY_VARIANTS)].map((match) => match[1]);
  const awards = expanded.replace(DELIVERY_VARIANTS, "").trim().split(AWARD_SPLIT).filter(Boolean).map(classifyAward);
  // A combined degree is the same course whichever award the university lists first.
  const key = awards.map((award) => award.key).sort().join(" + ");
  return {
    key,
    displayName: awards.map((award) => award.label).join(" and "),
    variant: variants.length > 0 ? variants.join(", ") : null,
    isCourse: true,
  };
};
