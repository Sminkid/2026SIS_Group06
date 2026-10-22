import { useEffect, useMemo, useRef, useState } from "react";
import { fetchComponentDetail } from "../../../api/components";
import { adaptUsydEngineeringPlan, resolveUsydEngineeringChoice, usydGroups, usydPlannerContext,
  usydPreviewStream } from "../../../domain/usydEngineeringPlanner";
import { normalizeUsydEngineeringAccess } from "../../../domain/usydEngineeringAccessConditions";
import { getPrerequisiteDisplayState } from "../../../domain/prerequisiteDisplay";
import { plannerItems } from "../../../domain/plannerSwap";
import { usePlannerState } from "../../../hooks/usePlannerState";
import type { ComponentDetailResponse, RequirementComponent, RequirementGroup, StudyPlan, StudyPlanItem } from "../../../types/handbook";
import { usydEngineeringSpecialisations } from "../../../domain/usydEngineeringSpecialisations";
import { plannerItemToStudyPlanItem, plannerToStudyPlan } from "../../../types/planner";
import { SubjectChoiceDialog } from "../../SubjectChoiceDialog";
import { SubjectDetailsDialog } from "../../SubjectDetailsDialog";
import { AsyncState } from "../../AsyncState";
import { RoadmapCard } from "../../planner/RoadmapCard";
import { plannerUi } from "../../planner/ui";
import { appUi } from "../../ui";
import { PlanModeBadge } from "../PlanModeBadge";
import { focusPlanAction } from "../focusPlanAction";
import { ConfirmDialog } from "../../ConfirmDialog";
import { OfficialPlanRoadmap } from "../OfficialPlanRoadmap";
import { UsydEngineeringFocusSummary } from "./UsydEngineeringFocusSummary";
import { UsydEngineeringProgressCard, type UsydAcademicComponent } from "./UsydEngineeringProgressCard";
import { UsydEngineeringReadOnlyCard } from "./UsydEngineeringReadOnlyCard";
import { useUsydChoiceFocus } from "./useUsydChoiceFocus";
import { useUsydEngineeringValidation } from "./useUsydEngineeringValidation";

interface Props { plan: StudyPlan; requirements: RequirementGroup[]; handbookYear: number; degreeCode: string;
  degreeCreditPoints: number | null; focusComponent?: RequirementComponent; academicComponents: UsydAcademicComponent[]; academicStreamMismatch?: string;
  /** Called with true while the editable personal plan is shown, and false otherwise. */
  onEditableChange?: (editable: boolean) => void; }

