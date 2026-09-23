import type {
  UsydCommencement,
  UsydPlanStreamGroup,
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
  groups: UsydPlanStreamGroup[];
  stream: string;
  commencement: UsydCommencement | "";
  planId: string;
  visiblePlan: StudyPlan | null;
  onRetry: () => void;
  onStreamChange: (stream: string) => void;
  onCommencementChange: (commencement: UsydCommencement) => void;
  onPlanChange: (planId: string) => void;
  onOpenSubject: (subjectCode: string) => void;
}

/** Presents the resolved USYD Engineering CUSP controls and read-only roadmap. */
export const UsydEngineeringStudyPlans = ({
  status,
  hasPlans,
  groups,
  stream,
  commencement,
  planId,
  visiblePlan,
  onRetry,
  onStreamChange,
  onCommencementChange,
  onPlanChange,
  onOpenSubject,
}: Props) => (
  <section className={appUi.studyPlansSection} aria-labelledby="study-plan-heading">
    <div className={appUi.sectionHeading}>
      <div>
        <p className={appUi.stepLabel}>Official CUSP roadmap</p>
        <h2 id="study-plan-heading">Study plan</h2>
      </div>
      <span className={appUi.readOnlyLabel}>Read only</span>
    </div>
    <p className={appUi.sectionNote}>
      Choose your Engineering stream, commencement and official variant. Unresolved choices remain
      placeholders until formal eligible subjects are available.
    </p>
    {status === "loading" && <AsyncState kind="loading" label="Loading official study plans" />}
    {status === "error" && (
      <AsyncState
        kind="error"
        label="We couldn't load the official study plans."
        onRetry={onRetry}
      />
    )}
    {status === "ready" && !hasPlans && (
      <AsyncState kind="empty" label="No official CUSP study plan is available for this degree." />
    )}
    {status === "ready" && hasPlans && (
      <UsydEngineeringPlanSelector
        groups={groups}
        stream={stream}
        commencement={commencement}
        planId={planId}
        onStreamChange={onStreamChange}
        onCommencementChange={onCommencementChange}
        onPlanChange={onPlanChange}
      />
    )}
    {status === "ready" && stream && !commencement && (
      <p className={appUi.sectionNote}>
        Choose when you are commencing to see the matching CUSP variants.
      </p>
    )}
    {status === "ready" && commencement && !planId && (
      <p className={appUi.sectionNote}>Choose the base plan or a specialisation variant.</p>
    )}
    {visiblePlan && (
      <>
        <div className={appUi.planIntro}>
          <h3>{visiblePlan.title}</h3>
          {visiblePlan.description && <p>{visiblePlan.description}</p>}
          {visiblePlan.sourceUrl && (
            <p>
              <a href={visiblePlan.sourceUrl} target="_blank" rel="noreferrer">
                View official CUSP source
              </a>
            </p>
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
