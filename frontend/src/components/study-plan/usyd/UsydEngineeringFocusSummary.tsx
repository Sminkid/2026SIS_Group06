import type { ComponentDetailResponse } from "../../../types/handbook";
import { usydEngineeringProgress } from "../../../domain/usydEngineeringProgress";
import { RequirementAccordion } from "../../RequirementAccordion";
import { appUi, cn } from "../../ui";

export function UsydEngineeringFocusSummary({ focus, breadth, handbookYear, onOpenSubject }: {
  focus?: ComponentDetailResponse; breadth: boolean; handbookYear: number; onOpenSubject: (code: string) => void;
}) {
  if (!focus) return null;
  const points = usydEngineeringProgress(focus, []).targetCreditPoints;
  return <aside aria-label="Roadmap focus summary" className={cn(appUi.planPanel, appUi.planPanelFocus)}>
    <div className={appUi.planPanelHeader}><h3>{focus.component.name}</h3>
      <span className={appUi.planPanelMeta}>{points === null ? "Formal CP total unavailable" : `${points} CP specialisation`}</span></div>
    <p className={appUi.planPanelNote}>{breadth ? "This Breadth focus uses eligible Free Elective capacity." : "This Stream focus uses eligible stream and elective capacity under its formal requirements."}
      {" "}The official roadmap keeps elective slots open. Use Customise Plan to allocate subjects toward this focus.</p>
    <details><summary>View focus requirements</summary>
      <p>Roadmap focus is a preview. Formal selection is made in Course Structure.</p>
      {focus.requirements.map(group => <RequirementAccordion key={group.id} group={group} universityCode="USYD" handbookYear={handbookYear}
        selections={{}} onSelectComponent={() => undefined} onOpenSubject={onOpenSubject} />)}
    </details>
  </aside>;
}
