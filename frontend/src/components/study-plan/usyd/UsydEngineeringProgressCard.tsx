import type { ComponentDetailResponse, RequirementComponent, RequirementSubject } from "../../../types/handbook";
import { usydEngineeringProgress } from "../../../domain/usydEngineeringProgress";
import { RequirementAccordion } from "../../RequirementAccordion";
import { appUi, cn } from "../../ui";

export interface UsydAcademicComponent { reference: RequirementComponent; detail?: ComponentDetailResponse; }

export function UsydEngineeringProgressCard({ selection, subjects, onOpenSubject, handbookYear, hasConflict }: {
  selection: UsydAcademicComponent; subjects: RequirementSubject[]; onOpenSubject: (code: string) => void; handbookYear: number; hasConflict: boolean;
}) {
  const { reference, detail } = selection;
  const progress = detail ? usydEngineeringProgress(detail, subjects) : null;
  const manual = !progress || progress.state === "manual" || hasConflict;
  return <section aria-label={`${reference.name} formal progress`} className={cn(appUi.planPanel, "mb-0")}>
    <p className={appUi.planPanelEyebrow}>Formally selected in Course Structure</p>
    <div className={appUi.planPanelHeader}><h3>{reference.name}</h3>
      <strong className={appUi.planPanelTotal}>{progress ? `${progress.creditedCreditPoints ?? progress.observedCreditPoints} / ${progress.targetCreditPoints ?? "unverified"} CP` : "Loading formal requirements"}</strong></div>
    <p className={appUi.planPanelNote}>{manual ? "Partial progress · manual verification required" : progress.state === "met" ? "Structured requirement CP met" : "Requirement CP in progress"}.
      {" "}These subjects already count in your degree total; this overlay adds no credit points.</p>
    {progress?.rows.map(row => <div key={row.group.id} className={appUi.planPanelRow} data-usyd-progress-group={row.group.id}>
      <span className="min-w-0 flex-1">{row.group.title ?? "Formal requirement"}</span>
      <span className="font-semibold">{row.state === "manual" ? row.selectedCreditPoints : row.creditedCreditPoints} / {row.targetCreditPoints ?? "unverified"} CP{row.state === "manual" ? " · manual" : row.state === "met" ? " · met" : ""}</span>
    </div>)}
    {progress?.overlap && <p className={appUi.planPanelWarning}>Some units appear in several requirements. Their CP is counted once; allocation between requirements needs verification.</p>}
    {hasConflict && <p className={appUi.planPanelWarning}>A selected unit has an enrolment prohibition. Resolve the plan warning before relying on this progress.</p>}
    {detail && <details><summary>View requirements</summary>
      <p>CP progress does not confirm prerequisites, prohibitions, enrolment approval or graduation eligibility.</p>
      {detail.requirements.map(group => <RequirementAccordion key={group.id} group={group} universityCode="USYD" handbookYear={handbookYear}
        selections={{}} onSelectComponent={() => undefined} onOpenSubject={onOpenSubject} />)}
    </details>}
  </section>;
}
