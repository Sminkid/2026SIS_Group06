import type { StudyPlanItem } from "../../../types/handbook";
import { readableText } from "../../../domain/readableText";

/** Compact official USYD cards keep the details action immediately below schedule metadata. */
export function UsydEngineeringReadOnlyCard({ item, scheduled, onOpenSubject }: {
  item: StudyPlanItem; scheduled: string; onOpenSubject: (code: string) => void;
}) {
  const code = item.subject?.code ?? item.rawCode;
  const points = item.subject?.creditPoints ?? item.creditPoints;
  return <article data-planner-item-id={item.id} className={`plan-item ${item.itemType === "CHOICE" ? "plan-item--choice border-dashed border-slate-400 bg-slate-50" : "border-solid border-slate-200 bg-white"} flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-left [overflow-wrap:anywhere]`}>
    <div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-blue-800">{item.subject ? "Subject" : "Choice"}</span>
      {points !== null && <span className="shrink-0 text-xs text-slate-600">{points} CP</span>}</div>
    <h5 className="m-0 text-sm font-semibold leading-5">{readableText(item.subject?.name ?? item.title)}</h5>
    {code && <p className="m-0 text-xs font-semibold text-blue-800">{code}</p>}
    <div className="text-xs leading-5 text-slate-600"><p className="plan-item__note m-0">Scheduled: {scheduled}</p>
      {item.subject && <button type="button" className="mt-1 min-h-8 cursor-pointer rounded border-0 bg-transparent p-0 text-xs font-semibold text-blue-800 hover:underline focus-visible:outline-2" onClick={() => onOpenSubject(item.subject!.code)}>View requirements →</button>}</div>
    {!item.subject && <p className="plan-item__note m-0 text-xs leading-5 text-slate-600">Customize to choose from eligible subjects</p>}
  </article>;
}
