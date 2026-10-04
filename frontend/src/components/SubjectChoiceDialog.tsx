import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";
import { appUi } from "./ui";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { fetchSubjectAccessConditionsBatch, searchSubjects } from "../api/subjects";
import { validateSubjectCandidate } from "../domain/plannerValidation";
import { collectRequirementPoolContexts, getSubjectSelectionAction } from "../domain/subjectChoiceEligibility";
import type { ChoiceScope } from "../domain/studyPathChoiceScope";
import type { RequirementGroup, StudyPlanItem } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import type { SubjectAccessConditions, SubjectSearchResult } from "../types/subject";
import { AsyncState } from "./AsyncState";
import { useRequirementCandidateSubjects } from "../hooks/useRequirementCandidateSubjects";

interface Props {
  choiceItem: StudyPlanItem | null; universityCode: string; handbookYear: number; scope: ChoiceScope; planner: PlannerState | null;
  onClose: () => void; onOpenSubject: (code: string) => void;
  onSelect: (subject: SubjectSearchResult, componentCode?: string, groupId?: string) => void;
  adaptAccess?: (access: SubjectAccessConditions) => SubjectAccessConditions;
}
const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap((group) => [group, ...flattenGroups(group.children)]);
const groupIdsIn = (group: RequirementGroup) => new Set(flattenGroups([group]).map((candidate) => candidate.id));
const requiredPoints = (group: RequirementGroup) => group.requiredCreditPoints ?? (group.logic === "ALL"
  ? group.items.reduce((total, item) => total + (item.creditPoints ?? item.subject?.creditPoints ?? 0), 0)
  : null);

