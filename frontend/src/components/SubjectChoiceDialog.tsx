import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { fetchSubjectAccessConditionsBatch, searchSubjects } from "../api/subjects";
import { validateSubjectCandidate } from "../domain/plannerValidation";
import type { ChoiceScope } from "../domain/studyPathChoiceScope";
import type { RequirementGroup, StudyPlanItem } from "../types/handbook";
import type { PlannerState } from "../types/planner";
import type { SubjectAccessConditions, SubjectSearchResult } from "../types/subject";
import { AsyncState } from "./AsyncState";

interface Props {
  choiceItem: StudyPlanItem | null; universityCode: string; handbookYear: number; scope: ChoiceScope; planner: PlannerState | null;
  onClose: () => void; onOpenSubject: (code: string) => void;
  onSelect: (subject: SubjectSearchResult, componentCode?: string, groupId?: string) => void;
}
interface SubjectPool { group: RequirementGroup; quotaGroup: RequirementGroup; subjects: SubjectSearchResult[]; selectable: boolean; requiredCore: boolean }
const collectPools = (
  groups: RequirementGroup[], selectableIds: Set<string>,
  inheritedSelectable?: RequirementGroup, inheritedCore?: RequirementGroup,
): SubjectPool[] => groups.flatMap((group) => {
  const selectableGroup = inheritedSelectable ?? (selectableIds.has(group.id) ? group : undefined);
  const coreGroup = selectableGroup ? undefined : inheritedCore ?? (group.logic === "ALL" ? group : undefined);
  const subjects = group.items.flatMap((item) => item.subject ? [{ ...item.subject, prerequisiteStatus: "UNKNOWN" as const, recommendation: "REQUIREMENT_MATCH" as const }] : []);
  return [...(subjects.length ? [{ group, quotaGroup: selectableGroup ?? coreGroup ?? group, subjects, selectable: Boolean(selectableGroup), requiredCore: Boolean(coreGroup) }] : []),
    ...collectPools(group.children, selectableIds, selectableGroup, coreGroup)];
});

const flattenGroups = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap((group) => [group, ...flattenGroups(group.children)]);
const subjectCodesIn = (group: RequirementGroup) => new Set(flattenGroups([group]).flatMap((candidate) =>
  candidate.items.flatMap((item) => item.subject ? [item.subject.code] : [])));
const groupIdsIn = (group: RequirementGroup) => new Set(flattenGroups([group]).map((candidate) => candidate.id));
const requiredPoints = (group: RequirementGroup) => group.requiredCreditPoints ?? (group.logic === "ALL"
  ? group.items.reduce((total, item) => total + (item.creditPoints ?? item.subject?.creditPoints ?? 0), 0)
  : null);

