import { useEffect, useMemo, useState } from "react";
import { fetchComponentDetail } from "../../../api/components";
import { adaptUsydEngineeringPlan, isUsydMovable, resolveUsydEngineeringChoice, usydGroups, usydPlannerContext,
  usydPreviewStream } from "../../../domain/usydEngineeringPlanner";
import { normalizeUsydEngineeringAccess } from "../../../domain/usydEngineeringAccessConditions";
import { getPrerequisiteDisplayState } from "../../../domain/prerequisiteDisplay";
import { isCustomPosition, plannerItems } from "../../../domain/plannerSwap";
import { usePlannerState } from "../../../hooks/usePlannerState";
import type { ComponentDetailResponse, RequirementComponent, RequirementGroup, StudyPlan, StudyPlanItem } from "../../../types/handbook";
import { usydEngineeringSpecialisations } from "../../../domain/usydEngineeringSpecialisations";
import { plannerItemToStudyPlanItem, plannerToStudyPlan } from "../../../types/planner";
import { SubjectChoiceDialog } from "../../SubjectChoiceDialog";
import { SubjectDetailsDialog } from "../../SubjectDetailsDialog";
import { MoveSubjectDialog } from "../../MoveSubjectDialog";
import { SwapPositionDialog } from "../../SwapPositionDialog";
import { AsyncState } from "../../AsyncState";
import { RoadmapCard } from "../../planner/RoadmapCard";
import { plannerUi } from "../../planner/ui";
import { appUi } from "../../ui";
import { OfficialPlanRoadmap } from "../OfficialPlanRoadmap";
import { UsydEngineeringFocusSummary } from "./UsydEngineeringFocusSummary";
import { UsydEngineeringProgressCard, type UsydAcademicComponent } from "./UsydEngineeringProgressCard";
import { UsydEngineeringReadOnlyCard } from "./UsydEngineeringReadOnlyCard";
import { useUsydChoiceFocus } from "./useUsydChoiceFocus";
import { useUsydEngineeringValidation } from "./useUsydEngineeringValidation";
const canUsydSwap = (item: Parameters<typeof isUsydMovable>[0]) => !item.subject || isUsydMovable(item);

interface Props { plan: StudyPlan; requirements: RequirementGroup[]; handbookYear: number; degreeCode: string;
  degreeCreditPoints: number | null; focusComponent?: RequirementComponent; academicComponents: UsydAcademicComponent[]; academicStreamMismatch?: string; }

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
    {componentStatus === "ready" && props.focusComponent && !specialisation && <p role="status" className="mb-4 text-sm text-amber-900">This formal specialisation is unavailable in the selected stream.</p>}
    {componentStatus === "loading" && <AsyncState kind="loading" label="Loading eligible study path subjects" />}
    {componentStatus === "error" && <AsyncState kind="error" label="Couldn't load eligible study path subjects." onRetry={() => setRetryKey(key => key + 1)} />}
    {componentStatus === "ready" && <PersonalPlanSession key={JSON.stringify(context)} {...props} context={context} stream={stream} specialisation={specialisation} />}
  </div>;
}

