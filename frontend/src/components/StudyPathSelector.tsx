import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { ComponentDetailResponse, RequirementGroup } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import { readableText } from "../domain/readableText";
import { selectedComponentPreview, type SelectedComponentPreviewStatus } from "../domain/selectedComponentPreview";

interface Props { universityCode: string; degreeName: string; requirements: RequirementGroup[]; componentDetails: Record<string, ComponentDetailResponse>;
  componentDetailsStatus: SelectedComponentPreviewStatus;
  selections: ComponentSelections; onSelect: (groupId: string, value: string, clearGroupIds?: string[]) => void; planner: PlannerState | null }
const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap((group) => [group, ...flattenGroups(group.children)]);
const formatType = (type: string) => type.toLowerCase().replaceAll("_", " ");
const components = (group: RequirementGroup) => group.items.flatMap((item) => item.component ? [item.component] : []);
const componentDecision = (group: RequirementGroup) => { const options = components(group); return options.length > 1 && options.length === group.items.length && (group.logic === "ONE_OF"
  || (group.logic === "ANY" && group.requiredCreditPoints !== null && options.every((option) => option.creditPoints === group.requiredCreditPoints))); };
const title = (group: RequirementGroup) => group.title?.trim() || "Study-path option";
const selectedGroup = (group: RequirementGroup, selections: ComponentSelections) => { const value = selections[group.id]; return value?.startsWith("GROUP:") ? group.children.find((child) => child.id === value.slice(6)) : undefined; };
const ComponentSelect = ({ group, label, selections, onSelect, clearGroupIds = [] }: { group: RequirementGroup; label: string; selections: ComponentSelections; onSelect: Props["onSelect"]; clearGroupIds?: string[] }) =>
  <label className="study-path__field"><span>{label}</span><select value={selections[group.id] ?? ""} onChange={(event) => onSelect(group.id, event.target.value, clearGroupIds)}>
    <option value="" disabled>Select an option</option>{components(group).map((component) => <option value={component.code} key={component.id}>{component.name}</option>)}</select></label>;

const GroupPreview = ({ group, selections, onSelect, planned, readOnly = false }: { group: RequirementGroup; selections: ComponentSelections; onSelect: Props["onSelect"]; planned: Map<string, string>; readOnly?: boolean }) => {
  const subjectItems = group.items.filter((item) => item.subject); const componentItems = components(group);
  const broad = subjectItems.length === 0 && componentItems.length === 0 && group.children.length === 0;
  return <details className="path-preview" open={group.children.length <= 2}><summary><span>{title(group)}</span>
    <strong>{group.logic === "ALL" ? `CORE · Complete all${group.requiredCreditPoints !== null ? ` · ${group.requiredCreditPoints} CP` : ""}` : group.requiredCreditPoints !== null ? `OPTIONS · Choose ${group.requiredCreditPoints} CP` : group.logic.replace("_", " ")}</strong></summary>
    <div className="path-preview__body">{group.description && <p>{readableText(group.description)}</p>}{broad && <p className="broad-requirement">Broad subject choice. Searched subjects are not automatically verified to count.</p>}
      {!readOnly && componentDecision(group) && <ComponentSelect group={group} label={componentItems[0]?.type.toLowerCase().replaceAll("_", " ") ?? title(group)} selections={selections} onSelect={onSelect} />}
      {subjectItems.length > 0 && <ul className="path-preview__subjects">{subjectItems.map((item) => <li key={item.id}>
        <strong>{group.logic === "ALL" ? planned.has(item.subject!.code) ? "✓" : "⚠" : ""} {item.subject!.code}</strong><span>{item.subject!.name}</span>
        <small>{readOnly
          ? (item.subject!.creditPoints ?? item.creditPoints) !== null ? `${item.subject!.creditPoints ?? item.creditPoints} CP` : "Credit points unavailable"
          : group.logic === "ALL" ? planned.has(item.subject!.code) ? `Planned — ${planned.get(item.subject!.code)}` : "Not currently planned" : (item.subject!.creditPoints ?? item.creditPoints) !== null ? `${item.subject!.creditPoints ?? item.creditPoints} CP` : "Credit points unavailable"}</small>
      </li>)}</ul>}{group.children.map((child) => <GroupPreview group={child} selections={selections} onSelect={onSelect} planned={planned} readOnly={readOnly} key={child.id} />)}</div></details>;
};
const ComponentPreview = ({ detail, selections, onSelect, planned, readOnly = false }: { detail?: ComponentDetailResponse; selections: ComponentSelections; onSelect: Props["onSelect"]; planned: Map<string, string>; readOnly?: boolean }) => detail ?
  <div className="selected-path-preview"><div className="selected-path-preview__heading"><strong>{detail.component.name}</strong>{detail.component.creditPoints !== null && <span>{detail.component.creditPoints} CP</span>}</div>
    {detail.requirements.length === 0 ? <p className="selected-path-preview__empty">No verified component structure is available.</p>
      : detail.requirements.map((group) => <GroupPreview group={group} selections={selections} onSelect={onSelect} planned={planned} readOnly={readOnly} key={group.id} />)}</div> : null;