const SubjectResults = ({ results, selectable, requiredCore, quotaGroup, planner, choiceItem, accessConditions, componentCode, onOpenSubject, onSelect }: {
  results: SubjectSearchResult[]; selectable: boolean; requiredCore: boolean; planner: PlannerState | null; choiceItem: StudyPlanItem;
  quotaGroup?: RequirementGroup; accessConditions: Record<string, SubjectAccessConditions>; componentCode?: string; onOpenSubject: Props["onOpenSubject"]; onSelect: Props["onSelect"];
}) => {
  const placements = new Map<string, string>();
  planner?.years.forEach((year) => year.periods.forEach((period) => period.items.forEach((item) => {
    if (item.subject && !placements.has(item.subject.code)) placements.set(item.subject.code, `${year.name} ${period.name}`);
  })));
  const planned = new Set([...placements.keys(), ...(planner?.unassignedItems.flatMap((item) => item.subject ? [item.subject.code] : []) ?? [])]);
  const allItems = [...(planner?.years.flatMap((year) => year.periods.flatMap((period) => period.items)) ?? []), ...(planner?.unassignedItems ?? [])];
  const quotaCodes = quotaGroup ? subjectCodesIn(quotaGroup) : new Set<string>();
  const quotaIds = quotaGroup ? groupIdsIn(quotaGroup) : new Set<string>();
  const quotaRequired = quotaGroup ? requiredPoints(quotaGroup) : null;
  const currentBelongsToGroup = Boolean(choiceItem.choiceOrigin?.formalRequirementGroupId && quotaIds.has(choiceItem.choiceOrigin.formalRequirementGroupId));
  const selectedPoints = quotaGroup ? allItems.reduce((total, item) => {
    if (!item.subject) return total;
    if (requiredCore) return total + (quotaCodes.has(item.subject.code) ? (item.subject.creditPoints ?? item.creditPoints ?? 0) : 0);
    return total + (item.choiceOrigin?.formalRequirementGroupId && quotaIds.has(item.choiceOrigin.formalRequirementGroupId)
      ? (item.subject.creditPoints ?? item.creditPoints ?? 0) : 0);
  }, 0) : 0;
  const maximumPoints = quotaGroup?.maximumCreditPoints ?? quotaRequired;
  const requirementComplete = maximumPoints !== null && selectedPoints >= maximumPoints;
  return <div className="subject-result-list">{results.map((subject) => {
    const access = accessConditions[subject.code];
    const actionableIssues = (planner ? validateSubjectCandidate(planner, choiceItem.id, subject, access) : []).filter((issue) => issue.severity !== "info");
    const duplicate = planned.has(subject.code) && choiceItem.subject?.code !== subject.code;
    const currentPoints = currentBelongsToGroup ? (choiceItem.subject?.creditPoints ?? choiceItem.creditPoints ?? 0) : 0;
    const wouldExceed = maximumPoints !== null && selectedPoints - currentPoints + (subject.creditPoints ?? 0) > maximumPoints;
    return <article className="subject-result" key={subject.id}><div className="subject-result__main">
      <span className="subject-result__code">{subject.code}</span><h3>{subject.name}</h3><div className="subject-result__meta">
        <span>{subject.creditPoints === null ? "CP not listed" : `${subject.creditPoints} CP`}</span>{(componentCode || quotaGroup) && <span className="match-badge">Requirement match ✓</span>}</div>
      {requiredCore && <p className="candidate-access"><strong>Required Core</strong></p>}
      {requiredCore && <p className={`candidate-access candidate-access--${placements.has(subject.code) ? "satisfied" : "warning"}`}>
        {placements.has(subject.code) ? `✓ Planned — ${placements.get(subject.code)}` : planned.has(subject.code) ? "✓ Planned — not yet assigned to a period" : "⚠ Not currently planned"}</p>}
      {!requiredCore && duplicate && <p className="candidate-access candidate-access--warning">⚠ Already planned elsewhere.</p>}
      {!duplicate && actionableIssues.map((issue, index) => <p className="candidate-access candidate-access--warning" key={`${issue.code}-${index}`}>⚠ {issue.message}</p>)}
    </div><div className="subject-result__actions">
      {(access?.hasConditions || subject.prerequisiteStatus === "HAS_CONDITIONS") && <button className="text-button" type="button" onClick={() => onOpenSubject(subject.code)}>View requirements</button>}
      {(selectable || requiredCore) && <button className="secondary-button" type="button"
        disabled={duplicate || wouldExceed || (requirementComplete && !currentBelongsToGroup)}
        onClick={() => onSelect(subject, componentCode, quotaGroup?.id)}>
        {requirementComplete ? currentBelongsToGroup ? "Replace current option" : "Requirement already satisfied" : "Select"}
      </button>}
    </div></article>;
  })}</div>;
};

