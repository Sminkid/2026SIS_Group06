/**
 * Universities name the same qualification differently, e.g. UTS "Bachelor of Engineering (Honours)" and USYD
 * "Bachelor of Engineering Honours", or UTS "Bachelor of Science Bachelor of Laws" and USYD "Bachelor of Science
 * and Bachelor of Laws". Classifying a name into a canonical key lets those offerings be counted and compared as
 * one course, while keeping genuinely different degrees (honours vs pass, single vs combined) apart.
 */

const AWARD_PATTERN = "(?:Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma)\\s+(?:of|in)\\b";
const AWARD_SPLIT = new RegExp(`\\s+(?:and\\s+)?(?=${AWARD_PATTERN})`, "i");
const AWARD_PARTS = /^(Bachelor|Master|Doctor|Diploma|Undergraduate Certificate|Graduate Certificate|Graduate Diploma)\s+(of|in)\s+(.+)$/i;
const HONOURS = /\s*\(?\bHonours\b\)?/gi;

/** Delivery options of the same qualification; they're grouped with it rather than counted as another course. */
const DELIVERY_VARIANTS = /\s*\((Offshore|off-shore|on-shore|Co-op|Extended)\)/gi;

/**
 * Fields that are the same qualification under a different name at another university, keyed by the normalised
 * field. Add an entry here when two universities' degrees should be compared as one course.
 */
const FIELD_ALIASES: Record<string, { key: string; label: string }> = {
  "computing science": { key: "computing", label: "Computing" },
};

export interface DegreeClassification {
  /** Equal for equivalent degrees across universities. */
  key: string;
  /** University-neutral name for the course. */
  displayName: string;
  /** Delivery option such as "Offshore", or null for the standard offering. */
  variant: string | null;
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

export const classifyDegree = (name: string): DegreeClassification => {
  const variants = [...name.matchAll(DELIVERY_VARIANTS)].map((match) => match[1]);
  const awards = name.replace(DELIVERY_VARIANTS, "").trim().split(AWARD_SPLIT).filter(Boolean).map(classifyAward);
  // A combined degree is the same course whichever award the university lists first.
  const key = awards.map((award) => award.key).sort().join(" + ");
  return {
    key,
    displayName: awards.map((award) => award.label).join(" and "),
    variant: variants.length > 0 ? variants.join(", ") : null,
  };
};