const SelectedPathwayComponentPreview = ({ componentCode, componentDetails, status, selections, onSelect, planned }: {
  componentCode: string; componentDetails: Record<string, ComponentDetailResponse>; status: Props["componentDetailsStatus"];
  selections: ComponentSelections; onSelect: Props["onSelect"]; planned: Map<string, string>;
}) => {
  const preview = selectedComponentPreview(componentCode, componentDetails, status);
  if (preview.detail) return <ComponentPreview detail={preview.detail} selections={selections} onSelect={onSelect} planned={planned} readOnly />;
  if (preview.state === "error") return <p className="selected-path-preview__state" role="alert">We couldn’t load this component’s structure.</p>;
  if (preview.state === "empty") return <p className="selected-path-preview__state" role="status">No verified component structure is available.</p>;
  return <p className="selected-path-preview__state" role="status">Loading component structure…</p>;
};

const pathwayLabel = (titleValue: string) => titleValue
  .replace(/^One second major$/i, "Second major")
  .replace(/^One sub-major plus electives$/i, "Sub-major + electives");

const ExplicitPathwaySelector = ({ group, selections, onSelect, planner, componentDetails, componentDetailsStatus, planned }: {
  group: RequirementGroup;
  selections: ComponentSelections;
  onSelect: Props["onSelect"];
  planner: PlannerState | null;
  componentDetails: Record<string, ComponentDetailResponse>;
  componentDetailsStatus: Props["componentDetailsStatus"];
  planned: Map<string, string>;
}) => {
  const selectedValue = selections[group.id];
  const pathway = selectedValue?.startsWith("PATHWAY:")
    ? group.pathways.find((candidate) => candidate.id === selectedValue.slice(8))
    : undefined;
  const allSlotIds = group.pathways.flatMap((candidate) => candidate.selections.flatMap((selection) =>
    Array.from({ length: selection.requiredSelections }, (_, index) => `${candidate.id}:selection:${selection.requirementGroupId}:${index}`)));
  const choosePathway = (value: string) => {
    const hasDependentSelections = allSlotIds.some((id) => selections[id]);
    if (hasDependentSelections && !window.confirm("Changing pathway will clear its selected components and related personalised roadmap choices. Continue?")) return;
    onSelect(group.id, value, allSlotIds);
  };
  const selectedInPathway = pathway?.selections.flatMap((selection) =>
    Array.from({ length: selection.requiredSelections }, (_, index) => selections[`${pathway.id}:selection:${selection.requirementGroupId}:${index}`]).filter((value): value is string => Boolean(value))) ?? [];
  const chosenElectivePoints = planner
    ? [...planner.years.flatMap((year) => year.periods.flatMap((period) => period.items)), ...planner.unassignedItems]
      .reduce((total, item) => item.subject && item.choiceOrigin?.formalRequirementGroupId
        && pathway?.selections.some((selection) => selection.selectionType === "ELECTIVE_ALLOCATION" && selection.requirementGroupId === item.choiceOrigin?.formalRequirementGroupId)
        ? total + (item.subject.creditPoints ?? item.creditPoints ?? 0) : total, 0)
    : 0;

  return <section className="path-decision path-decision--explicit">
    <label className="study-path__field"><span>Choose one {group.requiredCreditPoints ?? 48} CP option</span><select value={selectedValue ?? ""} onChange={(event) => choosePathway(event.target.value)}>
      <option value="" disabled>Select a pathway</option>{group.pathways.map((candidate) => <option value={`PATHWAY:${candidate.id}`} key={candidate.id}>{pathwayLabel(candidate.title)}</option>)}
    </select></label>
    {pathway && <div className="path-decision__detail pathway-selections"><h3>{pathwayLabel(pathway.title)}</h3>{pathway.selections.flatMap((selection) => {
      const sourceGroup = group.children.find((child) => child.id === selection.requirementGroupId);
      if (selection.selectionType === "ELECTIVE_ALLOCATION") {
        const remaining = Math.max(0, selection.requiredCreditPoints - chosenElectivePoints);
        return <section className="elective-allocation" key={selection.requirementGroupId}><strong>{selection.requiredCreditPoints} CP electives</strong>
          <p>{remaining} CP remaining. Use the personalised roadmap subject search to add eligible subjects. Search results are marked as eligibility not verified when the database cannot confirm they count.</p></section>;
      }
      if (!sourceGroup) return [];
      const options = components(sourceGroup);
      return Array.from({ length: selection.requiredSelections }, (_, index) => {
        const slotId = `${pathway.id}:selection:${selection.requirementGroupId}:${index}`;
        const current = selections[slotId] ?? "";
        const changeSelection = (value: string) => {
          if (current && current !== value && !window.confirm("Changing this selection will remove related subjects from the personalised roadmap. Continue?")) return;
          onSelect(slotId, value);
        };
        return <div className="pathway-selection" key={slotId}><label className="study-path__field"><span>{selection.requiredSelections > 1 ? `Sub-major ${index + 1}` : formatType(options[0]?.type ?? "component")}</span>
          <select value={current} onChange={(event) => changeSelection(event.target.value)}><option value="" disabled>Select an option</option>
            {options.filter((option) => option.code === current || !selectedInPathway.includes(option.code)).map((option) => <option value={option.code} key={option.id}>{option.name}</option>)}</select></label>
          {current && <SelectedPathwayComponentPreview componentCode={current} componentDetails={componentDetails} status={componentDetailsStatus}
            selections={selections} onSelect={onSelect} planned={planned} />}</div>;
      });
    })}</div>}
  </section>;
};