export const SubjectChoiceDialog = ({ choiceItem, universityCode, handbookYear, scope, planner, onClose, onOpenSubject, onSelect }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null); const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState(""); const [externalResults, setExternalResults] = useState<SubjectSearchResult[]>([]);
  const [externalStatus, setExternalStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [accessConditions, setAccessConditions] = useState<Record<string, SubjectAccessConditions>>({}); const [message, setMessage] = useState("");
  const pools = useMemo(() => collectPools(scope.groups ?? [], new Set(scope.selectableGroupIds ?? [])).sort((a, b) => Number(b.selectable) - Number(a.selectable)), [scope.groups, scope.selectableGroupIds]);
  const codes = useMemo(() => [...new Set([...pools.flatMap((pool) => pool.subjects.map((subject) => subject.code)), ...externalResults.map((subject) => subject.code)])].sort(), [externalResults, pools]);
  const codeKey = codes.join("|");
  useEffect(() => {
    if (import.meta.env.DEV && choiceItem?.choiceOrigin?.formalComponentId && scope.componentId
      && choiceItem.choiceOrigin.formalComponentId !== scope.componentId) {
      console.error("Roadmap choice provenance mismatch: the active slot and candidate requirement belong to different components.");
    }
  }, [choiceItem, scope.componentId]);
  useEffect(() => { const dialog = dialogRef.current; if (choiceItem && dialog && !dialog.open) dialog.showModal(); if (!choiceItem && dialog?.open) dialog.close(); }, [choiceItem]);
  useEffect(() => {
    if (!choiceItem || codes.length === 0) { setAccessConditions({}); return; } const controller = new AbortController();
    void fetchSubjectAccessConditionsBatch(codes, universityCode, handbookYear, controller.signal).then(setAccessConditions).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setAccessConditions({});
    }); return () => controller.abort();
  }, [choiceItem, codeKey, handbookYear, universityCode]);
  useEffect(() => { if (!choiceItem) return; setQuery(""); setExternalResults([]); setMessage(""); setExternalStatus("idle"); return () => requestRef.current?.abort(); }, [choiceItem]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault(); const normalized = query.trim(); if (normalized.length < 2) { setMessage("Enter at least two characters."); return; }
    const controller = new AbortController(); requestRef.current = controller; setMessage(""); setExternalStatus("loading");
    void searchSubjects({ universityCode, handbookYear, query: normalized, limit: 30, signal: controller.signal }).then((subjects) => {
      setExternalResults(subjects); setExternalStatus("ready");
    }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setExternalStatus("error"); });
  };
  if (!choiceItem) return <dialog className="subject-dialog" ref={dialogRef} />;
  const resultProps = { planner, choiceItem, accessConditions, onOpenSubject, onSelect };
  const progressText = (group: RequirementGroup, core: boolean) => {
    const required = requiredPoints(group); if (required === null) return group.logic.replaceAll("_", " ");
    const codes = subjectCodesIn(group); const ids = groupIdsIn(group);
    const items = [...(planner?.years.flatMap((year) => year.periods.flatMap((period) => period.items)) ?? []), ...(planner?.unassignedItems ?? [])];
    const points = items.reduce((total, item) => !item.subject ? total : total + (core
      ? codes.has(item.subject.code) ? (item.subject.creditPoints ?? item.creditPoints ?? 0) : 0
      : item.choiceOrigin?.formalRequirementGroupId && ids.has(item.choiceOrigin.formalRequirementGroupId) ? (item.subject.creditPoints ?? item.creditPoints ?? 0) : 0), 0);
    return `${Math.min(points, required)} / ${required} CP${points >= required ? " · Complete" : ` · ${required - points} CP remaining`}`;
  };
  return <dialog className="subject-dialog" ref={dialogRef} aria-labelledby="subject-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={(event: MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) onClose(); }}><div className="subject-dialog__panel">
    <header className="subject-dialog__header"><div><p className="eyebrow">Fill choice slot</p><h2 id="subject-dialog-title">Choose a subject</h2><p>{choiceItem.choiceOrigin?.title ?? choiceItem.title}</p></div>
      <button className="dialog-close" type="button" aria-label="Close subject selector" onClick={onClose}>×</button></header>
    <div className={`eligibility-note${scope.kind === "FORMAL" ? " eligibility-note--matched" : ""}`}>{scope.kind === "FORMAL" ? <><strong>From: {scope.label}</strong><br />Requirement match and access conditions are evaluated separately.</>
      : scope.kind === "BROAD" ? <><strong>Broad choice: {scope.label}</strong><br />Search results are not automatically verified to count.</> : <>Use the unverified external search for this roadmap slot.</>}</div>
    <div className="subject-results subject-results--grouped" aria-live="polite">{scope.kind === "FORMAL" && pools.length === 0 && <AsyncState kind="empty" label="No verified subject list is available for this requirement. You may search other subjects, but eligibility must be confirmed." />}
      {pools.map(({ group, quotaGroup, subjects, selectable, requiredCore }) => <section className={`subject-pool${selectable ? " subject-pool--selectable" : " subject-pool--context"}`} key={group.id}>
        <header><div><span>{quotaGroup.title ?? group.title ?? "Requirement subjects"}</span><strong>{selectable ? "Options" : requiredCore ? "Core" : "Context"}</strong></div>
          <p>{progressText(quotaGroup, requiredCore)}</p></header>
        <SubjectResults {...resultProps} results={subjects} selectable={selectable} requiredCore={requiredCore} quotaGroup={quotaGroup} componentCode={scope.componentCode} /></section>)}</div>
    <details className="external-subject-search" open={scope.kind !== "FORMAL"}><summary>Can't find the subject? Search outside this requirement</summary><p>Results outside this requirement are not verified to count.</p>
      <form className="subject-search" onSubmit={submitSearch}><label htmlFor="subject-query">Search by subject code or name</label><div><input id="subject-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="primary-button" type="submit">Search</button></div>{message && <p className="field-error" role="alert">{message}</p>}</form>
      <div aria-live="polite">{externalStatus === "loading" && <AsyncState kind="loading" label="Searching subjects" />}{externalStatus === "error" && <AsyncState kind="error" label="We couldn't search subjects." />}
        {externalStatus === "ready" && externalResults.length === 0 && <AsyncState kind="empty" label="No matching subjects were found." />}{externalStatus === "ready" && <SubjectResults {...resultProps} results={externalResults} selectable requiredCore={false} quotaGroup={scope.groups?.[0]} />}</div></details>
  </div></dialog>;
};
