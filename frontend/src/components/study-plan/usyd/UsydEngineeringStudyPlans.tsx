import type {
  UsydCommencement,
  UsydEngineeringStudyPlanPreview,
} from "../../../domain/usydStudyPlan";
import type { StudyPlan } from "../../../types/handbook";
import { AsyncState } from "../../AsyncState";
import { RoadmapCard } from "../../planner/RoadmapCard";
import { appUi } from "../../ui";
import { OfficialPlanRoadmap } from "../OfficialPlanRoadmap";
import { UsydEngineeringPlanSelector } from "./UsydEngineeringPlanSelector";

interface Props {
  status: "loading" | "ready" | "error";
  hasPlans: boolean;
  degreeName: string;
  preview: UsydEngineeringStudyPlanPreview;
  isCourseStructureSuggestion: boolean;
  visiblePlan: StudyPlan | null;
  onRetry: () => void;
  onStreamChange: (stream: string) => void;
  onSpecialisationChange: (specialisation: string) => void;
  onCommencementChange: (commencement: UsydCommencement) => void;
  onPlanChange: (planId: string) => void;
  onOpenSubject: (subjectCode: string) => void;
}

/** Presents independent USYD Engineering CUSP preview controls and a read-only roadmap. */
export const UsydEngineeringStudyPlans = ({
  status,
  hasPlans,
  degreeName,
  preview,
  isCourseStructureSuggestion,
  visiblePlan,
  onRetry,
  onStreamChange,
  onSpecialisationChange,
  onCommencementChange,
  onPlanChange,
  onOpenSubject,
}: Props) => (
  <section className={appUi.studyPlansSection} aria-labelledby="study-plan-heading">
    <div className={appUi.sectionHeading}>
      <div>
        <p className={appUi.stepLabel}>Official roadmap and personal planner</p>
        <h2 id="study-plan-heading">Study plan</h2>
      </div>
      <span className={appUi.readOnlyLabel}>Official roadmap</span>
    </div>
    <p className={appUi.sectionNote}>
      This is the university&apos;s recommended sequence, not the formal degree requirement definition.
    </p>
    {status === "loading" && <AsyncState kind="loading" label="Loading official study plans" />}
    {status === "error" && (
      <AsyncState kind="error" label="We couldn't load the official study plans." onRetry={onRetry} />
    )}
    {status === "ready" && !hasPlans && (
      <AsyncState kind="empty" label="No official CUSP study plan is available for this degree." />
    )}
    {status === "ready" && hasPlans && (
      <UsydEngineeringPlanSelector
        degreeName={degreeName}
        preview={preview}
        isCourseStructureSuggestion={isCourseStructureSuggestion}
        onStreamChange={onStreamChange}
        onSpecialisationChange={onSpecialisationChange}
        onCommencementChange={onCommencementChange}
        onPlanChange={onPlanChange}
      />
    )}
    {visiblePlan && (
      <>
        <div className={appUi.planIntro}>
          <h3>{visiblePlan.title}</h3>
          {visiblePlan.description && <p>{visiblePlan.description}</p>}
          {visiblePlan.sourceUrl && (
            <p><a href={visiblePlan.sourceUrl} target="_blank" rel="noreferrer">View official CUSP source</a></p>
          )}
        </div>
        <OfficialPlanRoadmap
          plan={visiblePlan}
          renderItem={(item, scheduled) => (
            <RoadmapCard
              item={item}
              editable={false}
              scheduled={scheduled}
              issues={[]}
              readOnlyChoiceNote="Eligible subject options are not yet mapped"
              onChoose={() => undefined}
              onOpenSubject={(code) => onOpenSubject(code)}
              onRestoreChoice={() => undefined}
              key={item.id}
            />
          )}
        />
      </>
    )}
  </section>
);
