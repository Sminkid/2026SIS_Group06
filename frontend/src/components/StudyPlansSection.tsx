import { appUi } from "./ui";
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
import { RoadmapCard } from "./planner/RoadmapCard";
import { plannerUi } from "./planner/ui";
import { SubjectDetailsDialog } from "./SubjectDetailsDialog";
import { getPrerequisiteDisplayState } from "../domain/prerequisiteDisplay";
import { readableText } from "../domain/readableText";
import { reconcileStudyPlan } from "../domain/studyPlanSelection";
import { expandRoadmapSlots } from "../domain/roadmapSlots";
import { SwapPositionDialog } from "./SwapPositionDialog";
import { OfficialPlanRoadmap } from "./study-plan/OfficialPlanRoadmap";

export interface StudyPlansSectionProps {
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
/** Groups allocations by their formal aggregate without changing their schedule order. */
/** Coordinates the official roadmap, student draft and their existing selection workflows. */
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
}: StudyPlansSectionProps) => {
  const [requirementDetail, setRequirementDetail] = useState<{ code: string; issues: ValidationResult[] } | null>(null);
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
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
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
  const selectPathComponent: StudyPlansSectionProps["onSelectComponent"] = (groupId, value, clearIds = []) => {
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
  useEffect(() => { setActiveChoice(null); setSwapSourceId(null); }, [selectedComponents, selectedPlan?.id]);
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
    swapPositions,
  } = usePlannerState(selectedPlan, plannerContext, selectedComponentCodes.length === 0
    || (componentDetailsStatus === "ready" && selectedComponentCodes.every(code => Boolean(componentDetails[code]))));
  const displayedPlan = useMemo(
    () => planner && selectedPlan ? plannerToStudyPlan(planner, selectedPlan) : selectedPlan,
    [planner, selectedPlan],
  );
  const displayedSessionNames = useMemo(() => [...new Set(displayedPlan?.years.flatMap((year) => year.periods.map((period) => period.name)) ?? [])], [displayedPlan]);
  const { validation, accessConditions, status: validationStatus } = usePlannerValidation({
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
      if (!issue.subjectCode) continue;
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
    const groupLabel = flattenRequirements(activeChoiceScope.groups ?? []).find((group) => group.id === formalRequirementGroupId)?.title ?? undefined;
    selectSubject(activeChoice.id, subject, formalComponentCode, formalRequirementGroupId, activeChoiceScope.componentId, groupLabel);
    setActiveChoice(null);
  };
  const hasLongPlanTitle = (selectedPlan?.title.length ?? 0) > 180;

  return <section className={appUi.studyPlansSection} aria-labelledby="study-plan-heading">
    <div className={appUi.sectionHeading}>
      <div><p className={appUi.stepLabel}>Official roadmap and personal planner</p><h2 id="study-plan-heading">Study plan</h2></div>
      <span className={planner ? appUi.readOnlyLabelCustom : appUi.readOnlyLabel}>
        {planner ? "My plan" : "Official roadmap"}
      </span>
    </div>
    <p className={appUi.sectionNote}>This is the university's recommended sequence, not the formal degree requirement definition.</p>
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
      {plans.length > 1 && <label className={appUi.planSelector}><span>Study plan variant</span>
        <select value={selectedPlan?.id ?? ""} onChange={(event) => selectVariant(event.target.value)}>
          <option value="" disabled>Choose an official variant</option>
          {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.title}</option>)}
        </select>
      </label>}
      {(planNotice || reconciledPlan.reason) && <p className={appUi.selectionNotice} role="status">{reconciledPlan.reason || planNotice}</p>}
    </>}
    {status === "ready" && selectedPlan && displayedPlan && <>
      <div className={appUi.planIntro}>
        <h3>{hasLongPlanTitle ? "Official recommended study plan" : selectedPlan.title}</h3>
        {hasLongPlanTitle && <details className={appUi.planSourceTitle}>
          <summary>View official plan title and variants</summary>
          <p>{selectedPlan.title}</p>
        </details>}
        {selectedPlan.description && <p>{readableText(selectedPlan.description)}</p>}
      </div>
      <div className={planner ? appUi.plannerToolbarActive : appUi.plannerToolbar}>
        <div>
          <strong>{planner ? "Custom planner active" : "Want to experiment?"}</strong>
          <p>{planner
            ? "Your draft is separate from the official handbook and saved automatically on this device."
            : "Create a private editable copy of this official plan. The handbook data will stay unchanged."}</p>
        </div>
        <div className={appUi.plannerToolbarActions}>
          {planner ? <>
            <button className={appUi.secondaryButton} type="button" onClick={reset}>Reset to official plan</button>
            <button className={appUi.textButtonDanger} type="button" onClick={clear}>Clear custom changes</button>
          </> : <button className={appUi.primaryButton} type="button" onClick={customize}>Customize plan</button>}
        </div>
      </div>
      {planner && <div className={appUi.roadmapBasis} role="status">
        <strong>Roadmap based on: {selectedPlan.title}</strong>
        {Object.values(componentDetails).length > 0 && <span>Personalised with: {Object.values(componentDetails).map((detail) => detail.component.name).join(" · ")}</span>}
      </div>}
      <div>
      <div className={appUi.plannerPlanColumn}>
      {displayedSessionNames.some((name) => /session 1|autumn|spring/i.test(name)) && <details className={appUi.sessionHelp}><summary>Understanding teaching sessions</summary><dl>
        {displayedSessionNames.filter((name) => /autumn/i.test(name)).length > 0 && <div><dt>Autumn</dt><dd>Main first-half teaching session.</dd></div>}
        {displayedSessionNames.filter((name) => /spring/i.test(name)).length > 0 && <div><dt>Spring</dt><dd>Main second-half teaching session.</dd></div>}
        {displayedSessionNames.filter((name) => /session 1/i.test(name)).length > 0 && <div><dt>Session 1</dt><dd>A separate teaching or placement period used by this course calendar; it is not assumed to be Autumn.</dd></div>}
      </dl><p>Exact dates are not stored in this planner. Check the university academic calendar before enrolling.</p></details>}
      <OfficialPlanRoadmap plan={displayedPlan} renderItem={(item, scheduled) => <RoadmapCard
                    item={item}
                    editable={planner !== null}
                    onChoose={setActiveChoice}
                    onOpenSubject={(code, issues) => setRequirementDetail({ code, issues })}
                    issues={item.subject ? (combinedIssuesBySubject.get(item.subject.code) ?? []) : []}
                    prerequisite={planner && item.subject ? getPrerequisiteDisplayState(accessConditions[item.subject.code], combinedIssuesBySubject.get(item.subject.code), { loading: validationStatus === "loading", hasPlan: true }) : undefined}
                    onRestoreChoice={restoreChoiceSlot}
                    onSwap={setSwapSourceId}
                    scheduled={scheduled}
                    key={item.id}
                  />} />
      {planner && unassignedItems.length > 0 && <section className={appUi.unassignedSection} aria-labelledby="unassigned-heading">
        <div><p className={appUi.stepLabel}>Custom plan holding area</p><h3 id="unassigned-heading">Unscheduled subjects</h3>
          <p>Move these subjects into a study period when you are ready.</p></div>
        <div className={plannerUi.grid}>
          {unassignedItems.map((item) => <RoadmapCard
            item={item}
            editable
            onChoose={setActiveChoice}
            onOpenSubject={(code, issues) => setRequirementDetail({ code, issues })}
            issues={item.subject ? (combinedIssuesBySubject.get(item.subject.code) ?? []) : []}
                    prerequisite={planner && item.subject ? getPrerequisiteDisplayState(accessConditions[item.subject.code], combinedIssuesBySubject.get(item.subject.code), { loading: validationStatus === "loading", hasPlan: true }) : undefined}
            onRestoreChoice={restoreChoiceSlot}
            key={item.id}
          />)}
        </div>
      </section>}
      </div>
      </div>
      <SubjectDetailsDialog subjectCode={requirementDetail?.code ?? null} universityCode={universityCode} handbookYear={handbookYear}
        planIssues={requirementDetail?.issues} hasPlan={Boolean(planner)} onClose={() => setRequirementDetail(null)} />
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
      {planner && swapSourceId && <SwapPositionDialog key={swapSourceId} planner={planner} sourceId={swapSourceId}
        universityCode={universityCode} handbookYear={handbookYear} onClose={() => setSwapSourceId(null)} onConfirm={swapPositions} />}
    </>}
  </section>;
};
