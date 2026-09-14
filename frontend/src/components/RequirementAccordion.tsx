import { appUi } from "./ui";
import { useId, useState } from "react";
import type { ComponentSelections } from "../hooks/useComponentSelections";
import { readableText } from "../domain/readableText";
import type { ComponentDetailResponse, RequirementGroup, RequirementItem } from "../types/handbook";
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

interface Props extends SelectionContext { group: RequirementGroup; depth?: number; }

/** Loads the selected component structure while keeping empty and failed responses distinct. */
const SelectedComponentRequirements = ({ componentId, context }: { componentId: string; context: SelectionContext }) => {
  const { detail, status, retry } = useComponentDetail(componentId, context.universityCode, context.handbookYear);
  const view = componentDetailView(status, detail);
  if (view === "loading") return <AsyncState kind="loading" label="Loading selected component requirements" />;
  if (view === "failure") return <AsyncState kind="error" label="We couldn’t load this component’s requirements." onRetry={retry} />;
  if (!detail) return null;
  const creditSummary = componentCreditSummary(detail.requirements);
  const creditLabel = componentCreditLabel(detail);

  return <section className={appUi.selectedComponent} aria-label={`Selected ${formatType(detail.component.type)}`}>
    <div className={appUi.selectedComponentHeader}>
      <div><p className={appUi.selectedComponentLabel}>Selected {formatType(detail.component.type)}</p><h4>{detail.component.name}</h4></div>
      {creditLabel && <span>{creditLabel}</span>}
    </div>
    {(creditSummary.required > 0 || creditSummary.selective > 0) && <p className={appUi.selectedComponentSummary}>
      {creditSummary.required > 0 && <span>{creditSummary.required} CP required</span>}
      {creditSummary.selective > 0 && <span>{creditSummary.selective} CP selected from options</span>}
    </p>}
    {view === "success-empty" ? <p className={appUi.selectedComponentEmpty}>No verified subject list is available for this requirement. You may search other subjects, but eligibility must be confirmed.{detail.component.sourceUrl && <> <a href={detail.component.sourceUrl} target="_blank" rel="noreferrer">View the official handbook source.</a></>}</p> :
      <div className={appUi.componentRequirements}>
        <h5>Component structure</h5>
        {detail.requirements.map((group) => <RequirementAccordion key={group.id} group={group} depth={1} {...context} />)}
      </div>}
  </section>;
};

/** Expands nested handbook requirements and renders selectable component variants. */
export const RequirementAccordion = ({ group, depth = 0, universityCode, handbookYear, selections, onSelectComponent, onOpenSubject }: Props) => {
  const componentChoices = group.items.filter((item) => item.itemType === "COMPONENT");
  const isSingleComponentChoice = group.logic === "ONE_OF" && componentChoices.length > 1 && componentChoices.length === group.items.length;
  const [isOpen, setIsOpen] = useState(depth === 0 && isSingleComponentChoice);
  const [choiceQuery, setChoiceQuery] = useState("");
  const contentId = useId();
  const selectedCode = selections[group.id];
  const selectedChoice = componentChoices.find((item) => item.component?.code === selectedCode);
  const normalizedQuery = choiceQuery.trim().toLowerCase();
  const visibleChoices = componentChoices.filter((item) => item.component?.code === selectedCode
    || !normalizedQuery
    || item.component?.name.toLowerCase().includes(normalizedQuery)
    || item.component?.displayCode?.toLowerCase().includes(normalizedQuery)
    || formatType(item.component?.type ?? "").includes(normalizedQuery));
  const hasContent = group.items.length > 0 || group.children.length > 0 || Boolean(group.description);
  const context = { universityCode, handbookYear, selections, onSelectComponent, onOpenSubject };

  return <section className={depth > 0 ? appUi.requirementGroupNested : appUi.requirementGroup}>
    <button className={appUi.requirementGroupTrigger} type="button" aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen((open) => !open)} disabled={!hasContent}>
      <span className={appUi.requirementGroupHeading}><span className={appUi.requirementGroupTitle}>{readableGroupTitle(group.title)}</span>
        <span className={appUi.requirementGroupMeta}>{group.requiredCreditPoints !== null && `${group.requiredCreditPoints} credit points`}
          {group.logic !== "UNKNOWN" && <span className={appUi.logicLabel}>{readableLogic(group.logic)}</span>}
          {selectedChoice?.component && <span className={appUi.selectionSummary}>Selected: {selectedChoice.component.name}</span>}
        </span>
      </span>{hasContent && <span className={appUi.chevron} aria-hidden="true">{isOpen ? "−" : "+"}</span>}
    </button>
    {isOpen && hasContent && <div className={appUi.requirementGroupContent} id={contentId}>
      {group.description && <details className={appUi.officialRequirement}><summary>Official requirement</summary><p className={appUi.groupDescription}>{readableText(group.description)}</p></details>}
      {isSingleComponentChoice ? <fieldset className={appUi.componentChoices}>
        <legend>{readableGroupTitle(group.title)}</legend>
        <div className={appUi.componentChoicesTools}>
          {componentChoices.length > 12 && <label><span>Filter choices</span><input type="search" value={choiceQuery} onChange={(event) => setChoiceQuery(event.target.value)} placeholder="Search by name or role" /></label>}
          <span>{componentChoices.length} choices available</span>
        </div>
        {visibleChoices.map((item) => {
          const component = item.component;
          if (!component) return <div className={appUi.componentChoiceUnavailable} key={item.id}>
            <span className={appUi.typeBadge}>component</span><strong>{item.rawCode ?? "Unavailable option"}</strong><span>{item.rawName}</span>
          </div>;
          const selected = component.code === selectedCode;
          return <label className={selected ? appUi.componentChoiceSelected : appUi.componentChoice} key={item.id}>
            <input type="radio" name={`component-choice-${group.id}`} value={component.code} checked={selected} onChange={() => onSelectComponent(group.id, component.code)} />
            <span className={appUi.componentChoiceBody}><strong>{component.name}</strong><span className={appUi.componentChoiceMeta}><span className={appUi.typeBadge}>{formatType(component.type)}</span>{component.displayCode && <span>{component.displayCode}</span>}</span></span>
            {(component.creditPoints ?? item.creditPoints) !== null
              ? <span className={appUi.componentChoiceCp}>{component.creditPoints ?? item.creditPoints} CP</span>
              : <span className={appUi.componentChoiceCpUnknown}>Credit points unavailable</span>}
          </label>;
        })}
        {visibleChoices.length === 0 && <p className={appUi.componentChoicesEmpty}>No choices match this filter.</p>}
      </fieldset> : group.items.length > 0 && <div className={appUi.requirementItems}>{group.items.map((item) => <RequirementRow item={item} onOpenSubject={onOpenSubject} key={item.id} />)}</div>}
      {isSingleComponentChoice && selectedChoice?.component && <SelectedComponentRequirements componentId={selectedChoice.component.id} context={context} />}
      {group.children.length > 0 && <div className={appUi.nestedRequirements}>{group.children.map((child) => <RequirementAccordion key={child.id} group={child} depth={depth + 1} {...context} />)}</div>}
    </div>}
  </section>;
};
