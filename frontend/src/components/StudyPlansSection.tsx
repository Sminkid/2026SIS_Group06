import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegreeStudyPlans } from "../api/degrees";
import { usePlannerState } from "../hooks/usePlannerState";
import type { ComponentDetailResponse, StudyPlan, StudyPlanItem } from "../types/handbook";
import {
  plannerItemToStudyPlanItem,
  plannerToStudyPlan,
  type PlannerContext,
} from "../types/planner";
import { AsyncState } from "./AsyncState";
import { SubjectChoiceDialog } from "./SubjectChoiceDialog";
import type { SubjectSearchResult } from "../types/subject";
import type { ComponentSelections } from "../hooks/useComponentSelections";
import type { RequirementGroup } from "../types/handbook";
import { usePlannerValidation } from "../hooks/usePlannerValidation";
import type { ValidationResult } from "../types/validation";
import { StudyPathSelector } from "./StudyPathSelector";
import { resolveStudyPathChoiceScope } from "../domain/studyPathChoiceScope";
import { readableText } from "../domain/readableText";
import { reconcileStudyPlan } from "../domain/studyPlanSelection";
import { expandRoadmapSlots } from "../domain/roadmapSlots";

interface Props {
  degreeCode: string;
  universityCode: string;
  handbookYear: number;
  selectedComponentCodes: string[];
  onOpenSubject: (subjectCode: string) => void;
  degreeCreditPoints: number | null;
  requirements: RequirementGroup[];
  selectedComponents: ComponentSelections;
  componentDetails: Record<string, ComponentDetailResponse>;
  componentDetailsStatus: "idle" | "loading" | "ready" | "error";
  degreeName: string;
  onSelectComponent: (groupId: string, value: string, clearGroupIds?: string[]) => void;
}
const PlanItemCard = ({
  item,
  editable,
  onChoose,
  onOpenSubject,
  issues,
  onRestoreChoice,
}: {
  item: StudyPlanItem;
  editable: boolean;
  onChoose: (item: StudyPlanItem) => void;
  onOpenSubject: (subjectCode: string) => void;
  issues: ValidationResult[];
  onRestoreChoice: (plannerItemId: string) => void;
}) => {
  const isChoice = item.itemType === "CHOICE";
  const isPlacement = isChoice && /\b(internship|placement|practicum|professional experience)\b/i.test(item.title);
  const isFixedComponentSubject = item.choiceOrigin?.componentRequirementKind === "FIXED";
  const isFilledChoice = Boolean(item.choiceOrigin) && !isChoice && !isFixedComponentSubject;
  const isChoiceSlot = isChoice || isFilledChoice;
  const code = item.subject?.code ?? item.rawCode;
  const name = readableText(item.subject?.name ?? item.title);
  const creditPoints = item.subject?.creditPoints ?? item.creditPoints;

  const content = <>
    <div className="plan-item__top">
      <span className="plan-item__kind">{isPlacement ? "Professional placement" : isFilledChoice ? "Selected subject" : isChoice ? "Choice" : "Subject"}</span>
      {creditPoints !== null && <span className="plan-item__cp">{creditPoints} CP</span>}
    </div>
    <h5>{name}</h5>
    {code && <p className="plan-item__code">{code}</p>}
    {item.choiceOrigin?.parentAggregateItemId && <p className="plan-item__note">Within {item.choiceOrigin.parentAggregateTitle} ({item.choiceOrigin.parentAggregateCreditPoints} CP official block). Source: {item.choiceOrigin.sourceLabel}.</p>}
    {isFixedComponentSubject && <p className="plan-item__note">Required by the selected component.</p>}
    {item.choiceOrigin?.candidateSourceType === "UNRESOLVED" && <p className="plan-item__note">{item.choiceOrigin.sourceLabel}</p>}
    {isPlacement && <p className="plan-item__note">Required professional placement. Sponsoring employer and enrolment details are confirmed through the course process.</p>}
    {isChoiceSlot && !isPlacement && <p className="plan-item__note">{editable
      ? isFilledChoice ? `From: ${item.choiceOrigin?.title} · Click to change` : "Click to choose a subject"
      : "Customize the plan to choose a subject"}</p>}
    {issues.length > 0 && <div className="plan-item__issues">
      {issues.map((issue, index) => <span className={`plan-item__issue plan-item__issue--${issue.severity}`} key={`${issue.code}-${index}`}>{issue.message}</span>)}
    </div>}
  </>;

  const className = `plan-item${isChoiceSlot && !isPlacement ? " plan-item--choice" : ""}${isFilledChoice ? " plan-item--filled" : ""}`;
  if (!editable) return <article className={className}>{content}</article>;

  return <article className={className}>
    {isPlacement ? <div className="plan-item__main-action">{content}</div> : isChoiceSlot
      ? <button className="plan-item__main-action" type="button" onClick={() => onChoose(item)}>{content}</button>
      : code
        ? <button className="plan-item__main-action" type="button" onClick={() => onOpenSubject(code)} aria-label={`View ${code} ${name}`}>{content}</button>
        : <div className="plan-item__main-action">{content}</div>}
    {((isFilledChoice && !isFixedComponentSubject) || (code && issues.length > 0)) && <div className="plan-item__controls">
      {code && issues.length > 0 && <button className="text-button" type="button" onClick={() => onOpenSubject(code)}>View requirements</button>}
      {isFilledChoice && !isFixedComponentSubject && <button className="plan-item__restore" type="button" onClick={() => onRestoreChoice(item.id)}>
        Remove subject &amp; restore choice
      </button>}
    </div>}
  </article>;
};

