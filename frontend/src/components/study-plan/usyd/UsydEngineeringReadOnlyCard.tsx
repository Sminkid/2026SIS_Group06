import type { StudyPlanItem } from "../../../types/handbook";
import { readableText } from "../../../domain/readableText";
import { cn } from "../../ui";
import { plannerUi as ui } from "../../planner/ui";

/** Compact official USYD cards keep the details action immediately below schedule metadata. */
export function UsydEngineeringReadOnlyCard({ item, scheduled, onOpenSubject }: {
  item: StudyPlanItem; scheduled: string; onOpenSubject: (code: string) => void;
}) {
  const code = item.subject?.code ?? item.rawCode;
  const points = item.subject?.creditPoints ?? item.creditPoints;
  return <article data-planner-item-id={item.id} className={cn("plan-item", item.itemType === "CHOICE" ? "plan-item--choice" : "", ui.card, item.itemType === "CHOICE" ? ui.choice : ui.fixed)}>
    <div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-blue-800">{item.subject ? "Subject" : "Choice"}</span>
      {points !== null && <span className="shrink-0 text-xs text-slate-600">{points} CP</span>}</div>
    <h5 className="m-0 text-sm font-semibold leading-5">{readableText(item.subject?.name ?? item.title)}</h5>
    {code && <p className="m-0 text-xs font-semibold text-blue-800">{code}</p>}
    <p className={cn("plan-item__note", ui.note)}>Scheduled: {scheduled}</p>
    {item.subject && <div className="mt-auto flex flex-wrap items-center gap-1 border-0 border-t border-solid border-slate-200 pt-2">
      <button type="button" className={ui.action} onClick={() => onOpenSubject(item.subject!.code)}>View requirements</button>
    </div>}
    {!item.subject && <p className={cn("plan-item__note", ui.note)}>Customise to choose from eligible subjects</p>}
  </article>;
}
