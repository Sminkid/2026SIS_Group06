import { useEffect, useRef, useState } from "react";
import { proposeMove } from "../domain/plannerMove";
import { plannerItems, type SwapFacts } from "../domain/plannerSwap";
import { useSwapFacts } from "../hooks/useSwapFacts";
import type { PlannerItem, PlannerState } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";
import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";
import { appUi } from "./ui";

export function MoveSubjectDialog({ planner, sourceId, universityCode, handbookYear, canMove, adaptAccess, onClose, onConfirm }: {
  planner: PlannerState; sourceId: string; universityCode: string; handbookYear: number;
  canMove: (item: PlannerItem) => boolean; adaptAccess?: (access: SubjectAccessConditions) => SubjectAccessConditions;
  onClose: () => void; onConfirm: (id: string, period: string | null, facts: SwapFacts) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null); const [target, setTarget] = useState("");
  const source = [...plannerItems(planner), ...planner.unassignedItems].find(item => item.plannerItemId === sourceId);
  const { facts, loading } = useSwapFacts(planner, universityCode, handbookYear, adaptAccess, true, source?.subject ? [source.subject.code] : []);
  const proposal = target ? proposeMove(planner, sourceId, target === "HOLDING" ? null : target, facts, canMove) : null;
  useEffect(() => { const trigger = document.activeElement as HTMLElement; const unlock = lockPageScroll();
    ref.current?.showModal(); return () => { ref.current?.close(); unlock(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  const currentPeriod = planner.years.flatMap(year => year.periods.map(period => ({ year, period })))
    .find(({ period }) => period.items.some(item => item.plannerItemId === sourceId));
  const currentValue = currentPeriod?.period.plannerPeriodId ?? "HOLDING";
  const currentLabel = currentPeriod ? `${currentPeriod.year.name} · ${currentPeriod.period.name}` : "Unscheduled subjects";
  const points = source?.subject?.creditPoints ?? source?.creditPoints;
  return <dialog className={appUi.moveDialog} ref={ref} onKeyDown={trapDialogFocus} aria-labelledby="move-heading" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className={appUi.moveDialogPanel}>
    <header className={appUi.subjectDialogHeader}><div><p className={appUi.eyebrow}>Reschedule subject</p><h2 id="move-heading">Move subject</h2>
      <p>Choose the study period this subject should move to.</p></div>
      <button className={appUi.dialogClose} type="button" aria-label="Cancel move" onClick={onClose}>×</button></header>
    <div className={appUi.moveDialogBody}>
      <div className={appUi.moveSubject}>{source?.subject?.code && <span>{source.subject.code}</span>}
        <strong>{source?.subject?.name ?? source?.title}</strong>
        <small>Currently in {currentLabel}{points != null ? ` · ${points} CP` : ""}</small></div>
      <label className={appUi.moveField}>Destination period<select value={target} onChange={event => setTarget(event.target.value)}>
        <option value="">Choose a period</option>
        {planner.years.flatMap(year => year.periods.map(period => <option value={period.plannerPeriodId} key={period.plannerPeriodId}>
          {year.name} · {period.name}{period.plannerPeriodId === currentValue ? " (current)" : ""}</option>))}
        <option value="HOLDING">Unscheduled subjects{currentValue === "HOLDING" ? " (current)" : ""}</option>
      </select></label>
      {loading && <p role="status" className={appUi.moveChecking}>Checking enrolment and period availability…</p>}
      {!loading && proposal && <div className={appUi.moveResults} aria-live="polite">{proposal.errors.map(error => <p role="alert" className={appUi.moveError} key={error}>{error}</p>)}
        {proposal.warnings.map(warning => <p className={appUi.moveWarning} key={warning}>{warning}</p>)}</div>}
    </div>
    <footer className={appUi.moveDialogFooter}>
      <button className={appUi.secondaryButton} type="button" onClick={onClose}>Cancel</button>
      <button className={appUi.primaryButton} type="button" disabled={loading || !proposal || Boolean(proposal.errors.length)} onClick={() => { onConfirm(sourceId, target === "HOLDING" ? null : target, facts); onClose(); }}>Confirm move</button>
    </footer>
  </div></dialog>;
}
