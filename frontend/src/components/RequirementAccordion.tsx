import { appUi } from "./ui";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import type { ComponentSelections } from "../hooks/useComponentSelections";
import { readableText } from "../domain/readableText";
import type { ComponentDetailResponse, RequirementGroup, RequirementItem, RequirementObligation } from "../types/handbook";
import { AsyncState } from "./AsyncState";
import { useComponentDetail } from "../hooks/useComponentDetail";
import { componentCreditLabel, componentDetailView } from "../domain/componentDetailState";

const formatType = (type: string) => type.toLowerCase().replaceAll("_", " ");
const readableGroupTitle = (title: string | null) => {
  const value = title?.trim();
  if (!value) return "Untitled requirement";
  const choicePool = /^(.*?)\s+(major|minor|sub[ -]?major)\s+choice pool$/i.exec(value);
  return choicePool ? `Choose one ${choicePool[2]!.toLowerCase()} from ${choicePool[1]}` : value;
};
const readableLogic = (logic: RequirementGroup["logic"]) => logic === "ONE_OF"
  ? "Choose one"
  : logic === "ANY" ? "Choose from options" : logic.replace("_", " ");
const componentCreditSummary = (groups: RequirementGroup[]) => groups.reduce((summary, group) => {
  const points = group.requiredCreditPoints ?? 0;
  const hasDirectSubjects = group.items.some((item) => item.subject);
  if (hasDirectSubjects && group.logic === "ALL") summary.required += points;
  if (hasDirectSubjects && (group.logic === "ANY" || group.logic === "ONE_OF")) summary.selective += points;
  const children = componentCreditSummary(group.children);
  summary.required += children.required;
  summary.selective += children.selective;
  return summary;
}, { required: 0, selective: 0 });

/** Displays a subject or component requirement without changing its formal allocation. */
const RequirementRow = ({
  item,
  onOpenSubject,
}: {
  item: RequirementItem;
  onOpenSubject: (subjectCode: string) => void;
}) => {
  if (item.subject) return <button
    className={appUi.requirementRowInteractive}
    type="button"
    onClick={() => onOpenSubject(item.subject!.code)}
    aria-label={`View ${item.subject.code} ${item.subject.name}`}
  >
    <span className={appUi.requirementRowCode}>{item.subject.code}</span><span className={appUi.requirementRowName}>{item.subject.name}</span>
    {(item.subject.creditPoints ?? item.creditPoints) !== null && <span className={appUi.requirementRowCp}>{item.subject.creditPoints ?? item.creditPoints} CP</span>}
  </button>;
  if (item.component) return <div className={appUi.requirementRowComponent}>
    <span className={appUi.typeBadge}>{formatType(item.component.type)}</span>{item.component.displayCode && <span className={appUi.requirementRowCode}>{item.component.displayCode}</span>}
    <span className={appUi.requirementRowName}>{item.component.name}</span>{(item.component.creditPoints ?? item.creditPoints) !== null && <span className={appUi.requirementRowCp}>{item.component.creditPoints ?? item.creditPoints} CP</span>}
  </div>;
  return <div className={appUi.requirementRowOther}>
    <span className={appUi.typeBadge}>{item.itemType.toLowerCase()}</span>{item.rawCode && <span className={appUi.requirementRowCode}>{item.rawCode}</span>}
    <span className={appUi.requirementRowName}>{item.rawName ?? "Requirement details unavailable"}</span>
    {item.creditPoints !== null && <span className={appUi.requirementRowCp}>{item.creditPoints} CP</span>}
  </div>;
};

interface SelectionContext {
  universityCode: string;
  handbookYear: number;
  selections: ComponentSelections;
  onSelectComponent: (groupId: string, componentCode: string) => void;
  onOpenSubject: (subjectCode: string) => void;
}

export interface RequirementChoiceOption {
  value: string;
  title: string;
  badge: string;
  disabled?: boolean;
  code?: string | null;
  description?: string | null;
  creditLabel?: string | null;
}

export interface RequirementChoiceSelection {
  legend: string;
  choices: RequirementChoiceOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  showSearch?: boolean;
  selectedContent?: ReactNode;
}

interface Props extends SelectionContext {
  group: RequirementGroup;
  depth?: number;
  obligation?: RequirementObligation;
  showChoiceSearch?: boolean;
  choiceSelection?: RequirementChoiceSelection;
  supplementalContent?: ReactNode;
}

