import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegreeStudyPlans } from "../../../api/degrees";
import { mapUsydEngineeringStructure, usydEngineeringConditionalDisplayGroups,
  usydEngineeringDisplayGroups, usydEngineeringStreamChoices } from "../../../domain/usydEngineeringStructure";
import type { StudyPlan } from "../../../types/handbook";
import { AsyncState } from "../../AsyncState";
import { RequirementAccordion, SelectedRequirementStructure,
  type RequirementChoiceSelection } from "../../RequirementAccordion";
import { appUi } from "../../ui";
import type { DegreeStructureProps } from "../types";

export const UsydEngineeringStructure = ({ detail, universityCode, handbookYear, selections, selectionNotice,
  onSelectComponent, onOpenSubject }: DegreeStructureProps) => {
  const structure = mapUsydEngineeringStructure(detail);
  const groups = structure ? usydEngineeringDisplayGroups(structure) : [];
  const conditionalGroups = structure ? usydEngineeringConditionalDisplayGroups(structure) : [];
  const streamGroup = groups.find((group) => group.title === "Engineering Stream");
  const hasFormalStreamSelection = streamGroup?.logic === "ONE_OF" && streamGroup.items.length > 1
    && streamGroup.items.every((item) => item.itemType === "COMPONENT" && item.component);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [planStatus, setPlanStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedStream, setSelectedStream] = useState("");
  const retryPlans = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (hasFormalStreamSelection) {
      setPlans([]);
      setPlanStatus("ready");
      return;
    }
    const controller = new AbortController();
    setPlanStatus("loading");
    void fetchDegreeStudyPlans(detail.degree.code, universityCode, handbookYear, controller.signal)
      .then((result) => { setPlans(result); setPlanStatus("ready"); })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPlanStatus("error");
      });
    return () => controller.abort();
  }, [detail.degree.code, handbookYear, hasFormalStreamSelection, reloadKey, universityCode]);

  const streamChoices = useMemo(() => usydEngineeringStreamChoices(plans), [plans]);
  if (!structure) return null;
  const selected = streamChoices.find((choice) => choice.pathway === selectedStream);
  const selectionContext = { universityCode, handbookYear, selections, onSelectComponent, onOpenSubject };
  const streamSelection: RequirementChoiceSelection | undefined = !hasFormalStreamSelection
    && planStatus === "ready" && streamChoices.length > 0 ? {
    legend: "Choose an Engineering stream",
    choices: streamChoices.map((choice) => ({
      value: choice.pathway,
      title: choice.pathway,
      badge: "Stream",
    })),
    selectedValue: selectedStream,
    onSelect: setSelectedStream,
    showSearch: true,
    selectedContent: selected ? <SelectedRequirementStructure label="Selected stream" title={selected.pathway}
      creditLabel="120 CP stream requirement"
      groups={[]} emptyMessage={null}
      context={selectionContext} /> : undefined,
  } : undefined;
  const streamStatus = hasFormalStreamSelection ? null : planStatus === "loading"
    ? <AsyncState kind="loading" label="Loading Engineering streams" />
    : planStatus === "error"
      ? <AsyncState kind="error" label="We couldn't load Engineering streams." onRetry={retryPlans} />
      : streamChoices.length === 0
        ? <AsyncState kind="empty" label="Stream selection is not available." />
        : null;

  return <section className={appUi.requirementsSection} aria-labelledby="requirements-heading">
    <div className={appUi.sectionHeading}><div><p className={appUi.stepLabel}>Step 3 of 3</p><h2 id="requirements-heading">Course structure</h2></div>
      <span className={appUi.resultCount}>3 sections</span></div>
    <p className={appUi.sectionNote}>Open each section to see its formal handbook requirements.</p>
    {selectionNotice && <p className={appUi.selectionNotice} role="status">A saved choice is no longer available for this handbook. Please choose it again.</p>}
    <div className={appUi.requirementsList}>{groups.map((group) => {
      const stream = group.title === "Engineering Stream";
      return <RequirementAccordion group={group} key={group.id}
        universityCode={universityCode} handbookYear={handbookYear} selections={selections}
        onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject}
        showChoiceSearch={stream}
        choiceSelection={stream ? streamSelection : undefined}
        supplementalContent={stream ? streamStatus : undefined} />;
    })}</div>
    {conditionalGroups.length > 0 && <section aria-labelledby="usyd-conditional-heading">
      <h3 id="usyd-conditional-heading">Conditional</h3>
      <div className={appUi.requirementsList}>{conditionalGroups.map((group) => <RequirementAccordion group={group} key={group.id}
        universityCode={universityCode} handbookYear={handbookYear} selections={selections}
        onSelectComponent={onSelectComponent} onOpenSubject={onOpenSubject} obligation="CONDITIONAL" />)}</div>
    </section>}
  </section>;
};
