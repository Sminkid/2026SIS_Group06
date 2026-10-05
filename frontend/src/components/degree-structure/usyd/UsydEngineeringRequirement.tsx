import type { ComponentProps } from "react";
import { useComponentDetail } from "../../../hooks/useComponentDetail";
import { componentCreditLabel } from "../../../domain/componentDetailState";
import { usydGroups } from "../../../domain/usydEngineeringPlanner";
import { RequirementAccordion, type RequirementChoiceSelection } from "../../RequirementAccordion";
import { AsyncState } from "../../AsyncState";
import { appUi } from "../../ui";

type Props = ComponentProps<typeof RequirementAccordion>;

/** USYD Engineering components are optional academic choices, including a sole specialisation. */
export function UsydEngineeringRequirement(props: Props) {
  const { group, selections, onSelectComponent } = props;
  const components = group.items.filter(item => item.component);
  if (props.choiceSelection || group.logic !== "ONE_OF" || components.length !== group.items.length || !components.length) {
    return <RequirementAccordion {...props} />;
  }
  const optional = components.every(item => item.component?.type === "SPECIALISATION");
  const selected = components.find(item => item.component?.code === selections[group.id])?.component;
  const choice: RequirementChoiceSelection = {
    legend: group.title ?? "Choose a component",
    choices: [ ...(optional ? [{ value: "", title: "No optional component", badge: "optional" }] : []),
      ...components.map(({ component: ref }) => ({ value: ref!.code, title: ref!.name,
        badge: ref!.type.toLowerCase(), code: ref!.displayCode,
        creditLabel: ref!.creditPoints === null ? "Credit points unavailable" : `${ref!.creditPoints} CP` })) ],
    selectedValue: selected?.code ?? "", onSelect: code => onSelectComponent(group.id, code),
    showSearch: props.showChoiceSearch || components.length > 12,
    selectedContent: selected ? <SelectedUsydComponent key={selected.id} {...props} componentId={selected.id} /> : undefined,
  };
  // Keep generic auto-selection and recursive component rendering outside the USYD path.
  return <RequirementAccordion {...props} group={{ ...group, items: [] }} choiceSelection={choice} />;
}

function SelectedUsydComponent({ componentId, ...props }: Props & { componentId: string }) {
  const { detail, status, retry } = useComponentDetail(componentId, props.universityCode, props.handbookYear);
  if (status === "error") return <AsyncState kind="error" label="We couldn't load this component's requirements." onRetry={retry} />;
  if (status !== "ready" || !detail) return <AsyncState kind="loading" label="Loading selected component requirements" />;
  const label = `Selected ${detail.component.type.toLowerCase()}`;
  const groups = usydGroups(detail.requirements);
  const required = groups.filter(g => g.logic === "ALL" && g.items.some(i => i.subject)).reduce((sum, g) => sum + (g.requiredCreditPoints ?? 0), 0);
  const selective = groups.filter(g => ["ANY", "ONE_OF"].includes(g.logic) && g.items.some(i => i.subject)).reduce((sum, g) => sum + (g.requiredCreditPoints ?? 0), 0);
  return <section className={appUi.selectedComponent} aria-label={label}>
    <div className={appUi.selectedComponentHeader}><div><p className={appUi.selectedComponentLabel}>{label}</p><h4>{detail.component.name}</h4></div>
      {componentCreditLabel(detail) && <span>{componentCreditLabel(detail)}</span>}</div>
    {(required > 0 || selective > 0) && <p className={appUi.selectedComponentSummary}>
      {required > 0 && <span>{required} CP required</span>}{selective > 0 && <span>{selective} CP selected from options</span>}</p>}
    {detail.requirements.length ? <div className={appUi.componentRequirements}><h5>Component structure</h5>
      {detail.requirements.map(group => <UsydEngineeringRequirement key={group.id} {...props} group={group} depth={1} choiceSelection={undefined} supplementalContent={undefined} />)}
    </div> : <p className={appUi.selectedComponentEmpty}>No verified structure is available for this selection.</p>}
    {detail.component.sourceUrl && <p className={appUi.selectedStructureSource}><a href={detail.component.sourceUrl} target="_blank" rel="noreferrer">View the official source</a></p>}
  </section>;
}