/** A keyed session owns only orchestration. Shared state persists each resolved CUSP identity separately. */
export function UsydEngineeringPersonalPlan(props: Props) {
  const streamReference = useMemo(() => usydPreviewStream(props.requirements, props.plan.pathway ?? ""), [props.requirements, props.plan.pathway]);
  const [stream, setStream] = useState<ComponentDetailResponse>();
  const [specialisation, setSpecialisation] = useState<ComponentDetailResponse>();
  const [componentStatus, setComponentStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setComponentStatus("loading"); setStream(undefined); setSpecialisation(undefined);
    const load = async () => {
      if (!streamReference) return { stream: undefined, specialisation: undefined };
      const stream = await fetchComponentDetail(streamReference.id, "USYD", props.handbookYear, controller.signal);
      const reference = usydEngineeringSpecialisations(stream).find(option => option.component.code === props.focusComponent?.code)?.component;
      const specialisation = reference ? await fetchComponentDetail(reference.id, "USYD", props.handbookYear, controller.signal) : undefined;
      return { stream, specialisation };
    };
    void load().then(result => { if (!controller.signal.aborted) { setStream(result.stream); setSpecialisation(result.specialisation); setComponentStatus("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setComponentStatus("error"); });
    return () => controller.abort();
  }, [streamReference?.id, props.focusComponent?.code, props.handbookYear, retryKey]);
  const context = useMemo(() => usydPlannerContext(props.handbookYear, props.degreeCode,
    streamReference?.code, specialisation?.component.code),
  [props.handbookYear, props.degreeCode, streamReference?.code, specialisation?.component.code]);
  // Wait for exact component identity; a partially hydrated context must never carry a draft to another key.
  return <div data-usyd-plan-id={props.plan.id}>
    {componentStatus === "ready" && props.focusComponent && !specialisation && <p role="status" className={appUi.selectionNotice}>This formal specialisation is unavailable in the selected stream.</p>}
    {componentStatus === "loading" && <AsyncState kind="loading" label="Loading eligible study path subjects" />}
    {componentStatus === "error" && <AsyncState kind="error" label="Couldn't load eligible study path subjects." onRetry={() => setRetryKey(key => key + 1)} />}
    {componentStatus === "ready" && <PersonalPlanSession key={JSON.stringify(context)} {...props} context={context} stream={stream} specialisation={specialisation} />}
  </div>;
}

function PersonalPlanSession({ plan, context, stream, specialisation, requirements, handbookYear, degreeCreditPoints, academicComponents, academicStreamMismatch, onEditableChange }: Props & {
  context: ReturnType<typeof usydPlannerContext>; stream?: ComponentDetailResponse; specialisation?: ComponentDetailResponse;
}) {
  const template = useMemo(() => adaptUsydEngineeringPlan(plan), [plan]);
  const state = usePlannerState(template, context, false, true);
  const [dalyell, setDalyell] = useState(() => { try { return localStorage.getItem(`usyd:dalyell:${handbookYear}:${context.degreeCode}`) === "true"; } catch { return false; } });
  const [activeChoiceId, setActiveChoiceId] = useState<string | null>(null);
  const [detailsCode, setDetailsCode] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  // Reset and Clear ask first, since both discard the subjects the user chose.
  const [confirming, setConfirming] = useState<"reset" | "clear" | null>(null);
  // Read-only choice cards send the user to Customise Plan.
  const editButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(""), 5000); return () => window.clearTimeout(timeout); }, [notice]);
  const editable = Boolean(state.planner);
  useEffect(() => { onEditableChange?.(editable); return () => onEditableChange?.(false); }, [editable, onEditableChange]);
  const displayed = useMemo(() => editable && state.planner ? plannerToStudyPlan(state.planner, template) : plan, [editable, state.planner, template, plan]);
  const items = useMemo(() => state.planner ? [...plannerItems(state.planner), ...state.planner.unassignedItems] : [], [state.planner]);
  const activeChoice = items.find(item => item.plannerItemId === activeChoiceId);
  const choiceItem = useMemo(() => activeChoice ? plannerItemToStudyPlanItem(activeChoice) : null, [activeChoice]);
  const scope = useMemo(() => resolveUsydEngineeringChoice(activeChoice ? plannerItemToStudyPlanItem(activeChoice) : null,
    requirements, stream, specialisation, dalyell), [activeChoice, requirements, stream, specialisation, dalyell]);
  const focusedView = useUsydChoiceFocus(choiceItem, scope, stream, specialisation);
  const validationRequirements = useMemo(() => [...requirements.filter(group => !/Dalyell|Table D/i.test(group.description ?? "")
    && !group.items.some(item => item.component?.type === "STREAM")),
    ...(stream?.requirements.filter(group => !group.items.some(item => item.component)) ?? [])], [requirements, stream]);
  const selected = useMemo(() => Object.fromEntries([stream?.component.code, ...academicComponents.map(option => option.reference.code)]
    .filter((code): code is string => Boolean(code)).map((code, index) => [`academic:${index}`, code])), [stream, academicComponents]);
  const { validation, accessConditions, status } = useUsydEngineeringValidation({ planner: state.planner, requirements: validationRequirements,
    selectedComponents: selected, handbookYear, degreeCreditPoints });
  const issuesFor = (code: string) => validation?.results.filter(issue => issue.subjectCode === code) ?? [];
  const renderCard = (item: StudyPlanItem, scheduled: string) => {
    if (!editable) return <UsydEngineeringReadOnlyCard key={item.id} item={item} scheduled={scheduled} onOpenSubject={setDetailsCode}
      onCustomise={() => focusPlanAction(editButtonRef.current)} />;
    return <RoadmapCard key={item.id} item={item} editable={editable} scheduled={scheduled} showReadOnlyDetails issues={editable && item.subject ? issuesFor(item.subject.code) : []}
      prerequisite={editable && item.subject ? getPrerequisiteDisplayState(accessConditions[item.subject.code], issuesFor(item.subject.code), { hasPlan: true, loading: status === "loading" }) : undefined}
      onChoose={item => setActiveChoiceId(item.id)} onOpenSubject={setDetailsCode} onRestoreChoice={state.restoreChoiceSlot}
      readOnlyChoiceNote="Customise to choose from eligible subjects" />;
  };
  const tableD = usydGroups(requirements).find(group => group.candidateSources.some(source => source.tableName === "Table D"));
  const dalyellPoints = items.filter(item => item.subject && item.choiceOrigin?.formalRequirementGroupId === tableD?.id)
    .reduce((sum, item) => sum + (item.subject?.creditPoints ?? 0), 0);
  const selectedSubjects = items.flatMap(item => item.subject ? [{ ...item.subject, id: item.subject.officialSubjectId }] : []);
  const selectedPoints = [...new Map(selectedSubjects.map(subject => [subject.code, subject])).values()].reduce((sum, subject) => sum + (subject.creditPoints ?? 0), 0);
  const targetPoints = degreeCreditPoints ?? 192;
  const reviewIssues = [...new Map((validation?.results ?? []).map(issue => [`${issue.severity}:${issue.subjectCode}:${issue.message}`, issue])).values()];
  const planWarnings = reviewIssues.filter(issue => issue.severity !== "info");
  const verificationNotes = reviewIssues.filter(issue => issue.severity === "info");
  return <>
    <UsydEngineeringFocusSummary focus={specialisation} breadth={usydEngineeringSpecialisations(stream).find(option => option.component.code === specialisation?.component.code)?.kind === "BREADTH_SPECIALISATION"}
      handbookYear={handbookYear} onOpenSubject={setDetailsCode} />
    <div className={editable ? appUi.plannerToolbarActive : appUi.plannerToolbar} data-plan-toolbar>
      <div><PlanModeBadge editable={editable} /><strong>{editable ? "My personal plan" : "Official CUSP roadmap"}</strong><p>{state.planner ? "Your draft is saved automatically on this device." : "Create an editable copy of this official roadmap."}</p></div>
      <div className={appUi.plannerToolbarActions}>
        {!state.planner ? <button ref={editButtonRef} className={appUi.primaryButton} type="button" onClick={state.customize}>Customise Plan</button> : <>
          <button className={appUi.secondaryButton} type="button" onClick={() => setConfirming("reset")}>Reset to official plan</button>
          <button className={appUi.textButtonDanger} type="button" onClick={() => setConfirming("clear")}>Exit custom mode</button>
        </>}
      </div>
    </div>
    {notice && <p role="status" className={appUi.actionNotice}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M20 6 9 17l-5-5" /></svg>{notice}</p>}
    {editable && <>
      <section aria-label="Personal plan summary" className={appUi.planPanel}>
      <div className={appUi.planPanelHeader}><h3>Personal plan summary</h3>
        <strong className={appUi.planPanelTotal}>{selectedPoints} / {targetPoints} CP selected</strong></div>
      <progress className={appUi.planProgress} aria-label="Selected degree credit points" value={Math.min(selectedPoints, targetPoints)} max={targetPoints} />
      <p className="font-semibold text-[#0a0a0a]">{validation ? `${planWarnings.length} plan warnings${verificationNotes.length ? ` · ${verificationNotes.length} verification notes` : ""}` : "Checking plan requirements…"}</p>
      <p className={appUi.planPanelNote}>Selected credit points include unscheduled subjects. Formal completion, unknown rules and conditional requirements still need handbook verification.</p>
      {status === "error" && <p role="alert">Couldn't check access conditions. Your plan is saved; reload to retry.</p>}
      {validation && <details><summary>Review plan warnings ({planWarnings.length}){verificationNotes.length > 0 && ` and verification notes (${verificationNotes.length})`}</summary>
        {planWarnings.map((issue, index) => <p key={`warning:${index}`} data-usyd-plan-warning>{issue.subjectCode && `${issue.subjectCode}: `}{issue.message}</p>)}
        {verificationNotes.length > 0 && <p className="font-semibold">Handbook verification notes</p>}
        {verificationNotes.map((issue, index) => <p key={`note:${index}`} data-usyd-verification-note>{issue.subjectCode && `${issue.subjectCode}: `}{issue.message}</p>)}
      </details>}
      {tableD && <label className={appUi.planCheckbox}><input type="checkbox" checked={dalyell} onChange={event => { setDalyell(event.target.checked); try { localStorage.setItem(`usyd:dalyell:${handbookYear}:${context.degreeCode}`, String(event.target.checked)); } catch { /* Session state remains available. */ } }} /> I am enrolled in the Dalyell Stream</label>}
      {tableD && dalyell && <p>Dalyell allocation: {dalyellPoints} / {tableD.requiredCreditPoints ?? 12} CP from Table D. Enrolment and formal completion need verification.</p>}
      {tableD && !dalyell && dalyellPoints > 0 && <p role="alert" className={appUi.planPanelWarning}>Your draft contains Table D allocations. Confirm Dalyell enrolment or replace those selections with subjects eligible for your current requirements.</p>}
      </section>
      {academicStreamMismatch && <p role="status" className={appUi.planPanelNotice}>Your formal specialisations remain selected under {academicStreamMismatch}. Preview that stream to see their progress against its personal plan.</p>}
      {academicComponents.length > 0 ? <div className="mb-5 grid gap-4 lg:grid-cols-2" aria-label="Formal specialisation progress">{academicComponents.map(selection => <UsydEngineeringProgressCard key={selection.reference.code}
        selection={selection} subjects={selectedSubjects} onOpenSubject={setDetailsCode} handbookYear={handbookYear}
        hasConflict={Boolean(validation?.results.some(issue => issue.code === "ANTI_REQUISITE_CONFLICT" && selection.detail?.requirements.some(group => group.items.some(item => item.subject?.code === issue.subjectCode))))} />)}</div>
        : specialisation && !academicStreamMismatch && <p className={appUi.planPanelNotice}>This specialisation is your roadmap focus. Select it in Course Structure to track formal progress.</p>}
    </>}
    <div className={editable ? appUi.planAreaEditable : undefined}>
    <OfficialPlanRoadmap plan={displayed} renderItem={renderCard} />
    {editable && state.planner && state.planner.unassignedItems.length > 0 && <section aria-labelledby="usyd-unscheduled-heading" className="mt-6"><h3 id="usyd-unscheduled-heading">Unscheduled subjects</h3>
      <p>These subjects aren't in a study period yet. Use Remove to restore their choice slot.</p>
      <div className={plannerUi.grid}>{state.planner.unassignedItems.map(item => renderCard(plannerItemToStudyPlanItem(item), "Unscheduled"))}</div>
    </section>}
    </div>
    {editable && tableD && dalyell && <details className="mt-5"><summary>Conditional Dalyell requirement · 12 CP from Table D</summary>
      <p>Table D membership is shown in Course Structure. Allocate eligible Table D units to an available Free Elective position; this does not add credit capacity.</p>
    </details>}
    <SubjectChoiceDialog choiceItem={choiceItem} scope={scope} planner={state.planner} focusedView={focusedView}
      universityCode="USYD" handbookYear={handbookYear} adaptAccess={normalizeUsydEngineeringAccess} onClose={() => setActiveChoiceId(null)} onOpenSubject={setDetailsCode}
      onSelect={(subject, component, groupId) => {
        if (!activeChoice) return;
        const group = usydGroups(scope.groups ?? []).find(group => group.id === groupId);
        const owner = component === stream?.component.code ? stream : component === specialisation?.component.code ? specialisation : undefined;
        state.selectSubject(activeChoice.plannerItemId, subject, component, groupId, owner?.component.id, group?.title ?? undefined, true); setActiveChoiceId(null);
      }} />
    {confirming === "reset" && <ConfirmDialog title="Reset to the official plan?"
      message="Your chosen subjects will be replaced by the official CUSP roadmap. You can keep customising afterwards."
      confirmLabel="Reset plan" onCancel={() => setConfirming(null)}
      onConfirm={() => { state.reset(); setConfirming(null); setNotice("Personal plan reset to the official template."); }} />}
    {confirming === "clear" && <ConfirmDialog title="Exit custom mode?" danger
      message="This removes your personal plan and shows the official CUSP roadmap again. This can't be undone."
      confirmLabel="Exit custom mode" onCancel={() => setConfirming(null)}
      onConfirm={() => { state.clear(); setConfirming(null); setNotice("Custom changes cleared."); }} />}
    <SubjectDetailsDialog subjectCode={detailsCode} universityCode="USYD" handbookYear={handbookYear} onClose={() => setDetailsCode(null)}
      planIssues={detailsCode ? issuesFor(detailsCode) : []} hasPlan={editable} adaptAccess={normalizeUsydEngineeringAccess} />
  </>;
}
