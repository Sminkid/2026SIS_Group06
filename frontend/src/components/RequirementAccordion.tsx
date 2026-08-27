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

const RequirementRow = ({
  item,
  onOpenSubject,
}: {
  item: RequirementItem;
  onOpenSubject: (subjectCode: string) => void;
}) => {
  if (item.subject) return <button
    className="requirement-row requirement-row--subject requirement-row--interactive"
    type="button"
    onClick={() => onOpenSubject(item.subject!.code)}
    aria-label={`View ${item.subject.code} ${item.subject.name}`}
  >
    <span className="requirement-row__code">{item.subject.code}</span><span className="requirement-row__name">{item.subject.name}</span>
    {(item.subject.creditPoints ?? item.creditPoints) !== null && <span className="requirement-row__cp">{item.subject.creditPoints ?? item.creditPoints} CP</span>}
  </button>;
  if (item.component) return <div className="requirement-row requirement-row--component">
    <span className="type-badge">{formatType(item.component.type)}</span>{item.component.displayCode && <span className="requirement-row__code">{item.component.displayCode}</span>}
    <span className="requirement-row__name">{item.component.name}</span>{(item.component.creditPoints ?? item.creditPoints) !== null && <span className="requirement-row__cp">{item.component.creditPoints ?? item.creditPoints} CP</span>}
  </div>;
  return <div className="requirement-row requirement-row--other">
    <span className="type-badge">{item.itemType.toLowerCase()}</span>{item.rawCode && <span className="requirement-row__code">{item.rawCode}</span>}
    <span className="requirement-row__name">{item.rawName ?? "Requirement details unavailable"}</span>
    {item.creditPoints !== null && <span className="requirement-row__cp">{item.creditPoints} CP</span>}
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

const SelectedComponentRequirements = ({ componentId, context }: { componentId: string; context: SelectionContext }) => {
  const { detail, status, retry } = useComponentDetail(componentId, context.universityCode, context.handbookYear);
  const view = componentDetailView(status, detail);
  if (view === "loading") return <AsyncState kind="loading" label="Loading selected component requirements" />;
  if (view === "failure") return <AsyncState kind="error" label="We couldn’t load this component’s requirements." onRetry={retry} />;
  if (!detail) return null;
  const creditSummary = componentCreditSummary(detail.requirements);
  const creditLabel = componentCreditLabel(detail);

  return <section className="selected-component" aria-label={`Selected ${formatType(detail.component.type)}`}>
    <div className="selected-component__header">
      <div><p className="selected-component__label">Selected {formatType(detail.component.type)}</p><h4>{detail.component.name}</h4></div>
      {creditLabel && <span>{creditLabel}</span>}
    </div>
    {(creditSummary.required > 0 || creditSummary.selective > 0) && <p className="selected-component__summary">
      {creditSummary.required > 0 && <span>{creditSummary.required} CP required</span>}
      {creditSummary.selective > 0 && <span>{creditSummary.selective} CP selected from options</span>}
    </p>}
    {view === "success-empty" ? <p className="selected-component__empty">No verified subject list is available for this requirement. You may search other subjects, but eligibility must be confirmed.{detail.component.sourceUrl && <> <a href={detail.component.sourceUrl} target="_blank" rel="noreferrer">View the official handbook source.</a></>}</p> :
      <div className="component-requirements">
        <h5>Component structure</h5>
        {detail.requirements.map((group) => <RequirementAccordion key={group.id} group={group} depth={1} {...context} />)}
      </div>}
  </section>;
};

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

  return <section className={`requirement-group requirement-group--depth-${Math.min(depth, 2)}`}>
    <button className="requirement-group__trigger" type="button" aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen((open) => !open)} disabled={!hasContent}>
      <span className="requirement-group__heading"><span className="requirement-group__title">{readableGroupTitle(group.title)}</span>
        <span className="requirement-group__meta">{group.requiredCreditPoints !== null && `${group.requiredCreditPoints} credit points`}
          {group.logic !== "UNKNOWN" && <span className="logic-label">{readableLogic(group.logic)}</span>}
          {selectedChoice?.component && <span className="selection-summary">Selected: {selectedChoice.component.name}</span>}
        </span>
      </span>{hasContent && <span className="chevron" aria-hidden="true">{isOpen ? "−" : "+"}</span>}
    </button>
    {isOpen && hasContent && <div className="requirement-group__content" id={contentId}>
      {group.description && <details className="official-requirement"><summary>Official requirement</summary><p className="group-description">{readableText(group.description)}</p></details>}
      {isSingleComponentChoice ? <fieldset className="component-choices">
        <legend>{readableGroupTitle(group.title)}</legend>
        <div className="component-choices__tools">
          {componentChoices.length > 12 && <label><span>Filter choices</span><input type="search" value={choiceQuery} onChange={(event) => setChoiceQuery(event.target.value)} placeholder="Search by name or role" /></label>}
          <span>{componentChoices.length} choices available</span>
        </div>
        {visibleChoices.map((item) => {
          const component = item.component;
          if (!component) return <div className="component-choice component-choice--unavailable" key={item.id}>
            <span className="type-badge">component</span><strong>{item.rawCode ?? "Unavailable option"}</strong><span>{item.rawName}</span>
          </div>;
          const selected = component.code === selectedCode;
          return <label className={`component-choice${selected ? " component-choice--selected" : ""}`} key={item.id}>
            <input type="radio" name={`component-choice-${group.id}`} value={component.code} checked={selected} onChange={() => onSelectComponent(group.id, component.code)} />
            <span className="component-choice__body"><strong>{component.name}</strong><span className="component-choice__meta"><span className="type-badge">{formatType(component.type)}</span>{component.displayCode && <span>{component.displayCode}</span>}</span></span>
            {(component.creditPoints ?? item.creditPoints) !== null
              ? <span className="component-choice__cp">{component.creditPoints ?? item.creditPoints} CP</span>
              : <span className="component-choice__cp component-choice__cp--unknown">Credit points unavailable</span>}
          </label>;
        })}
        {visibleChoices.length === 0 && <p className="component-choices__empty">No choices match this filter.</p>}
      </fieldset> : group.items.length > 0 && <div className="requirement-items">{group.items.map((item) => <RequirementRow item={item} onOpenSubject={onOpenSubject} key={item.id} />)}</div>}
      {isSingleComponentChoice && selectedChoice?.component && <SelectedComponentRequirements componentId={selectedChoice.component.id} context={context} />}
      {group.children.length > 0 && <div className="nested-requirements">{group.children.map((child) => <RequirementAccordion key={child.id} group={child} depth={depth + 1} {...context} />)}</div>}
    </div>}
  </section>;
};
