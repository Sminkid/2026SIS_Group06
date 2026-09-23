import { AsyncState } from "../AsyncState";
import { DegreeCompletionOverview } from "../DegreeCompletionOverview";
import { RequirementAccordion } from "../RequirementAccordion";
import { appUi } from "../ui";
import type { DegreeStructureProps } from "./types";

export const GenericDegreeStructure = ({ detail, universityCode, handbookYear, selections, selectionNotice,
  onSelectComponent, onOpenSubject }: DegreeStructureProps) => {
  const pathwayRequirements = detail.requirements.filter((group) => group.pathways.length > 0);
  const compulsoryRequirements = detail.requirements.filter((group) => group.pathways.length === 0);
  const hasSemanticOverview = detail.completionSummary.some((summary) =>
    summary.obligation === "OPTIONAL" || summary.obligation === "CONDITIONAL" || summary.obligation === "INFORMATIONAL");
  const accordion = (group: DegreeStructureProps["detail"]["requirements"][number]) => <RequirementAccordion
    group={group} key={group.id} universityCode={universityCode} handbookYear={handbookYear}
    selections={selections} onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject}
  />;

  return <section className={appUi.requirementsSection} aria-labelledby="requirements-heading">
    <div className={appUi.sectionHeading}><div><p className={appUi.stepLabel}>Step 3 of 3</p><h2 id="requirements-heading">Course structure</h2></div>
      <span className={appUi.resultCount}>{detail.requirements.length} sections</span></div>
    <p className={appUi.sectionNote}>{hasSemanticOverview
      ? "Start with what is required, then decide whether optional or conditional rules apply to you."
      : "Open each section to see its formal handbook requirements."}</p>
    {selectionNotice && <p className={appUi.selectionNotice} role="status">A saved choice is no longer available for this handbook. Please choose it again.</p>}
    {detail.requirements.length === 0 ? <AsyncState kind="empty" label="No formal requirement structure is available for this degree." />
      : hasSemanticOverview ? <DegreeCompletionOverview totalCreditPoints={detail.degree.creditPoints}
        summaries={detail.completionSummary} requirements={detail.requirements} universityCode={universityCode}
        handbookYear={handbookYear} selections={selections} onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject} />
        : <div className={appUi.requirementsList}>
          {pathwayRequirements.length > 0 && <>
            <h3 className={appUi.requirementSectionLabel}>Compulsory requirements</h3>
            {compulsoryRequirements.map(accordion)}
            <h3 className={appUi.requirementSectionLabel}>Choose one {pathwayRequirements[0]?.requiredCreditPoints ?? ""} CP option</h3>
            {pathwayRequirements.map(accordion)}
          </>}
          {pathwayRequirements.length === 0 && detail.requirements.map(accordion)}
        </div>}
  </section>;
};
