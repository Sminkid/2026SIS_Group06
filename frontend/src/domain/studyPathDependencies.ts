import type { RequirementGroup } from "../types/handbook";
import type { ComponentSelections } from "../hooks/useComponentSelections";
import { flattenRequirements, requirementCodes } from "./roadmapSlots";

/** Interpret only the explicit imported aligned-stream/default-elective rule.
 * Ambiguous or absent rules are left unresolved, never guessed. */
export const requiredBranch = (group: RequirementGroup, selections: ComponentSelections, requirements: RequirementGroup[]): RequirementGroup | undefined => {
  const groups = flattenRequirements(requirements);
  const majorGroup = groups.find((group) => group.items.filter((item) => item.component?.type === "MAJOR").length > 1);
  const major = majorGroup?.items.find((item) => item.component?.code === selections[majorGroup.id])?.component;
  if (!major) return undefined;
    const defaultCode = /All other majors complete\s+((?:CBK|STM)\d{5})/i.exec(group.description ?? "")?.[1];
    if (!defaultCode || !/must complete the aligned/i.test(group.description ?? "")) return undefined;
    const aligned = group.children.filter((child) => child.title?.replace(/ specialist stream$/i, "").trim().toLowerCase() === major.name.trim().toLowerCase());
    const defaults = group.children.filter((child) => requirementCodes(child).has(defaultCode));
    return aligned.length === 1 ? aligned[0] : aligned.length === 0 && defaults.length === 1 ? defaults[0] : undefined;
};

export const reconcileDependentBranches = (selections: ComponentSelections, requirements: RequirementGroup[]): ComponentSelections => {
  const next = { ...selections };
  for (const group of flattenRequirements(requirements)) {
    const branch = requiredBranch(group, selections, requirements);
    if (!branch) continue; // Genuine choices retain their explicitly selected branch.
    next[group.id] = `GROUP:${branch.id}`;
    for (const inactive of group.children.filter((child) => child.id !== branch.id)) {
      flattenRequirements([inactive]).forEach((child) => { delete next[child.id]; });
    }
  }
  return next;
};