/** Lists candidate subjects with independent requirement-match, access and selection states. */
const SubjectResults = ({ results, selectable, requiredCore, quotaGroup, planner, choiceItem, accessConditions, componentCode, onOpenSubject, onSelect, recognizeOfficialSubjects }: {
  results: SubjectSearchResult[]; selectable: boolean; requiredCore: boolean; planner: PlannerState | null; choiceItem: StudyPlanItem;
  quotaGroup?: RequirementGroup; accessConditions: Record<string, SubjectAccessConditions>; componentCode?: string; onOpenSubject: Props["onOpenSubject"]; onSelect: Props["onSelect"];
  recognizeOfficialSubjects?: boolean;
}) => {
  const placements = new Map<string, string>();
  planner?.years.forEach((year) => year.periods.forEach((period) => period.items.forEach((item) => {
    if (item.subject && !placements.has(item.subject.code)) placements.set(item.subject.code, `${year.name} ${period.name}`);
  })));
  const planned = new Set([...placements.keys(), ...(planner?.unassignedItems.flatMap((item) => item.subject ? [item.subject.code] : []) ?? [])]);
  const allItems = [...(planner?.years.flatMap((year) => year.periods.flatMap((period) => period.items)) ?? []), ...(planner?.unassignedItems ?? [])];
  const quotaIds = quotaGroup ? groupIdsIn(quotaGroup) : new Set<string>();
  const quotaRequired = quotaGroup ? requiredPoints(quotaGroup) : null;
  const currentBelongsToGroup = Boolean(choiceItem.choiceOrigin?.formalRequirementGroupId && quotaIds.has(choiceItem.choiceOrigin.formalRequirementGroupId));
  const officialCodes = new Set(quotaGroup ? flattenGroups([quotaGroup]).flatMap(group => group.items.flatMap(item => item.subject ? [item.subject.code] : [])) : []);
  const credited = new Set<string>();
  const selectedPoints = quotaGroup ? allItems.reduce((total, item) => {
    if (!item.subject) return total;
    const counts = Boolean(item.choiceOrigin?.formalRequirementGroupId && quotaIds.has(item.choiceOrigin.formalRequirementGroupId))
      || Boolean(recognizeOfficialSubjects && !item.choiceOrigin && officialCodes.has(item.subject.code));
    if (!counts || credited.has(item.subject.code)) return total;
    credited.add(item.subject.code); return total + (item.subject.creditPoints ?? item.creditPoints ?? 0);
  }, 0) : 0;
  const maximumPoints = quotaGroup?.maximumCreditPoints ?? (recognizeOfficialSubjects ? null : quotaRequired);
  return <div className={appUi.subjectResultList}>{results.map((subject) => {
    const access = accessConditions[subject.code];
    const actionableIssues = (planner ? validateSubjectCandidate(planner, choiceItem.id, subject, access) : []).filter((issue) => issue.severity !== "info");
    const duplicate = planned.has(subject.code) && choiceItem.subject?.code !== subject.code;
    const currentPoints = currentBelongsToGroup ? (choiceItem.subject?.creditPoints ?? choiceItem.creditPoints ?? 0) : 0;
    const action = getSubjectSelectionAction({
      belongsToResolvedScope: selectable || requiredCore,
      duplicate,
      maximumCreditPoints: maximumPoints,
      selectedCreditPoints: selectedPoints,
      currentCreditPoints: currentPoints,
      candidateCreditPoints: subject.creditPoints ?? 0,
      replacingCurrent: currentBelongsToGroup && Boolean(choiceItem.subject),
    });
    return <article className={appUi.subjectResult} key={subject.id}><div className={appUi.subjectResultMain}>
      <span className={appUi.subjectResultCode}>{subject.code}</span><h3>{subject.name}</h3><div className={appUi.subjectResultMeta}>
        <span>{subject.creditPoints === null ? "CP not listed" : `${subject.creditPoints} CP`}</span>{(componentCode || quotaGroup) && <span className={appUi.matchBadge}>Requirement match ✓</span>}</div>
      {requiredCore && <p className={appUi.candidateAccess}><strong>Required Core</strong></p>}
      {requiredCore && <p className={placements.has(subject.code) ? appUi.candidateAccessSatisfied : appUi.candidateAccessWarning}>
        {placements.has(subject.code) ? `✓ Planned — ${placements.get(subject.code)}` : planned.has(subject.code) ? "✓ Planned — not yet assigned to a period" : "⚠ Not currently planned"}</p>}
      {!requiredCore && duplicate && <p className={appUi.candidateAccessWarning}>⚠ Already planned elsewhere.</p>}
      {!duplicate && actionableIssues.map((issue, index) => <p className={appUi.candidateAccessWarning} key={`${issue.code}-${index}`}>⚠ {issue.message}</p>)}
    </div><div className={appUi.subjectResultActions}>
      {(access?.hasConditions || subject.prerequisiteStatus === "HAS_CONDITIONS") && <button className={appUi.textButton} type="button" onClick={() => onOpenSubject(subject.code)}>View requirements</button>}
      {action.visible && <button className={appUi.secondaryButton} type="button"
        disabled={action.disabled || subject.creditPoints === null || subject.creditPoints <= 0 || subject.creditPoints > (choiceItem.choiceOrigin?.maximumCreditPoints ?? choiceItem.choiceOrigin?.creditPoints ?? choiceItem.creditPoints ?? Infinity)}
        onClick={() => onSelect(subject, componentCode, quotaGroup?.id)}>
        {action.label}
      </button>}
    </div></article>;
  })}</div>;
};