export const StudyPathSelector = ({ universityCode, degreeName, requirements, componentDetails, componentDetailsStatus, selections, onSelect, planner }: Props) => {
  const planned = new Map<string, string>(); planner?.years.forEach((year) => year.periods.forEach((period) => period.items.forEach((item) => {
    if (item.subject && !planned.has(item.subject.code)) planned.set(item.subject.code, `${year.name} ${period.name}`);
  })));
  const allDegreeGroups = flattenGroups(requirements); const majorGroup = allDegreeGroups.find((group) => components(group).some((component) => component.type === "MAJOR"));
  const explicitPathwayGroup = requirements.find((group) => group.pathways.length > 0);
  if (explicitPathwayGroup) return <section className="study-path study-path--planner" aria-labelledby="study-path-heading"><div><p className="step-label">Personalise your roadmap</p><h2 id="study-path-heading">Your study path</h2></div>
    <p className="study-path__context">{universityCode} · {degreeName}</p><ExplicitPathwaySelector group={explicitPathwayGroup} selections={selections} onSelect={onSelect} planner={planner}
      componentDetails={componentDetails} componentDetailsStatus={componentDetailsStatus} planned={planned} /></section>;
  const majorCode = majorGroup ? selections[majorGroup.id] : undefined; const majorDetail = majorCode ? componentDetails[majorCode] : undefined;
  const majorOptions = majorDetail?.requirements.find((group) => group.children.length > 1 && (group.logic === "ANY" || group.logic === "ONE_OF"));
  const majorOption = majorOptions ? selectedGroup(majorOptions, selections) : undefined; const nestedComponentGroup = majorOption ? flattenGroups([majorOption]).find(componentDecision) : undefined;
  const nestedComponentCode = nestedComponentGroup ? selections[nestedComponentGroup.id] : undefined; const nestedComponentDetail = nestedComponentCode ? componentDetails[nestedComponentCode] : undefined;
  const separatePath = requirements.find((group) => group.children.length > 1 && !components(group).some((component) => component.type === "MAJOR"));
  const separateSelection = separatePath ? selectedGroup(separatePath, selections) : undefined;
  const separateComponentDetails = separateSelection ? flattenGroups([separateSelection]).flatMap((group) => { const code = selections[group.id]; return code && !code.startsWith("GROUP:") && componentDetails[code] ? [componentDetails[code]] : []; }) : [];
  if (!majorGroup && !separatePath) return null;
  return <section className="study-path study-path--planner" aria-labelledby="study-path-heading"><div><p className="step-label">Personalise your roadmap</p><h2 id="study-path-heading">Your study path</h2></div>
    <p className="study-path__context">{universityCode} · {degreeName}</p>
    {majorGroup && <section className="path-decision"><ComponentSelect group={majorGroup} label="Major" selections={selections} onSelect={onSelect} clearGroupIds={majorDetail ? flattenGroups(majorDetail.requirements).map((group) => group.id) : []} /></section>}
    {majorOptions && <section className="path-decision"><label className="study-path__field"><span>Major options</span><select value={selections[majorOptions.id] ?? ""} onChange={(event) => onSelect(majorOptions.id, event.target.value, flattenGroups(majorOptions.children).map((group) => group.id))}>
      <option value="" disabled>Select a pathway</option>{majorOptions.children.map((child) => <option value={`GROUP:${child.id}`} key={child.id}>{title(child)}</option>)}</select></label>
      {majorOption && <div className="path-decision__detail">{nestedComponentGroup ? <ComponentSelect group={nestedComponentGroup} label={components(nestedComponentGroup)[0]?.type.toLowerCase().replaceAll("_", " ") ?? title(nestedComponentGroup)} selections={selections} onSelect={onSelect} />
        : <GroupPreview group={majorOption} selections={selections} onSelect={onSelect} planned={planned} />}<ComponentPreview detail={nestedComponentDetail} selections={selections} onSelect={onSelect} planned={planned} /></div>}</section>}
    {separatePath && <section className="path-decision"><label className="study-path__field"><span>{title(separatePath)}</span><select value={selections[separatePath.id] ?? ""} onChange={(event) => onSelect(separatePath.id, event.target.value, flattenGroups(separatePath.children).map((group) => group.id))}>
      <option value="" disabled>Select a pathway</option>{separatePath.children.map((child) => <option value={`GROUP:${child.id}`} key={child.id}>{title(child)}</option>)}</select></label>
      {separatePath.description && <p className="path-condition">{readableText(separatePath.description)}</p>}{separateSelection && <div className="path-decision__detail"><GroupPreview group={separateSelection} selections={selections} onSelect={onSelect} planned={planned} />
        {separateComponentDetails.map((detail) => <ComponentPreview detail={detail} selections={selections} onSelect={onSelect} planned={planned} key={detail.component.code} />)}</div>}</section>}
  </section>;
};
