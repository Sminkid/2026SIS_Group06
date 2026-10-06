import { appUi } from "./ui";
import { useMemo, useState } from "react";
import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { RequirementGroup, RequirementObligation, StudentRequirementSummary } from "../types/handbook";
import { RequirementAccordion } from "./RequirementAccordion";

interface Props {
  totalCreditPoints: number | null;
  summaries: StudentRequirementSummary[];
  requirements: RequirementGroup[];
  universityCode: string;
  handbookYear: number;
  selections: ComponentSelections;
  onSelectComponent: (groupId: string, componentCode: string) => void;
  onOpenSubject: (subjectCode: string) => void;
}

const sections: Array<{ obligation: RequirementObligation; label: string }> = [
  { obligation: "REQUIRED", label: "Required" },
  { obligation: "OPTIONAL", label: "Optional" },
  { obligation: "CONDITIONAL", label: "Conditional" },
  { obligation: "INFORMATIONAL", label: "Planning your remaining credit points" },
];

const tableDefinitions: Record<string, string> = {
  A: "Units, majors and other components belonging to this degree or its faculty handbook.",
  S: "Shared subject areas and units that may be available across degrees.",
  O: "Open Learning Environment units.",
  D: "Dalyell Scholars units, relevant only to students enrolled in the Dalyell Stream.",
};

const tablesIn = (summaries: StudentRequirementSummary[]) => [...new Set(summaries.flatMap((summary) =>
  [...(summary.sourceText ?? "").matchAll(/Table\s+([ASOD])\b/gi)].map((match) => match[1]!.toUpperCase())))];

const isComponentPool = (group: RequirementGroup) => group.items.length > 0
  && group.items.every((item) => item.itemType === "COMPONENT");
const roleInTitle = (group: RequirementGroup, role: "major" | "minor") =>
  new RegExp(`\\b${role}\\b`, "i").test(group.title ?? "");
const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] =>
  groups.flatMap((group) => [group, ...flattenGroups(group.children)]);

