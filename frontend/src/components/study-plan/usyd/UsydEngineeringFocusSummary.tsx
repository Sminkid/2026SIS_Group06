import type { ComponentDetailResponse } from "../../../types/handbook";
import { usydEngineeringProgress } from "../../../domain/usydEngineeringProgress";
import { RequirementAccordion } from "../../RequirementAccordion";

export function UsydEngineeringFocusSummary({ focus, breadth, handbookYear, onOpenSubject }: {
  focus?: ComponentDetailResponse; breadth: boolean; handbookYear: number; onOpenSubject: (code: string) => void;
}) {
  if (!focus) return null;
  const points = usydEngineeringProgress(focus, []).targetCreditPoints;
  return <aside aria-label="Roadmap focus summary" className="mb-5 rounded-lg border border-solid border-blue-200 bg-blue-50/50 p-4 text-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{focus.component.name}</strong>
      <span>{points === null ? "Formal CP total unavailable" : `${points} CP specialisation`}</span></div>
    <p className="mb-2 mt-2 text-slate-700">{breadth ? "This Breadth focus uses eligible Free Elective capacity." : "This Stream focus uses eligible stream and elective capacity under its formal requirements."}
      {" "}The official roadmap keeps elective slots open. Use Customize Plan to allocate subjects toward this focus.</p>
    <details><summary className="cursor-pointer font-semibold text-blue-800">View focus requirements</summary>
      <p>Roadmap focus is a preview. Formal selection is made in Course Structure.</p>
      {focus.requirements.map(group => <RequirementAccordion key={group.id} group={group} universityCode="USYD" handbookYear={handbookYear}
        selections={{}} onSelectComponent={() => undefined} onOpenSubject={onOpenSubject} />)}
    </details>
  </aside>;
}