function PersonalPlanSession({ plan, context, stream, specialisation, requirements, handbookYear, degreeCreditPoints, academicComponents, academicStreamMismatch }: Props & {
  context: ReturnType<typeof usydPlannerContext>; stream?: ComponentDetailResponse; specialisation?: ComponentDetailResponse;
}) {
  const template = useMemo(() => adaptUsydEngineeringPlan(plan), [plan]);
  const state = usePlannerState(template, context, false, true);
  const [official, setOfficial] = useState(false);
  const [dalyell, setDalyell] = useState(() => { try { return localStorage.getItem(`usyd:dalyell:${handbookYear}:${context.degreeCode}`) === "true"; } catch { return false; } });
  const [activeChoiceId, setActiveChoiceId] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [detailsCode, setDetailsCode] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(""), 5000); return () => window.clearTimeout(timeout); }, [notice]);
  const editable = Boolean(state.planner && !official);
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
    if (!editable) return <UsydEngineeringReadOnlyCard key={item.id} item={item} scheduled={scheduled} onOpenSubject={setDetailsCode} />;
    const allocation = items.find(old => old.plannerItemId === item.id);
    const movable = allocation && isUsydMovable(allocation);
    return <RoadmapCard key={item.id} item={item} editable={editable} scheduled={scheduled} showReadOnlyDetails issues={editable && item.subject ? issuesFor(item.subject.code) : []}
      prerequisite={editable && item.subject ? getPrerequisiteDisplayState(accessConditions[item.subject.code], issuesFor(item.subject.code), { hasPlan: true, loading: status === "loading" }) : undefined}
      onChoose={item => setActiveChoiceId(item.id)} onOpenSubject={setDetailsCode} onRestoreChoice={state.restoreChoiceSlot}
      onMove={movable ? setMoving : undefined} onSwap={allocation && movable && isCustomPosition(allocation) ? setSwapping : undefined}
      readOnlyChoiceNote="Customize to choose from eligible subjects" />;
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
    <div className={editable ? appUi.plannerToolbarActive : appUi.plannerToolbar}>
      <div><strong>{editable ? "My personal plan" : "Official CUSP roadmap"}</strong><p>{state.planner ? "Your draft is saved automatically on this device." : "Create an editable copy of this official roadmap."}</p></div>
      <div className={appUi.plannerToolbarActions}>
        {!state.planner ? <button className={appUi.primaryButton} type="button" onClick={() => { state.customize(); setOfficial(false); }}>Customize Plan</button> : <>
          <button className={appUi.secondaryButton} type="button" onClick={() => { setOfficial(value => !value); setActiveChoiceId(null); }}>{official ? "View personal plan" : "View official roadmap"}</button>
          <button className={appUi.secondaryButton} type="button" onClick={() => { state.reset(); setOfficial(false); setNotice("Personal plan reset to the official template."); }}>Reset to official plan</button>
          <button className={appUi.textButtonDanger} type="button" onClick={() => { state.clear(); setOfficial(false); setNotice("Personal draft removed."); }}>Remove personal draft</button>
        </>}
      </div>
    </div>
    <p role="status" className="text-sm font-semibold">{editable ? "Editable personal plan" : "Read-only official roadmap"}</p>
    {notice && <p role="status">{notice}</p>}
    {editable && <>
      <section aria-label="Personal plan summary" className="mb-5 rounded-xl border border-solid border-blue-200 bg-blue-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="m-0 text-base font-bold">Personal plan summary</h3>
        <strong className="text-xl text-blue-900">{selectedPoints} / {targetPoints} CP selected</strong></div>
      <progress className="mt-3 h-2 w-full accent-blue-800" aria-label="Selected degree credit points" value={Math.min(selectedPoints, targetPoints)} max={targetPoints} />
      <p className="mb-2 mt-2 text-sm font-semibold">{validation ? `${planWarnings.length} plan warnings${verificationNotes.length ? ` · ${verificationNotes.length} verification notes` : ""}` : "Checking plan requirements…"}</p>
      <p className="text-sm text-slate-600">Selected credit points include unscheduled subjects. Formal completion, unknown rules and conditional requirements still need handbook verification.</p>
      {status === "error" && <p role="alert">Couldn't check access conditions. Your plan is saved; reload to retry.</p>}
      {validation && <details className="mb-4 text-sm"><summary>Review plan warnings ({planWarnings.length}){verificationNotes.length > 0 && ` and verification notes (${verificationNotes.length})`}</summary>
        {planWarnings.map((issue, index) => <p key={`warning:${index}`} data-usyd-plan-warning>{issue.subjectCode && `${issue.subjectCode}: `}{issue.message}</p>)}
        {verificationNotes.length > 0 && <p className="font-semibold">Handbook verification notes</p>}
        {verificationNotes.map((issue, index) => <p key={`note:${index}`} data-usyd-verification-note>{issue.subjectCode && `${issue.subjectCode}: `}{issue.message}</p>)}
      </details>}
      {tableD && <label className="mb-4 block text-sm"><input type="checkbox" checked={dalyell} onChange={event => { setDalyell(event.target.checked); try { localStorage.setItem(`usyd:dalyell:${handbookYear}:${context.degreeCode}`, String(event.target.checked)); } catch { /* Session state remains available. */ } }} /> I am enrolled in the Dalyell Stream</label>}
      {tableD && dalyell && <p className="mb-4 text-sm">Dalyell allocation: {dalyellPoints} / {tableD.requiredCreditPoints ?? 12} CP from Table D. Enrolment and formal completion need verification.</p>}
      {tableD && !dalyell && dalyellPoints > 0 && <p role="alert" className="mb-4 text-sm text-amber-900">Your draft contains Table D allocations. Confirm Dalyell enrolment or replace those selections with subjects eligible for your current requirements.</p>}
      </section>
      {academicStreamMismatch && <p role="status" className="mb-4 text-sm text-slate-600">Your formal specialisations remain selected under {academicStreamMismatch}. Preview that stream to see their progress against its personal plan.</p>}
      {academicComponents.length > 0 ? <div className="mb-5 grid gap-4 lg:grid-cols-2" aria-label="Formal specialisation progress">{academicComponents.map(selection => <UsydEngineeringProgressCard key={selection.reference.code}
        selection={selection} subjects={selectedSubjects} onOpenSubject={setDetailsCode} handbookYear={handbookYear}
        hasConflict={Boolean(validation?.results.some(issue => issue.code === "ANTI_REQUISITE_CONFLICT" && selection.detail?.requirements.some(group => group.items.some(item => item.subject?.code === issue.subjectCode))))} />)}</div>
        : specialisation && !academicStreamMismatch && <p className="mb-5 text-sm text-slate-600">This specialisation is your roadmap focus. Select it in Course Structure to track formal progress.</p>}
    </>}
    <OfficialPlanRoadmap plan={displayed} renderItem={renderCard} renderPeriodActions={editable ? period => {
      const canClear = items.filter(item => period.items.some(position => position.id === item.plannerItemId) && isUsydMovable(item));
      return canClear.length ? <button className={`${plannerUi.action} mb-3`} type="button" onClick={() => { state.clearPeriod(period.id, canClear.map(item => item.plannerItemId)); setNotice("Movable subjects were moved to Unscheduled subjects. Locked activities remain in place."); }}>Clear movable subjects from period</button> : null;
    } : undefined} />
    {editable && state.planner && state.planner.unassignedItems.length > 0 && <section aria-labelledby="usyd-unscheduled-heading" className="mt-6"><h3 id="usyd-unscheduled-heading">Unscheduled subjects</h3>
      <p>Use Move to restore a subject to a period. Clearing a period preserves each subject's allocation.</p>
      <div className={plannerUi.grid}>{state.planner.unassignedItems.map(item => renderCard(plannerItemToStudyPlanItem(item), "Unscheduled"))}</div>
    </section>}
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
    <SubjectDetailsDialog subjectCode={detailsCode} universityCode="USYD" handbookYear={handbookYear} onClose={() => setDetailsCode(null)}
      planIssues={detailsCode ? issuesFor(detailsCode) : []} hasPlan={editable} adaptAccess={normalizeUsydEngineeringAccess} />
    {state.planner && moving && <MoveSubjectDialog key={moving} planner={state.planner} sourceId={moving} universityCode="USYD" handbookYear={handbookYear}
      canMove={isUsydMovable} adaptAccess={normalizeUsydEngineeringAccess} onClose={() => setMoving(null)} onConfirm={(id, target, facts) => state.moveItem(id, target, facts, isUsydMovable)} />}
    {state.planner && swapping && <SwapPositionDialog key={swapping} planner={state.planner} sourceId={swapping} universityCode="USYD" handbookYear={handbookYear}
      adaptAccess={normalizeUsydEngineeringAccess} canSwap={canUsydSwap} onClose={() => setSwapping(null)} onConfirm={(source, target, facts) => state.swapPositions(source, target, facts, canUsydSwap)} />}
  </>;
}
