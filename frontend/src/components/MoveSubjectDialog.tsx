import { useEffect, useRef, useState } from "react";
import { proposeMove } from "../domain/plannerMove";
import { plannerItems, type SwapFacts } from "../domain/plannerSwap";
import { useSwapFacts } from "../hooks/useSwapFacts";
import type { PlannerItem, PlannerState } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";
import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";
import { plannerUi as ui } from "./planner/ui";

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
  return <dialog className={ui.dialog} ref={ref} onKeyDown={trapDialogFocus} aria-labelledby="move-heading" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="max-h-[88dvh] overflow-y-auto p-5">
      <header className="flex justify-between gap-3"><h2 id="move-heading" className={ui.title}>Move subject</h2><button type="button" className={ui.action} onClick={onClose}>Cancel move</button></header>
      <p>{source?.subject?.code} · {source?.title}</p>
      <label className="grid gap-2">Destination period<select className="max-w-full p-2" value={target} onChange={event => setTarget(event.target.value)}>
        <option value="">Choose a period</option>
        {planner.years.flatMap(year => year.periods.map(period => <option value={period.plannerPeriodId} key={period.plannerPeriodId}>{year.name} · {period.name}</option>))}
        <option value="HOLDING">Unscheduled subjects</option>
      </select></label>
      {loading && <p role="status">Checking enrolment and period availability…</p>}
      {!loading && proposal && <div aria-live="polite">{proposal.errors.map(error => <p role="alert" className={ui.error} key={error}>{error}</p>)}
        {proposal.warnings.map(warning => <p className={ui.warning} key={warning}>{warning}</p>)}</div>}
      <button className={ui.primary} type="button" disabled={loading || !proposal || Boolean(proposal.errors.length)} onClick={() => { onConfirm(sourceId, target === "HOLDING" ? null : target, facts); onClose(); }}>Confirm move</button>
    </div>
  </dialog>;
}