const RequirementChoiceList = ({ legend, choices, selectedValue, onSelect, showSearch = false }: Omit<RequirementChoiceSelection, "selectedContent">) => {
  const [query, setQuery] = useState("");
  const choiceGroupId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const visibleChoices = choices.filter((choice) => choice.value === selectedValue
    || !normalizedQuery
    || choice.title.toLowerCase().includes(normalizedQuery)
    || choice.code?.toLowerCase().includes(normalizedQuery)
    || choice.badge.toLowerCase().includes(normalizedQuery)
    || choice.description?.toLowerCase().includes(normalizedQuery));

  return <fieldset className={appUi.componentChoices}>
    <legend>{legend}</legend>
    <div className={appUi.componentChoicesTools}>
      {showSearch && <label><span>Filter choices</span><input type="search" value={query}
        onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or role" /></label>}
      <span>{choices.length} choices available</span>
    </div>
    {visibleChoices.map((choice) => {
      if (choice.disabled) return <div className={appUi.componentChoiceUnavailable} key={choice.value}>
        <span className={appUi.typeBadge}>{choice.badge}</span><strong>{choice.code ?? choice.title}</strong>
        {choice.description && <span>{choice.description}</span>}
      </div>;
      const selected = choice.value === selectedValue;
      return <label className={selected ? appUi.componentChoiceSelected : appUi.componentChoice} key={choice.value}>
        <input type="radio" name={`requirement-choice-${choiceGroupId}`} value={choice.value} checked={selected}
          onChange={() => onSelect(choice.value)} />
        <span className={appUi.componentChoiceBody}><strong>{choice.title}</strong>
          <span className={appUi.componentChoiceMeta}><span className={appUi.typeBadge}>{choice.badge}</span>
            {choice.code && <span>{choice.code}</span>}{choice.description && <span>{choice.description}</span>}</span>
        </span>
        {choice.creditLabel && <span className={appUi.componentChoiceCp}>{choice.creditLabel}</span>}
      </label>;
    })}
    {visibleChoices.length === 0 && <p className={appUi.componentChoicesEmpty}>No choices match this filter.</p>}
  </fieldset>;
};

interface SelectedRequirementStructureProps {
  label: string;
  title: string;
  creditLabel?: string | null;
  summary?: string[];
  notice?: string | null;
  sourceUrl?: string | null;
  groups: RequirementGroup[];
  emptyMessage?: string | null;
  structureHeading?: string;
  context: SelectionContext;
}

/** Shared selected-choice shell for both formal components and evidence-backed external pathways. */
export const SelectedRequirementStructure = ({ label, title, creditLabel, summary = [], notice, sourceUrl,
  groups, emptyMessage, structureHeading = "Component structure", context }: SelectedRequirementStructureProps) => <section className={appUi.selectedComponent}
    aria-label={label}>
  <div className={appUi.selectedComponentHeader}>
    <div><p className={appUi.selectedComponentLabel}>{label}</p><h4>{title}</h4></div>
    {creditLabel && <span>{creditLabel}</span>}
  </div>
  {summary.length > 0 && <p className={appUi.selectedComponentSummary}>
    {summary.map((item) => <span key={item}>{item}</span>)}
  </p>}
  {notice && <p className={appUi.selectedStructureNote}>{notice}</p>}
  {groups.length === 0 ? emptyMessage !== null && <p className={appUi.selectedComponentEmpty}>{emptyMessage ?? "No verified structure is available for this selection."}
    {sourceUrl && <> <a href={sourceUrl} target="_blank" rel="noreferrer">View the official source.</a></>}</p> :
    <div className={appUi.componentRequirements}>
      <h5>{structureHeading}</h5>
      {groups.map((group) => <RequirementAccordion key={group.id} group={group} depth={1} {...context} />)}
      {sourceUrl && <p className={appUi.selectedStructureSource}><a href={sourceUrl} target="_blank" rel="noreferrer">View the official source</a></p>}
    </div>}
</section>;

/** Loads the selected component structure while keeping empty and failed responses distinct. */
const SelectedComponentRequirements = ({ componentId, context }: { componentId: string; context: SelectionContext }) => {
  const { detail, status, retry } = useComponentDetail(componentId, context.universityCode, context.handbookYear);
  const view = componentDetailView(status, detail);
  if (view === "loading") return <AsyncState kind="loading" label="Loading selected component requirements" />;
  if (view === "failure") return <AsyncState kind="error" label="We couldn’t load this component’s requirements." onRetry={retry} />;
  if (!detail) return null;
  const creditSummary = componentCreditSummary(detail.requirements);
  const creditLabel = componentCreditLabel(detail);

  return <SelectedRequirementStructure label={`Selected ${formatType(detail.component.type)}`} title={detail.component.name}
    creditLabel={creditLabel} summary={[
      ...(creditSummary.required > 0 ? [`${creditSummary.required} CP required`] : []),
      ...(creditSummary.selective > 0 ? [`${creditSummary.selective} CP selected from options`] : []),
    ]} groups={view === "success-empty" ? [] : detail.requirements}
    emptyMessage="No verified subject list is available for this requirement. You may search other subjects, but eligibility must be confirmed."
    sourceUrl={detail.component.sourceUrl} context={context} />;
};

/** Expands nested handbook requirements and renders selectable component variants. */
export const RequirementAccordion = ({ group, depth = 0, universityCode, handbookYear, selections, onSelectComponent,
  onOpenSubject, obligation, showChoiceSearch = false, choiceSelection, supplementalContent }: Props) => {
  const componentChoices = group.items.filter((item) => item.itemType === "COMPONENT");
  const isSingleComponentChoice = group.logic === "ONE_OF" && componentChoices.length > 1 && componentChoices.length === group.items.length;
  const hasChoiceSelection = isSingleComponentChoice || Boolean(choiceSelection);
  const [isOpen, setIsOpen] = useState(depth === 0 && hasChoiceSelection);
  const contentId = useId();
  const selectedCode = selections[group.id];
  const selectedChoice = componentChoices.find((item) => item.component?.code === selectedCode);
  const selectedExternalChoice = choiceSelection?.choices.find((choice) => choice.value === choiceSelection.selectedValue);
  const hasContent = group.items.length > 0 || group.children.length > 0 || Boolean(group.description)
    || Boolean(choiceSelection) || Boolean(supplementalContent);
  const context = { universityCode, handbookYear, selections, onSelectComponent, onOpenSubject };
  const componentChoiceSelection: RequirementChoiceSelection | undefined = isSingleComponentChoice ? {
    legend: readableGroupTitle(group.title),
    choices: componentChoices.map((item) => item.component ? {
      value: item.component.code,
      title: item.component.name,
      badge: formatType(item.component.type),
      code: item.component.displayCode,
      creditLabel: (item.component.creditPoints ?? item.creditPoints) !== null
        ? `${item.component.creditPoints ?? item.creditPoints} CP`
        : "Credit points unavailable",
    } : {
      value: item.id,
      title: item.rawCode ?? "Unavailable option",
      badge: "component",
      code: item.rawCode,
      description: item.rawName ?? "Component details unavailable",
      disabled: true,
    }),
    selectedValue: selectedCode ?? "",
    onSelect: (value) => onSelectComponent(group.id, value),
    showSearch: showChoiceSearch || componentChoices.length > 12,
  } : undefined;
  const renderedSelection = choiceSelection ?? componentChoiceSelection;

  return <section className={depth > 0 ? appUi.requirementGroupNested : appUi.requirementGroup}>
    <button className={appUi.requirementGroupTrigger} type="button" aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen((open) => !open)} disabled={!hasContent}>
      <span className={appUi.requirementGroupHeading}><span className={appUi.requirementGroupTitle}>{readableGroupTitle(group.title)}</span>
        <span className={appUi.requirementGroupMeta}>{group.requiredCreditPoints !== null && `${group.requiredCreditPoints} credit points`}
          {group.logic !== "UNKNOWN" && <span className={appUi.logicLabel}>{readableLogic(group.logic)}</span>}
          {obligation && <span className={obligation === "OPTIONAL" ? appUi.obligationOptional
            : obligation === "CONDITIONAL" ? appUi.obligationConditional
              : obligation === "INFORMATIONAL" ? appUi.obligationInformational : appUi.obligationRequired}>{obligation}</span>}
          {(selectedExternalChoice?.title || selectedChoice?.component) && <span className={appUi.selectionSummary}>
            Selected: {selectedExternalChoice?.title ?? selectedChoice?.component?.name}</span>}
        </span>
      </span>{hasContent && <span className={appUi.chevron} aria-hidden="true">{isOpen ? "−" : "+"}</span>}
    </button>
    {isOpen && hasContent && <div className={appUi.requirementGroupContent} id={contentId}>
      {group.description && <details className={appUi.officialRequirement}><summary>Official requirement</summary><p className={appUi.groupDescription}>{readableText(group.description)}</p></details>}
      {supplementalContent}
      {renderedSelection ? <RequirementChoiceList {...renderedSelection} />
        : group.items.length > 0 && <div className={appUi.requirementItems}>{group.items.map((item) => <RequirementRow item={item} onOpenSubject={onOpenSubject} key={item.id} />)}</div>}
      {isSingleComponentChoice && selectedChoice?.component && <SelectedComponentRequirements componentId={selectedChoice.component.id} context={context} />}
      {choiceSelection?.selectedContent}
      {group.children.length > 0 && <div className={appUi.nestedRequirements}>{group.children.map((child) => <RequirementAccordion key={child.id} group={child} depth={depth + 1} {...context} />)}</div>}
    </div>}
  </section>;
};