/** Shows verified component pools or broad search in a keyboard-accessible native dialog. */
export const SubjectChoiceDialog = ({ choiceItem, universityCode, handbookYear, scope, planner, onClose, onOpenSubject, onSelect, adaptAccess }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null); const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState(""); const [externalResults, setExternalResults] = useState<SubjectSearchResult[]>([]);
  const [externalStatus, setExternalStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [accessConditions, setAccessConditions] = useState<Record<string, SubjectAccessConditions>>({}); const [message, setMessage] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [ownership, setOwnership] = useState<Record<string, string>>({});
  const [poolFilter, setPoolFilter] = useState("");
  const sourceGroups = useMemo(() => flattenGroups(scope.groups ?? []).filter(group => group.candidateSources.length), [scope.groups]);
  const sources = useMemo(() => [...new Map(sourceGroups.flatMap(group => group.candidateSources).map(source => [source.id, source])).values()], [sourceGroups]);
  const candidates = useRequirementCandidateSubjects(sources, Boolean(choiceItem && scope.kind === "FORMAL" && scope.union), candidateQuery);
  const pools = useMemo(() => collectRequirementPoolContexts(scope.groups ?? [], new Set(scope.selectableGroupIds ?? []))
    .map((pool) => ({ ...pool, subjects: pool.group.items.flatMap((item) => item.subject ? [{
      ...item.subject, prerequisiteStatus: "UNKNOWN" as const, recommendation: "REQUIREMENT_MATCH" as const,
    }] : []) }))
    .sort((a, b) => Number(b.requiredCore) - Number(a.requiredCore)), [scope.groups, scope.selectableGroupIds]);
  const union = useMemo(() => {
    const rows = new Map<string, { subject: SubjectSearchResult; groups: RequirementGroup[] }>();
    for (const pool of pools.filter(pool => pool.selectable)) for (const subject of pool.subjects) {
      if (candidateQuery && !`${subject.code} ${subject.name}`.toLowerCase().includes(candidateQuery.toLowerCase())) continue;
      const row = rows.get(subject.id) ?? { subject, groups: [] };
      if (!row.groups.some(group => group.id === pool.quotaGroup.id)) row.groups.push(pool.quotaGroup);
      rows.set(subject.id, row);
    }
    for (const subject of candidates.results) {
      const row = rows.get(subject.id) ?? { subject: { ...subject, prerequisiteStatus: "UNKNOWN" as const, recommendation: "REQUIREMENT_MATCH" as const }, groups: [] };
      for (const group of sourceGroups) if (group.candidateSources.some(source => subject.eligibilitySources.some(eligible => eligible.id === source.id)) && !row.groups.some(old => old.id === group.id)) row.groups.push(group);
      rows.set(subject.id, row);
    }
    return [...rows.values()].sort((a, b) => a.subject.code.localeCompare(b.subject.code));
  }, [pools, candidates.results, sourceGroups, candidateQuery]);
  const codes = useMemo(() => [...new Set([...pools.flatMap((pool) => pool.subjects.map((subject) => subject.code)), ...externalResults.map((subject) => subject.code), ...candidates.results.map(subject => subject.code)])].sort(), [externalResults, pools, candidates.results]);
  const codeKey = codes.join("|");
  useEffect(() => {
    if (import.meta.env.DEV && choiceItem?.choiceOrigin?.formalComponentId && scope.componentId
      && choiceItem.choiceOrigin.formalComponentId !== scope.componentId) {
      console.error("Roadmap choice provenance mismatch: the active slot and candidate requirement belong to different components.");
    }
  }, [choiceItem, scope.componentId]);
  useEffect(() => {
    if (!choiceItem) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockScroll = lockPageScroll();
    return () => { unlockScroll(); trigger?.focus(); };
  }, [choiceItem?.id]);
  useEffect(() => { const dialog = dialogRef.current; if (choiceItem && dialog && !dialog.open) dialog.showModal(); if (!choiceItem && dialog?.open) dialog.close(); }, [choiceItem]);
  useEffect(() => {
    if (!choiceItem || codes.length === 0) { setAccessConditions({}); return; } const controller = new AbortController();
    void fetchSubjectAccessConditionsBatch(codes, universityCode, handbookYear, controller.signal).then(response => {
      if (!controller.signal.aborted) setAccessConditions(adaptAccess ? Object.fromEntries(Object.entries(response).map(([code, access]) => [code, adaptAccess(access)])) : response);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setAccessConditions({});
    }); return () => controller.abort();
  }, [choiceItem, codeKey, handbookYear, universityCode, adaptAccess]);
  useEffect(() => { if (!choiceItem) return; setQuery(""); setCandidateQuery(""); setPoolFilter(""); setOwnership({}); setExternalResults([]); setMessage(""); setExternalStatus("idle"); return () => requestRef.current?.abort(); }, [choiceItem?.id]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault(); const normalized = query.trim(); if (normalized.length < 2) { setMessage("Enter at least two characters."); return; }
    const controller = new AbortController(); requestRef.current = controller; setMessage(""); setExternalStatus("loading");
    void searchSubjects({ universityCode, handbookYear, query: normalized, limit: 30, signal: controller.signal }).then((subjects) => {
      setExternalResults(subjects); setExternalStatus("ready");
    }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setExternalStatus("error"); });
  };
  if (!choiceItem) return <dialog onKeyDown={trapDialogFocus} className={appUi.subjectDialog} ref={dialogRef} />;
  const resultProps = { planner, choiceItem, accessConditions, onOpenSubject, onSelect };
  const progressText = (group: RequirementGroup) => {
    const required = requiredPoints(group); if (required === null) return group.logic.replaceAll("_", " ");
    const ids = groupIdsIn(group);
    const items = [...(planner?.years.flatMap((year) => year.periods.flatMap((period) => period.items)) ?? []), ...(planner?.unassignedItems ?? [])];
    const points = items.reduce((total, item) => !item.subject ? total : total + (item.choiceOrigin?.formalRequirementGroupId && ids.has(item.choiceOrigin.formalRequirementGroupId) ? (item.subject.creditPoints ?? item.creditPoints ?? 0) : 0), 0);
    return `${Math.min(points, required)} / ${required} CP${points >= required ? " · Complete" : ` · ${required - points} CP remaining`}`;
  };
  return <dialog onKeyDown={trapDialogFocus} className={appUi.subjectDialog} ref={dialogRef} aria-labelledby="subject-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={(event: MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) onClose(); }}><div className={appUi.subjectDialogPanel}>
    <header className={appUi.subjectDialogHeader}><div><p className={appUi.eyebrow}>Fill choice slot</p><h2 id="subject-dialog-title">Choose a subject</h2><p>{choiceItem.choiceOrigin?.title ?? choiceItem.title}</p></div>
      <button className={appUi.dialogClose} type="button" aria-label="Close subject selector" onClick={onClose}>×</button></header>
    <div className={scope.kind === "FORMAL" ? appUi.eligibilityNoteMatched : appUi.eligibilityNote}>{scope.kind === "FORMAL" ? <><strong>From: {scope.label}</strong><br />Requirement match and access conditions are evaluated separately.</>
      : scope.kind === "BROAD" ? <><strong>Broad choice: {scope.label}</strong><br />Search results are not automatically verified to count.</> : <>{scope.label ?? "No exact requirement mapping is available. Choose a pathway or component first; missing mappings need handbook verification."}</>}</div>
    {scope.limitation && <p className={appUi.candidateAccessWarning}>{scope.limitation}</p>}
    {scope.union && scope.kind === "FORMAL" && <>
      {sources.length > 0 && <ul className="mx-6 my-4 pl-4 text-sm" aria-label="Eligible candidate sources">{sources.map(source => <li key={source.id}>{source.title}: {source.candidateCount.toLocaleString()} subjects</li>)}</ul>}
      {(scope.groups?.length ?? 0) > 1 && <label className="mx-6 mb-3 grid gap-2 text-sm">Eligible pool<select value={poolFilter} onChange={event => setPoolFilter(event.target.value)}>
        <option value="">All eligible pools</option>{scope.groups?.map(group => <option value={group.id} key={group.id}>{group.title}</option>)}
      </select></label>}
      <form className={appUi.subjectSearch} onSubmit={event => { event.preventDefault(); setCandidateQuery(query.trim()); }}>
        <label htmlFor="eligible-subject-query">Search eligible subjects by code or name</label>
        <div><input id="eligible-subject-query" type="search" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit" className={appUi.primaryButton}>Search eligible subjects</button></div>
      </form>
      {candidates.status === "loading" && <AsyncState kind="loading" label="Loading eligible subjects" />}
      {candidates.status === "error" && <AsyncState kind="error" label="Couldn't load eligible subjects." onRetry={candidates.retry} />}
      <div aria-live="polite" className="grid gap-3 px-6 pb-4">{union.filter(row => !poolFilter || row.groups.some(group => group.id === poolFilter)).map(({ subject, groups }) => {
        const group = groups.find(group => group.id === ownership[subject.id]) ?? groups.find(group => group.id === poolFilter) ?? groups[0];
        return <section data-candidate-code={subject.code} key={subject.id}>
          {groups.length > 1 ? <label className="block text-sm">Credit {subject.code} to
            <select className="block max-w-full" value={group.id} onChange={event => setOwnership(value => ({ ...value, [subject.id]: event.target.value }))}>
              {groups.map(group => <option value={group.id} key={group.id}>{group.title}</option>)}
            </select></label> : <p className="mb-1 text-sm text-slate-600">Eligible for: {group.title}</p>}
          <SubjectResults {...resultProps} results={[subject]} selectable requiredCore={false} quotaGroup={group} componentCode={scope.componentCodesByGroup?.[group.id]} recognizeOfficialSubjects />
        </section>;
      })}</div>
      {union.filter(row => !poolFilter || row.groups.some(group => group.id === poolFilter)).length === 0 && candidates.status !== "loading" && candidates.status !== "error" && <AsyncState kind="empty" label="No eligible subjects match this search." />}
      {candidates.pageError && <p role="alert">{candidates.pageError}</p>}
      <div className="flex flex-wrap gap-2 px-6 pb-4">{Object.values(candidates.pages).map(page => page.pagination.page < page.pagination.totalPages && <button type="button" className={appUi.secondaryButton} disabled={page.loadingMore}
        key={page.candidateSource.id} onClick={() => candidates.loadMore(page.candidateSource.id)}>Load more from {page.candidateSource.title} ({page.pagination.page} of {page.pagination.totalPages})</button>)}</div>
    </>}
    <div className={appUi.subjectResultsGrouped} aria-live="polite">{!scope.union && scope.kind === "FORMAL" && pools.length === 0 && <AsyncState kind="empty" label="No verified subject list is available for this requirement. This requirement cannot currently be verified." />}
      {!scope.union && pools.map(({ group, quotaGroup, subjects, selectable, requiredCore }) => <section className={selectable ? appUi.subjectPoolSelectable : appUi.subjectPoolContext} key={group.id}>
        <header><div><span>{quotaGroup.title ?? group.title ?? "Requirement subjects"}</span><strong>{selectable ? "Options" : requiredCore ? "Core" : "Context"}</strong></div>
          <p>{progressText(quotaGroup)}</p></header>
        {group.items.some((item) => item.itemType === "SUBJECT" && !item.subject) && <p className={appUi.candidateAccessWarning}>
          Data unavailable for {requiredCore ? "required subject" : "option subject"} {group.items.filter((item) => item.itemType === "SUBJECT" && !item.subject).map((item) => item.rawCode ?? "Unknown code").join(", ")}. This requirement cannot currently be verified.
        </p>}
        <SubjectResults {...resultProps} results={subjects} selectable={selectable} requiredCore={requiredCore} quotaGroup={quotaGroup} componentCode={scope.componentCode} /></section>)}</div>
    {scope.kind === "BROAD" && <details className={appUi.externalSubjectSearch} open><summary>Search electives</summary><p>Results outside this requirement are not verified to count.</p>
      <form className={appUi.subjectSearch} onSubmit={submitSearch}><label htmlFor="subject-query">Search by subject code or name</label><div><input id="subject-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className={appUi.primaryButton} type="submit">Search</button></div>{message && <p className={appUi.fieldError} role="alert">{message}</p>}</form>
      <div aria-live="polite">{externalStatus === "loading" && <AsyncState kind="loading" label="Searching subjects" />}{externalStatus === "error" && <AsyncState kind="error" label="We couldn't search subjects." />}
        {externalStatus === "ready" && externalResults.length === 0 && <AsyncState kind="empty" label="No matching subjects were found." />}{externalStatus === "ready" && <SubjectResults {...resultProps} results={externalResults} selectable={scope.kind === "BROAD"} requiredCore={false} quotaGroup={scope.kind === "BROAD" ? scope.groups?.[0] : undefined} />}</div></details>
    }</div></dialog>;
};