const roadmapBlocks = (items: StudyPlanItem[]) => {
  const blocks = new Map<string, StudyPlanItem[]>();
  items.forEach((item) => {
    const key = item.choiceOrigin?.parentAggregateItemId ?? item.id;
    blocks.set(key, [...(blocks.get(key) ?? []), item]);
  });
  return [...blocks.entries()];
};

export const StudyPlansSection = ({
  degreeCode,
  universityCode,
  handbookYear,
  selectedComponentCodes,
  onOpenSubject,
  degreeCreditPoints,
  requirements,
  selectedComponents,
  componentDetails,
  componentDetailsStatus,
  degreeName,
  onSelectComponent,
}: Props) => {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const variantStorageKey = `degree-planner:variant:${universityCode}:${handbookYear}:${degreeCode}`;
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(variantStorageKey) ?? "null");
      return saved && typeof saved === "object" && "planId" in saved && typeof saved.planId === "string" ? saved.planId : "";
    } catch { return ""; }
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [activeChoice, setActiveChoice] = useState<StudyPlanItem | null>(null);
  const [planNotice, setPlanNotice] = useState("");
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchDegreeStudyPlans(degreeCode, universityCode, handbookYear, controller.signal)
      .then((result) => {
        setPlans(result);
        setSelectedPlanId((current) => result.some((plan) => plan.id === current) ? current : (result[0]?.id ?? ""));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [degreeCode, handbookYear, reloadKey, universityCode]);

  const flattenRequirements = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap((group) => [group, ...flattenRequirements(group.children)]);
  const majorGroup = flattenRequirements(requirements).find((group) => group.pathways.length === 0
    && group.items.filter((item) => item.component?.type === "MAJOR").length > 1);
  const majorCode = majorGroup ? selectedComponents[majorGroup.id] : undefined;
  const reconciledPlan = reconcileStudyPlan(plans, selectedPlanId, universityCode === "UTS" ? majorCode : undefined);
  const selectedPlan = useMemo(() => expandRoadmapSlots(reconciledPlan.plan, universityCode, requirements, selectedComponents, componentDetails),
    [reconciledPlan.plan, universityCode, requirements, selectedComponents, componentDetails]);
  const selectPathComponent: Props["onSelectComponent"] = (groupId, value, clearIds = []) => {
    setActiveChoice(null);
    if (universityCode === "UTS" && groupId === majorGroup?.id) {
      const result = reconcileStudyPlan(plans, selectedPlan?.id ?? selectedPlanId, value);
      setSelectedPlanId(result.plan?.id ?? "");
      const name = majorGroup.items.find((item) => item.component?.code === value)?.component?.name;
      setPlanNotice(result.reason || `Study plan updated to match ${name ?? "the selected major"}.`);
    }
    onSelectComponent(groupId, value, clearIds);
  };
  const selectVariant = (id: string) => {
    const plan = plans.find((candidate) => candidate.id === id);
    if (!plan) return;
    setActiveChoice(null);
    if (universityCode === "UTS" && plan.major && majorGroup && plan.major.code !== majorCode) {
      const oldDetail = majorCode ? componentDetails[majorCode] : undefined;
      onSelectComponent(majorGroup.id, plan.major.code, oldDetail ? flattenRequirements(oldDetail.requirements).map((group) => group.id) : []);
    }
    setSelectedPlanId(id);
    setPlanNotice("");
  };
  useEffect(() => { setActiveChoice(null); }, [selectedComponents, selectedPlan?.id]);
  useEffect(() => {
    if (!selectedPlan || (majorCode && selectedPlan.major?.code !== majorCode)) return;
    setSelectedPlanId(selectedPlan.id);
    try { localStorage.setItem(variantStorageKey, JSON.stringify({ planId: selectedPlan.id, majorCode: selectedPlan.major?.code ?? null })); } catch { /* Session editing remains available. */ }
  }, [variantStorageKey, selectedPlan?.id, majorCode]);
  const pathwayGroups = useMemo(() => flattenRequirements(requirements).flatMap((group) => [
    ...group.pathways.flatMap((pathway) => pathway.selections.map((selection) => selection.requirementGroupId)),
    ...flattenRequirements(group.children).map((child) => child.id),
  ]), [requirements]);
  const activePathwayGroups = useMemo(() => flattenRequirements(requirements).flatMap((group) => {
    const selected = selectedComponents[group.id];
    const pathway = selected?.startsWith("PATHWAY:")
      ? group.pathways.find((candidate) => candidate.id === selected.slice(8))
      : undefined;
    const selectedBranch = selected?.startsWith("GROUP:") ? group.children.find((child) => child.id === selected.slice(6)) : undefined;
    return [...(pathway?.selections.map((selection) => selection.requirementGroupId) ?? []),
      ...(selectedBranch ? flattenRequirements([selectedBranch]).map((child) => child.id) : [])];
  }), [requirements, selectedComponents]);
  const plannerContext = useMemo<PlannerContext>(() => ({
    universityCode,
    handbookYear,
    degreeCode,
    selectedComponentCodes,
    activePathwayRequirementGroupIds: [...new Set(activePathwayGroups)],
    knownPathwayRequirementGroupIds: [...new Set(pathwayGroups)],
  }), [activePathwayGroups, degreeCode, handbookYear, pathwayGroups, selectedComponentCodes, universityCode]);
  const {
    planner,
    customize,
    reset,
    clear,
    selectSubject,
    restoreChoiceSlot,
  } = usePlannerState(selectedPlan, plannerContext);
  const displayedPlan = useMemo(
    () => planner && selectedPlan ? plannerToStudyPlan(planner, selectedPlan) : selectedPlan,
    [planner, selectedPlan],
  );
  const displayedSessionNames = useMemo(() => [...new Set(displayedPlan?.years.flatMap((year) => year.periods.map((period) => period.name)) ?? [])], [displayedPlan]);
  const { validation } = usePlannerValidation({
    planner,
    degreeCreditPoints,
    requirements,
    selectedComponents,
    universityCode,
    handbookYear,
  });
  const choiceEligibilityIssues = useMemo(() => {
    const knownComponentCodes = new Set<string>();
    const visit = (groups: RequirementGroup[]) => groups.forEach((group) => {
      group.items.forEach((item) => { if (item.component) knownComponentCodes.add(item.component.code); });
      visit(group.children);
    });
    visit(requirements);
    const selectedCodes = new Set(Object.values(selectedComponents));
    const validSelectedGroupIds = new Set<string>();
    const addGroups = (groups: RequirementGroup[]) => groups.forEach((group) => {
      validSelectedGroupIds.add(group.id); addGroups(group.children);
    });
    const allGroups = new Map<string, RequirementGroup>();
    const indexGroups = (groups: RequirementGroup[]) => groups.forEach((group) => { allGroups.set(group.id, group); indexGroups(group.children); });
    indexGroups(requirements);
    Object.values(componentDetails).forEach((detail) => indexGroups(detail.requirements));
    Object.values(selectedComponents).forEach((value) => {
      if (value.startsWith("GROUP:")) {
        const selected = allGroups.get(value.slice(6));
        if (selected) addGroups([selected]);
      } else if (componentDetails[value]) addGroups(componentDetails[value].requirements);
    });
    const issues = new Map<string, ValidationResult[]>();
    if (!planner) return issues;
    const items = [...planner.years.flatMap((year) => year.periods.flatMap((period) => period.items)), ...planner.unassignedItems];
    for (const item of items) {
      if (!item.subject || !item.choiceOrigin) continue;
      if (item.choiceOrigin.formalRequirementGroupId) {
        if (!validSelectedGroupIds.has(item.choiceOrigin.formalRequirementGroupId)) {
          issues.set(item.subject.code, [{ severity: "warning", code: "CHOICE_PATHWAY_MISMATCH", subjectCode: item.subject.code,
            message: `${item.subject.code} no longer satisfies the selected pathway. Keep it for now, then replace or remove it.` }]);
        }
        continue;
      }
      const originCode = item.choiceOrigin.formalComponentCode
        ?? item.choiceOrigin.rawCode?.trim().toUpperCase();
      if (!originCode) continue;
      if (!knownComponentCodes.has(originCode)) continue;
      const detail = componentDetails[originCode];
      const eligibleCodes = new Set(detail?.requirements.flatMap(function flatten(group): string[] {
        return [
          ...group.items.flatMap((requirementItem) => requirementItem.subject ? [requirementItem.subject.code] : []),
          ...group.children.flatMap(flatten),
        ];
      }) ?? []);
      if (!selectedCodes.has(originCode) || (detail && !eligibleCodes.has(item.subject.code))) {
        issues.set(item.subject.code, [{
          severity: "warning",
          code: "CHOICE_COMPONENT_MISMATCH",
          subjectCode: item.subject.code,
          message: `${item.subject.code} came from a different study-path selection. Keep it for now, but verify that it still counts.`,
        }]);
      }
    }
    return issues;
  }, [componentDetails, planner, requirements, selectedComponents]);
  const unassignedItems = useMemo(() => planner?.unassignedItems.map(
    (item, index) => plannerItemToStudyPlanItem(item, index),
  ) ?? [], [planner]);
  const combinedValidation = useMemo(() => {
    if (!validation) return null;
    const extraResults = [
      ...[...choiceEligibilityIssues.values()].flat(),
    ];
    const results = [...validation.results, ...extraResults];
    return {
      ...validation,
      results,
      errorCount: results.filter((result) => result.severity === "error").length,
      warningCount: results.filter((result) => result.severity === "warning").length,
      infoCount: results.filter((result) => result.severity === "info").length,
    };
  }, [choiceEligibilityIssues, validation]);
  const combinedIssuesBySubject = useMemo(() => {
    const index = new Map<string, ValidationResult[]>();
    for (const issue of combinedValidation?.results ?? []) {
      if (!issue.subjectCode || issue.severity === "info") continue;
      index.set(issue.subjectCode, [...(index.get(issue.subjectCode) ?? []), issue]);
    }
    return index;
  }, [combinedValidation]);
  const activeChoiceScope = useMemo(
    () => resolveStudyPathChoiceScope(activeChoice, requirements, componentDetails, selectedComponents, planner),
    [activeChoice, componentDetails, planner, requirements, selectedComponents],
  );
  const chooseSubject = (subject: SubjectSearchResult, formalComponentCode?: string, formalRequirementGroupId?: string) => {
    if (!activeChoice) return;
    selectSubject(activeChoice.id, subject, formalComponentCode, formalRequirementGroupId, activeChoiceScope.componentId);
    setActiveChoice(null);
  };
  const hasLongPlanTitle = (selectedPlan?.title.length ?? 0) > 180;

  return <section className="study-plans-section" aria-labelledby="study-plan-heading">
    <div className="section-heading">
      <div><p className="step-label">Official roadmap and personal planner</p><h2 id="study-plan-heading">Study plan</h2></div>
      <span className={`read-only-label${planner ? " read-only-label--custom" : ""}`}>
        {planner ? "My plan" : "Official roadmap"}
      </span>
    </div>
    <p className="section-note">This is the university's recommended sequence, not the formal degree requirement definition.</p>
    {status === "loading" && <AsyncState kind="loading" label="Loading official study plan" />}
    {status === "error" && <AsyncState kind="error" label="We couldn't load the official study plan." onRetry={retry} />}
    {status === "ready" && plans.length === 0 && <AsyncState kind="empty" label="No official recommended study plan is available for this degree." />}
    {status === "ready" && <>
      <StudyPathSelector
        universityCode={universityCode}
        degreeName={degreeName}
        requirements={requirements}
        componentDetails={componentDetails}
        componentDetailsStatus={componentDetailsStatus}
        selections={selectedComponents}
        onSelect={selectPathComponent}
        planner={planner}
      />
      {plans.length > 1 && <label className="plan-selector"><span>Study plan variant</span>
        <select value={selectedPlan?.id ?? ""} onChange={(event) => selectVariant(event.target.value)}>
          <option value="" disabled>Choose an official variant</option>
          {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.title}</option>)}
        </select>
      </label>}
      {(planNotice || reconciledPlan.reason) && <p className="selection-notice" role="status">{reconciledPlan.reason || planNotice}</p>}
    </>}
    {status === "ready" && selectedPlan && displayedPlan && <>
      <div className="plan-intro">
        <h3>{hasLongPlanTitle ? "Official recommended study plan" : selectedPlan.title}</h3>
        {hasLongPlanTitle && <details className="plan-source-title">
          <summary>View official plan title and variants</summary>
          <p>{selectedPlan.title}</p>
        </details>}
        {selectedPlan.description && <p>{readableText(selectedPlan.description)}</p>}
      </div>
      <div className={`planner-toolbar${planner ? " planner-toolbar--active" : ""}`}>
        <div>
          <strong>{planner ? "Custom planner active" : "Want to experiment?"}</strong>
          <p>{planner
            ? "Your draft is separate from the official handbook and saved automatically on this device."
            : "Create a private editable copy of this official plan. The handbook data will stay unchanged."}</p>
        </div>
        <div className="planner-toolbar__actions">
          {planner ? <>
            <button className="secondary-button" type="button" onClick={reset}>Reset to official plan</button>
            <button className="text-button text-button--danger" type="button" onClick={clear}>Clear custom changes</button>
          </> : <button className="primary-button" type="button" onClick={customize}>Customize plan</button>}
        </div>
      </div>
      {planner && <div className="roadmap-basis" role="status">
        <strong>Roadmap based on: {selectedPlan.title}</strong>
        {Object.values(componentDetails).length > 0 && <span>Personalised with: {Object.values(componentDetails).map((detail) => detail.component.name).join(" · ")}</span>}
      </div>}
      <div className="planner-study-layout">
      <div className="planner-plan-column">
      {displayedSessionNames.some((name) => /session 1|autumn|spring/i.test(name)) && <details className="session-help"><summary>Understanding teaching sessions</summary><dl>
        {displayedSessionNames.filter((name) => /autumn/i.test(name)).length > 0 && <div><dt>Autumn</dt><dd>Main first-half teaching session.</dd></div>}
        {displayedSessionNames.filter((name) => /spring/i.test(name)).length > 0 && <div><dt>Spring</dt><dd>Main second-half teaching session.</dd></div>}
        {displayedSessionNames.filter((name) => /session 1/i.test(name)).length > 0 && <div><dt>Session 1</dt><dd>A separate teaching or placement period used by this course calendar; it is not assumed to be Autumn.</dd></div>}
      </dl><p>Exact dates are not stored in this planner. Check the university academic calendar before enrolling.</p></details>}
      <div className="plan-years">
        {displayedPlan.years.map((year) => <section className="plan-year" key={year.id}>
          <h3>{year.name}</h3>
          <div className="plan-periods">
            {year.periods.map((period) => <section className="plan-period" key={period.id}>
              <div className="plan-period__heading"><h4>{period.name}</h4></div>
              {period.items.length === 0 ? <p className="plan-period__empty">No items listed</p> :
                <div className="plan-items">{roadmapBlocks(period.items).map(([blockId, blockItems]) => {
                  const origin = blockItems[0].choiceOrigin;
                  const required = origin?.parentAggregateCreditPoints;
                  const points = blockItems.reduce((sum, item) => sum + (item.subject?.creditPoints ?? 0), 0);
                  return <div key={blockId} className={required ? "roadmap-aggregate" : "roadmap-single"}>
                  {required !== undefined && <header><strong>{origin?.parentAggregateTitle}</strong><p>{points} / {required} CP selected · {Math.max(0, required - points)} CP remaining. Positions within this official block.</p></header>}
                  <div className={required ? "plan-items" : undefined}>{blockItems.map((item) => (
                  <PlanItemCard
                    item={item}
                    editable={planner !== null}
                    onChoose={setActiveChoice}
                    onOpenSubject={onOpenSubject}
                    issues={item.subject && item.choiceOrigin ? (combinedIssuesBySubject.get(item.subject.code) ?? []) : []}
                    onRestoreChoice={restoreChoiceSlot}
                    key={item.id}
                  />
                ))}</div></div>;
                })}</div>}
            </section>)}
          </div>
        </section>)}
      </div>
      {planner && unassignedItems.length > 0 && <section className="unassigned-section" aria-labelledby="unassigned-heading">
        <div><p className="step-label">Custom plan holding area</p><h3 id="unassigned-heading">Unscheduled subjects</h3>
          <p>Move these subjects into a study period when you are ready.</p></div>
        <div className="plan-items">
          {unassignedItems.map((item) => <PlanItemCard
            item={item}
            editable
            onChoose={setActiveChoice}
            onOpenSubject={onOpenSubject}
            issues={item.subject && item.choiceOrigin ? (combinedIssuesBySubject.get(item.subject.code) ?? []) : []}
            onRestoreChoice={restoreChoiceSlot}
            key={item.id}
          />)}
        </div>
      </section>}
      </div>
      </div>
      <SubjectChoiceDialog
        choiceItem={activeChoice}
        universityCode={universityCode}
        handbookYear={handbookYear}
        scope={activeChoiceScope}
        planner={planner}
        onOpenSubject={onOpenSubject}
        onClose={() => setActiveChoice(null)}
        onSelect={chooseSubject}
      />
    </>}
  </section>;
};
