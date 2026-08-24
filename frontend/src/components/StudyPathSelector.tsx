import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { ComponentDetailResponse, RequirementGroup } from "../types/handbook";
import type { PlannerState } from "../types/planner";

interface Props { universityCode: string; degreeName: string; requirements: RequirementGroup[]; componentDetails: Record<string, ComponentDetailResponse>;
  selections: ComponentSelections; onSelect: (groupId: string, value: string, clearGroupIds?: string[]) => void; planner: PlannerState | null }
const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap((group) => [group, ...flattenGroups(group.children)]);
const components = (group: RequirementGroup) => group.items.flatMap((item) => item.component ? [item.component] : []);
const componentDecision = (group: RequirementGroup) => { const options = components(group); return options.length > 1 && options.length === group.items.length && (group.logic === "ONE_OF"
  || (group.logic === "ANY" && group.requiredCreditPoints !== null && options.every((option) => option.creditPoints === group.requiredCreditPoints))); };
const title = (group: RequirementGroup) => group.title?.trim() || "Study-path option";
const selectedGroup = (group: RequirementGroup, selections: ComponentSelections) => { const value = selections[group.id]; return value?.startsWith("GROUP:") ? group.children.find((child) => child.id === value.slice(6)) : undefined; };
const ComponentSelect = ({ group, label, selections, onSelect, clearGroupIds = [] }: { group: RequirementGroup; label: string; selections: ComponentSelections; onSelect: Props["onSelect"]; clearGroupIds?: string[] }) =>
  <label className="study-path__field"><span>{label}</span><select value={selections[group.id] ?? ""} onChange={(event) => onSelect(group.id, event.target.value, clearGroupIds)}>
    <option value="" disabled>Select an option</option>{components(group).map((component) => <option value={component.code} key={component.id}>{component.name}</option>)}</select></label>;

const GroupPreview = ({ group, selections, onSelect, planned }: { group: RequirementGroup; selections: ComponentSelections; onSelect: Props["onSelect"]; planned: Map<string, string> }) => {
  const subjectItems = group.items.filter((item) => item.subject); const componentItems = components(group);
  const broad = subjectItems.length === 0 && componentItems.length === 0 && group.children.length === 0;
  return <details className="path-preview" open={group.children.length <= 2}><summary><span>{title(group)}</span>
    <strong>{group.logic === "ALL" ? `CORE · Complete all${group.requiredCreditPoints !== null ? ` · ${group.requiredCreditPoints} CP` : ""}` : group.requiredCreditPoints !== null ? `OPTIONS · Choose ${group.requiredCreditPoints} CP` : group.logic.replace("_", " ")}</strong></summary>
    <div className="path-preview__body">{group.description && <p>{group.description}</p>}{broad && <p className="broad-requirement">Broad subject choice. Searched subjects are not automatically verified to count.</p>}
      {componentDecision(group) && <ComponentSelect group={group} label={componentItems[0]?.type.toLowerCase().replaceAll("_", " ") ?? title(group)} selections={selections} onSelect={onSelect} />}
      {subjectItems.length > 0 && <ul className="path-preview__subjects">{subjectItems.map((item) => <li key={item.id}>
        <strong>{group.logic === "ALL" ? planned.has(item.subject!.code) ? "✓" : "⚠" : ""} {item.subject!.code}</strong><span>{item.subject!.name}</span>
        <small>{group.logic === "ALL" ? planned.has(item.subject!.code) ? `Planned — ${planned.get(item.subject!.code)}` : "Not currently planned" : `${item.subject!.creditPoints ?? item.creditPoints ?? "—"} CP`}</small>
      </li>)}</ul>}{group.children.map((child) => <GroupPreview group={child} selections={selections} onSelect={onSelect} planned={planned} key={child.id} />)}</div></details>;
};
const ComponentPreview = ({ detail, selections, onSelect, planned }: { detail?: ComponentDetailResponse; selections: ComponentSelections; onSelect: Props["onSelect"]; planned: Map<string, string> }) => detail ?
  <div className="selected-path-preview"><div className="selected-path-preview__heading"><strong>{detail.component.name}</strong>{detail.component.creditPoints !== null && <span>{detail.component.creditPoints} CP</span>}</div>
    {detail.requirements.map((group) => <GroupPreview group={group} selections={selections} onSelect={onSelect} planned={planned} key={group.id} />)}</div> : null;

export const StudyPathSelector = ({ universityCode, degreeName, requirements, componentDetails, selections, onSelect, planner }: Props) => {
  const planned = new Map<string, string>(); planner?.years.forEach((year) => year.periods.forEach((period) => period.items.forEach((item) => {
    if (item.subject && !planned.has(item.subject.code)) planned.set(item.subject.code, `${year.name} ${period.name}`);
  })));
  const allDegreeGroups = flattenGroups(requirements); const majorGroup = allDegreeGroups.find((group) => components(group).some((component) => component.type === "MAJOR"));
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
      {separatePath.description && <p className="path-condition">{separatePath.description}</p>}{separateSelection && <div className="path-decision__detail"><GroupPreview group={separateSelection} selections={selections} onSelect={onSelect} planned={planned} />
        {separateComponentDetails.map((detail) => <ComponentPreview detail={detail} selections={selections} onSelect={onSelect} planned={planned} key={detail.component.code} />)}</div>}</section>}
  </section>;
};
