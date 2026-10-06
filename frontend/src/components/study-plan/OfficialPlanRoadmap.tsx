import type { ReactNode } from "react";
import type { StudyPlan, StudyPlanItem, StudyPlanPeriod } from "../../types/handbook";
import { appUi } from "../ui";
import { plannerUi } from "../planner/ui";

const roadmapBlocks = (items: StudyPlanItem[]) => {
  const blocks = new Map<string, StudyPlanItem[]>();
  items.forEach((item) => {
    const key = item.choiceOrigin?.parentAggregateItemId ?? item.id;
    blocks.set(key, [...(blocks.get(key) ?? []), item]);
  });
  return [...blocks.entries()];
};

interface Props {
  plan: StudyPlan;
  renderItem: (item: StudyPlanItem, scheduled: string) => ReactNode;
  renderPeriodActions?: (period: StudyPlanPeriod) => ReactNode;
}

/** University-neutral StudyPlan -> Year -> Period -> Item rendering. */
export const OfficialPlanRoadmap = ({ plan, renderItem, renderPeriodActions }: Props) => <div className="plan-years grid items-start gap-10">
  {plan.years.map((year) => <section className="plan-year min-w-0 scroll-mt-4" key={year.id}>
    <h3 className="mb-4 mt-0 border-0 border-b border-solid border-slate-400 pb-3 text-2xl">{year.name}</h3>
    <div className="grid items-start gap-7">
      {year.periods.map((period) => <section className="plan-period min-w-0" data-period-id={period.id} key={period.id}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <h4 className="m-0 text-sm font-bold uppercase tracking-wide">{period.name}</h4>
          <span>{period.items.reduce((sum, item) => sum + (item.subject?.creditPoints ?? item.creditPoints ?? 0), 0)} CP scheduled</span>
        </div>
        {renderPeriodActions?.(period)}
        {period.items.length === 0 ? <p className={appUi.planPeriodEmpty}>No items listed</p>
          : <div className={plannerUi.grid}>{roadmapBlocks(period.items).map(([blockId, blockItems]) => {
            const origin = blockItems[0]?.choiceOrigin;
            const required = origin?.parentAggregateCreditPoints;
            const points = blockItems.reduce((sum, item) => sum + (item.subject?.creditPoints ?? item.creditPoints ?? 0), 0);
            return <div key={blockId} className={required
              ? "roadmap-aggregate col-span-full min-w-0 border-0 border-y border-solid border-slate-200 py-3"
              : "min-w-0"}>
              {required !== undefined && <header className="mb-3 text-sm"><strong>{origin?.sourceLabel ?? origin?.parentAggregateTitle}</strong>
                <p className="mb-0 mt-1 text-xs text-slate-600">{points} CP scheduled here</p></header>}
              <div className={required ? plannerUi.grid : undefined}>
                {blockItems.map((item) => renderItem(item, `${year.name} ${period.name}`))}
              </div>
            </div>;
          })}</div>}
      </section>)}
    </div>
  </section>)}
</div>;
