import type {
  UsydCommencement,
  UsydEngineeringStudyPlanPreview,
} from "../../../domain/usydStudyPlan";
import { appUi } from "../../ui";
import { usydStudyPlanFocusGroups, usydStudyPlanFocusHelper } from "../../../domain/usydEngineeringSpecialisations";

interface Props {
  degreeName: string;
  preview: UsydEngineeringStudyPlanPreview;
  isCourseStructureSuggestion: boolean;
  onStreamChange: (stream: string) => void;
  onSpecialisationChange: (specialisation: string) => void;
  onCommencementChange: (commencement: UsydCommencement) => void;
  onPlanChange: (planId: string) => void;
}

export const UsydEngineeringPlanSelector = ({
  degreeName,
  preview,
  isCourseStructureSuggestion,
  onStreamChange,
  onSpecialisationChange,
  onCommencementChange,
  onPlanChange,
}: Props) => (
  <>
    <section className={appUi.studyPathPlanner} aria-labelledby="usyd-study-path-heading">
      <div>
        <p className={appUi.stepLabel}>Personalise your roadmap</p>
        <h2 id="usyd-study-path-heading">Your study path</h2>
      </div>
      <p className={appUi.studyPathContext}>USYD · {degreeName}</p>

      <section className={appUi.pathDecision}>
        <label className={appUi.studyPathField}>
          <span>Engineering Stream</span>
          <select value={preview.selectedStream} onChange={(event) => onStreamChange(event.target.value)}>
            <option value="">Select an Engineering stream</option>
            {preview.streams.map((group) => <option value={group.pathway} key={group.pathway}>{group.pathway}</option>)}
          </select>
        </label>
      </section>

      <section className={appUi.pathDecision}>
        <label className={appUi.studyPathField}>
          <span>Study plan focus</span>
          <select
            aria-describedby="usyd-focus-help usyd-preview-help"
            value={preview.selectedSpecialisation}
            disabled={preview.specialisations.length === 0}
            onChange={(event) => onSpecialisationChange(event.target.value)}
          >
            <option value="">Select a study plan focus</option>
            {usydStudyPlanFocusGroups.map(group => {
              const choices = preview.specialisations.filter(choice => choice.kind === group.kind);
              return choices.length ? <optgroup label={group.label} key={group.kind}>
                {choices.map(choice => <option value={choice.id} key={choice.id}>{choice.kind === "BASE" ? "Base roadmap" : choice.label}
                  {choice.component?.creditPoints != null ? ` · ${choice.component.creditPoints} CP` : ""}</option>)}
              </optgroup> : null;
            })}
          </select>
        </label>
        <p id="usyd-focus-help" className={appUi.studyPathContext}>{usydStudyPlanFocusHelper(
          preview.specialisations.find(choice => choice.id === preview.selectedSpecialisation)?.kind)}</p>
      </section>
      <p id="usyd-preview-help" className={appUi.studyPathContext}>These controls choose a roadmap preview. Changing the preview does not change your Course Structure selections.</p>

      <section className={appUi.pathDecision}>
        <label className={appUi.studyPathField}>
          <span>Commencement</span>
          <select
            value={preview.selectedCommencement}
            disabled={!preview.selectedStream}
            onChange={(event) => onCommencementChange(event.target.value as UsydCommencement)}
          >
            <option value="">Select a commencement</option>
            {preview.commencements.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}
          </select>
        </label>
      </section>

      {isCourseStructureSuggestion && (
        <p className={appUi.studyPathContext} role="status">Suggested from Course Structure</p>
      )}
    </section>

    <label className={appUi.planSelector}>
      <span>Study plan variant</span>
      <select
        value={preview.selectedPlan?.id ?? ""}
        disabled={preview.variants.length === 0}
        onChange={(event) => onPlanChange(event.target.value)}
      >
        <option value="">Choose an official variant</option>
        {preview.variants.map((variant) => <option value={variant.plan.id} key={variant.plan.id}>{variant.label}</option>)}
      </select>
    </label>

    {preview.reason && preview.selectedStream && (
      <p className={appUi.selectionNotice} role="status">{preview.reason}</p>
    )}
  </>
);
