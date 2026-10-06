import type { SubjectAccessConditionGroup, SubjectAccessConditions } from "../types/subject";

/** Adapt exact subject-code expressions; prose, WAM and admission clauses remain unknown. */
export function normalizeUsydEngineeringAccess(access: SubjectAccessConditions): SubjectAccessConditions {
  const normalize = (group: SubjectAccessConditionGroup): SubjectAccessConditionGroup => {
    if (!group.rule) return group;
    const tokens = group.rule.toUpperCase().match(/\(|\)|\bAND\b|\bOR\b|[A-Z]{4}\d{4}/g);
    if (!tokens || tokens.join("") !== group.rule.toUpperCase().replace(/\s+/g, "")) return group;
    const byCode = new Map<string, string>();
    const items = group.items.map((item, index) => {
      const codes = item.referencedSubject ? [item.referencedSubject.code]
        : Array.isArray(item.rawReferencedCodes) ? item.rawReferencedCodes.filter((code): code is string => typeof code === "string") : [];
      const itemKey = `U${index}`;
      if (codes.length === 1) byCode.set(codes[0].toUpperCase(), itemKey);
      return { ...item, itemKey };
    });
    if (tokens.some(token => /^[A-Z]{4}\d{4}$/.test(token) && !byCode.has(token))) return group;
    return { ...group, items, rule: tokens.map(token => byCode.get(token) ?? token).join(" ") };
  };
  const antiRequisiteGroups = access.antiRequisiteGroups.flatMap(group => {
    const normalized = normalize(group);
    const tokens = normalized.rule?.split(/\s+/) ?? [];
    // An established branch of a simple OR prohibition is a conflict even when
    // another source reference is unresolved. Preserve the unknown original too.
    const known = normalized.items.filter(item => item.referencedSubject);
    const simpleOr = tokens.length > 1 && tokens.every((token, index) => index % 2 ? token === "OR" : /^U\d+$/.test(token));
    return simpleOr && known.length && known.length < normalized.items.length
      ? [normalized, { ...normalized, id: `${group.id}:resolved-prohibitions`, items: known, rule: known.map(item => item.itemKey).join(" OR ") }]
      : [normalized];
  });
  return { ...access, requisiteGroups: access.requisiteGroups.map(normalize), antiRequisiteGroups };
}