/** Separates required, optional and conditional handbook obligations while retaining their source wording. */
export const DegreeCompletionOverview = ({
  totalCreditPoints,
  summaries,
  requirements,
  universityCode,
  handbookYear,
  selections,
  onSelectComponent,
  onOpenSubject,
}: Props) => {
  const [additionalComponent, setAdditionalComponent] = useState<"NONE" | "MINOR" | "SECOND_MAJOR">("NONE");
  const [dalyell, setDalyell] = useState(false);
  const [ole, setOle] = useState(false);
  const componentPools = requirements.filter(isComponentPool);
  const majorPool = componentPools.find((group) => roleInTitle(group, "major"));
  const minorPool = componentPools.find((group) => roleInTitle(group, "minor"));
  const requiredMajorSummary = summaries.find((summary) => summary.obligation === "REQUIRED"
    && summary.actionKind === "CHOOSE_COMPONENT" && /\bmajor\b/i.test(summary.title));
  const requiredMajorGroup = useMemo(() => majorPool ? {
    ...majorPool,
    title: "Required major",
    description: requiredMajorSummary?.sourceText ?? majorPool.description,
    requiredCreditPoints: requiredMajorSummary?.minimumCreditPoints ?? majorPool.requiredCreditPoints,
  } : undefined, [majorPool, requiredMajorSummary]);
  const secondMajorPool = useMemo(() => majorPool ? {
    ...majorPool,
    id: `${majorPool.id}:additional-major`,
    items: majorPool.items.filter((item) => item.component?.code !== selections[majorPool.id]),
  } : undefined, [majorPool, selections]);
  const tableCodes = useMemo(() => tablesIn(summaries), [summaries]);
  const officialSources = summaries.filter((summary) => summary.sourceText);
  const groupsById = new Map(flattenGroups(requirements).map((group) => [group.id, group]));
  const dalyellGroups = summaries.filter((summary) => summary.obligation === "CONDITIONAL"
    && /dalyell/i.test(`${summary.title} ${summary.sourceText ?? ""}`))
    .flatMap((summary) => {
      const group = groupsById.get(summary.requirementGroupId);
      return group ? [{
        ...group,
        title: summary.title,
        description: summary.sourceText ?? group.description,
        requiredCreditPoints: summary.minimumCreditPoints ?? group.requiredCreditPoints,
      }] : [];
    });

  return <div className={appUi.completionOverview}>
    <div className={appUi.completionOverviewTotal}><span>Degree completion overview</span><strong>{totalCreditPoints === null ? "Total credit points unavailable" : `Total required: ${totalCreditPoints} CP`}</strong></div>
    {sections.map(({ obligation, label }) => {
      const items = summaries.filter((summary) => summary.obligation === obligation && summary !== requiredMajorSummary);
      if (items.length === 0) return null;
      return <section className={appUi.completionSection} aria-labelledby={`completion-${obligation.toLowerCase()}`} key={obligation}>
        <h3 id={`completion-${obligation.toLowerCase()}`}>{label}</h3>
        <div className={appUi.completionCards}>{items.map((summary) => <article className={appUi.completionCard} key={summary.id}>
          <div><span className={summary.obligation === "REQUIRED" ? appUi.obligationRequired : summary.obligation === "OPTIONAL" ? appUi.obligationOptional : summary.obligation === "CONDITIONAL" ? appUi.obligationConditional : appUi.obligationInformational}>{summary.obligation.toLowerCase()}</span><h4>{summary.title}</h4></div>
          {summary.explanation && <p>{summary.explanation}</p>}
          {summary.minimumCreditPoints !== null && <small>{summary.maximumCreditPoints !== null && summary.maximumCreditPoints !== summary.minimumCreditPoints
            ? `${summary.minimumCreditPoints}–${summary.maximumCreditPoints} CP`
            : `${summary.minimumCreditPoints} CP`}</small>}
        </article>)}</div>
      </section>;
    })}

    {requiredMajorGroup && <RequirementAccordion group={requiredMajorGroup} universityCode={universityCode}
      handbookYear={handbookYear} selections={selections} onSelectComponent={onSelectComponent}
      onOpenSubject={onOpenSubject} showChoiceSearch />}
    {(minorPool || majorPool) && <section className={appUi.completionAction}><label><span>Would you like an additional component?</span><select value={additionalComponent} onChange={(event) => setAdditionalComponent(event.target.value as typeof additionalComponent)}>
      <option value="NONE">No additional component</option>{minorPool && <option value="MINOR">Add a minor</option>}{majorPool && <option value="SECOND_MAJOR">Add a second major</option>}
    </select></label>{additionalComponent === "MINOR" && minorPool && <RequirementAccordion group={minorPool} universityCode={universityCode} handbookYear={handbookYear} selections={selections} onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject} />}
      {additionalComponent === "SECOND_MAJOR" && secondMajorPool && <RequirementAccordion group={secondMajorPool} universityCode={universityCode} handbookYear={handbookYear} selections={selections} onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject} />}</section>}
    {summaries.some((summary) => /dalyell/i.test(summary.title)) && <section className={appUi.completionAction}><label><span>Are you enrolled in the Dalyell Stream?</span><select value={dalyell ? "YES" : "NO"} onChange={(event) => setDalyell(event.target.value === "YES")}><option value="NO">No</option><option value="YES">Yes</option></select></label>
      {dalyell && dalyellGroups.map((group) => <RequirementAccordion group={group} key={group.id}
        universityCode={universityCode} handbookYear={handbookYear} selections={selections}
        onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject} obligation="CONDITIONAL" />)}</section>}
    {summaries.some((summary) => /open learning environment/i.test(summary.title)) && <section className={appUi.completionAction}><label><span>Include optional Open Learning Environment units?</span><select value={ole ? "YES" : "NO"} onChange={(event) => setOle(event.target.value === "YES")}><option value="NO">No</option><option value="YES">Yes</option></select></label>{ole && <p className={appUi.completionActionNote}>Choose eligible OLE units in your personal plan. Availability and eligibility depend on the degree rules and unit requirements.</p>}</section>}

    {tableCodes.length > 0 && <aside className={appUi.tableHelp}><h3>Understanding handbook tables</h3><dl>{tableCodes.map((code) => <div key={code}><dt>Table {code}</dt><dd>{tableDefinitions[code]}</dd></div>)}</dl><p>Being listed in a table does not automatically make every option available. Eligibility depends on the degree rules and component requirements.</p></aside>}
    {officialSources.length > 0 && <details className={appUi.officialWording}><summary>View official handbook wording</summary>{officialSources.map((summary) => <blockquote key={summary.id}>{summary.sourceText}{summary.sourceUrl && <><br /><a href={summary.sourceUrl} target="_blank" rel="noreferrer">Official source</a></>}</blockquote>)}</details>}
  </div>;
};
