import { useEffect, useRef, useState } from "react";
import { fetchSubjectAccessConditionsBatch, fetchSubjectDetail } from "../api/subjects";
import { isCustomPosition, plannerItems, proposeSwap, type SwapFacts } from "../domain/plannerSwap";
import type { PlannerState } from "../types/planner";
import { offeredPeriodsFrom } from "../domain/subjectOfferings";

export const SwapPositionDialog = ({ planner, sourceId, universityCode, handbookYear, onClose, onConfirm }: {
  planner: PlannerState; sourceId: string; universityCode: string; handbookYear: number;
  onClose: () => void; onConfirm: (source: string, target: string, facts: SwapFacts) => void;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [targetId, setTargetId] = useState("");
  const [facts, setFacts] = useState<SwapFacts>({ accessConditions: {} });
  const [loading, setLoading] = useState(true);
  const positions = planner.years.flatMap((year) => year.periods.flatMap((period) => period.items.map((item) => ({ item, label: `${year.name} ${period.name}` }))));
  const source = positions.find(({ item }) => item.plannerItemId === sourceId);
  const target = positions.find(({ item }) => item.plannerItemId === targetId);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => { document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const codes = [...new Set(plannerItems(planner).flatMap((item) => item.subject ? [item.subject.code] : []))];
    const movedCodes = [source?.item.subject?.code, target?.item.subject?.code].filter((code): code is string => Boolean(code));
    void Promise.all([
      fetchSubjectAccessConditionsBatch(codes, universityCode, handbookYear, controller.signal).catch(() => ({})),
      Promise.all(movedCodes.map(async (code) => {
        try {
          const detail = await fetchSubjectDetail(code, universityCode, handbookYear, controller.signal);
          return [code, offeredPeriodsFrom(detail.offerings, handbookYear)] as const;
        } catch { return [code, undefined] as const; }
      })),
    ]).then(([accessConditions, offerings]) => {
      if (controller.signal.aborted) return;
      setFacts({ accessConditions, offeredPeriods: Object.fromEntries(offerings.flatMap(([code, periods]) => periods === undefined ? [] : [[code, periods]])) });
      setLoading(false);
    });
    return () => controller.abort();
  }, [planner, sourceId, targetId, universityCode, handbookYear]);
  const proposal = target ? proposeSwap(planner, sourceId, targetId, facts) : null;
  return <dialog ref={ref} className="swap-dialog" aria-labelledby="swap-heading" onCancel={onClose}>
    <div className="swap-dialog__content">
      <div className="section-heading"><h2 id="swap-heading">Swap position</h2><button type="button" className="text-button" onClick={onClose}>Cancel swap</button></div>
      <p><strong>{source?.item.subject?.name}</strong> · {source?.label}</p>
      <p>Counts toward: {source?.item.choiceOrigin?.sourceLabel ?? source?.item.choiceOrigin?.title} {source?.item.choiceOrigin?.allocatedGroupLabel}</p>
      <p>Choose a target. Each subject keeps its requirement allocation.</p>
      <div className="swap-targets">
        {positions.filter(({ item }) => item.plannerItemId !== sourceId).map(({ item, label }) => {
          const locked = !isCustomPosition(item);
          return <button key={item.plannerItemId} type="button" className={`swap-target${targetId === item.plannerItemId ? " swap-target--selected" : ""}`}
            disabled={locked} aria-pressed={targetId === item.plannerItemId} onClick={() => { if (targetId !== item.plannerItemId) { setLoading(true); setTargetId(item.plannerItemId); } }}>
            <strong>{item.subject?.name ?? item.title}</strong><span>{label} · {item.subject?.creditPoints ?? item.creditPoints} CP</span>
            <span>{locked ? "Locked official position or placement" : `Counts toward: ${item.choiceOrigin?.sourceLabel ?? item.choiceOrigin?.title} ${item.choiceOrigin?.allocatedGroupLabel ?? ""}`}</span>
          </button>;
        })}
      </div>
      {target && <section aria-live="polite" className="swap-review">
        <h3>Review swap</h3><p>{source?.item.subject?.name}: {source?.label} → {target.label}</p>
        <p>{target.item.subject?.name ?? "Empty position"}: {target.label} → {source?.label}</p>
        {loading ? <p>Checking workload, offerings and enrolment rules…</p> : <>
          {proposal?.errors.map((error) => <p className="swap-error" key={error}>{error}</p>)}
          {proposal?.warnings.map((warning) => <p className="swap-warning" key={warning}>{warning}</p>)}
        </>}
        <button className="primary-button" type="button" disabled={loading || Boolean(proposal?.errors.length)} onClick={() => { onConfirm(sourceId, targetId, facts); onClose(); }}>Confirm swap</button>
      </section>}
    </div>
  </dialog>;
};
