import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";
import { cn } from "./ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { plannerItems, proposeSwap, type SwapFacts } from "../domain/plannerSwap";
import { getValidSwapTargets, type SwapTargetSession } from "../domain/swapTargets";
import { useSwapFacts } from "../hooks/useSwapFacts";
import type { PlannerItem, PlannerState } from "../types/planner";
import type { SubjectAccessConditions } from "../types/subject";
import { plannerUi as ui } from "./planner/ui";

/** Renders compact selectable rows grouped by nonempty schedule sessions. */
function SwapTargetList({ sessions, selectedId, onSelect }: { sessions: SwapTargetSession[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="swap-targets space-y-4">{sessions.map(session => <section key={session.id} className="swap-target-session">
    <h3 className="mb-2 mt-0 text-sm font-bold">{session.label}</h3>
    <div className="grid gap-2">{session.targets.map(({ item, label }) => <button key={item.plannerItemId} type="button"
      className={cn("swap-target grid w-full min-w-0 cursor-pointer gap-1 rounded border border-solid p-3 text-left text-sm [overflow-wrap:anywhere]", selectedId === item.plannerItemId ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white hover:bg-slate-50")}
      aria-pressed={selectedId === item.plannerItemId} onClick={() => onSelect(item.plannerItemId)}>
      <strong>{item.subject?.name ?? item.title}</strong>
      <span className="text-xs text-slate-600">{label} · {item.subject?.creditPoints ?? item.creditPoints} CP</span>
      <span className="text-xs text-slate-600">Counts toward: {item.choiceOrigin?.sourceLabel ?? item.choiceOrigin?.title} {item.choiceOrigin?.allocatedGroupLabel}</span>
    </button>)}</div>
  </section>)}</div>;
}

/**
 * Reviews schedule movement while keeping requirement ownership intact.
 * Only valid user-controlled targets are shown; confirmation still validates
 * the latest stored plan through the existing mutation.
 */
export const SwapPositionDialog = ({ planner, sourceId, universityCode, handbookYear, onClose, onConfirm, adaptAccess, canSwap }: {
  planner: PlannerState; sourceId: string; universityCode: string; handbookYear: number;
  onClose: () => void; onConfirm: (source: string, target: string, facts: SwapFacts) => void;
  adaptAccess?: (access: SubjectAccessConditions) => SubjectAccessConditions;
  canSwap?: (item: PlannerItem) => boolean;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const [targetId, setTargetId] = useState("");
  const { facts, loading } = useSwapFacts(planner, universityCode, handbookYear, adaptAccess);
  const sessions = useMemo(() => loading ? [] : getValidSwapTargets(planner, sourceId, facts)
    .map(session => ({ ...session, targets: session.targets.filter(target => !canSwap || canSwap(target.item)) })).filter(session => session.targets.length),
  [planner, sourceId, facts, loading, canSwap]);
  const source = plannerItems(planner).find(item => item.plannerItemId === sourceId);
  const sourcePeriod = planner.years.flatMap(year => year.periods.map(period => ({ ...period, label: `${year.name} ${period.name}` }))).find(period => period.items.some(item => item.plannerItemId === sourceId));
  const target = sessions.flatMap(session => session.targets).find(({ item }) => item.plannerItemId === targetId);
  const proposal = target ? proposeSwap(planner, sourceId, targetId, facts) : null;
  useEffect(() => {
    const dialog = ref.current;
    const unlockScroll = lockPageScroll();
    dialog?.showModal();
    return () => {
      unlockScroll();
      // Close the native modal before restoring focus, including Strict Mode cleanup.
      dialog?.close();
      const trigger = returnFocus.current;
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector<HTMLButtonElement>(`[data-planner-item-id="${CSS.escape(sourceId)}"] button[aria-label="Swap position"]`)?.focus();
    };
  }, []);
  return <dialog onKeyDown={trapDialogFocus} ref={ref} className={cn("swap-dialog", ui.dialog)} aria-labelledby="swap-heading" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="flex max-h-[88dvh] flex-col">
      <header className={ui.header}>
        <div className="flex items-start justify-between gap-3"><h2 id="swap-heading" className={ui.title}>Swap position</h2><button type="button" className={cn(ui.action, "shrink-0")} onClick={onClose}>Cancel swap</button></div>
        <p className="mb-1 mt-2 line-clamp-2 text-sm font-semibold">{source?.subject?.name} · {sourcePeriod?.label}</p>
        <p className={ui.note}>Each subject keeps its requirement allocation.</p>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {loading ? <p role="status" className={ui.note}>Checking compatible positions…</p> : sessions.length ? <SwapTargetList sessions={sessions} selectedId={targetId} onSelect={setTargetId} />
          : <p role="status" className={ui.note}>No compatible positions are available. Fixed subjects, placements and positions that fail CP or enrolment checks are excluded.</p>}
        {proposal && <details className="mt-4 text-sm text-amber-900"><summary className="cursor-pointer">Verification warnings ({proposal.warnings.length})</summary>
          {proposal.warnings.map(warning => <p className="my-2" key={warning}>{warning}</p>)}
        </details>}
      </div>
      <footer className="shrink-0 border-0 border-t border-solid border-slate-200 p-4">
        {target && <p className="mb-3 mt-0 line-clamp-2 text-sm" aria-live="polite">{sourcePeriod?.label} ↔ {target.label} · {target.item.subject?.name ?? "Empty position"}</p>}
        <button className={ui.primary} type="button" disabled={loading || !proposal || Boolean(proposal.errors.length)} onClick={() => { if (target && proposal && !proposal.errors.length) { onConfirm(sourceId, targetId, facts); onClose(); } }}>Confirm swap</button>
      </footer>
    </div>
  </dialog>;
};
