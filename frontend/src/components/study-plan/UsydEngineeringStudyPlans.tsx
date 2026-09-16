import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDegreeStudyPlans } from "../../api/degrees";
import { groupUsydStudyPlans, type UsydCommencement } from "../../domain/usydStudyPlan";
import type { StudyPlan } from "../../types/handbook";
import { AsyncState } from "../AsyncState";
import { RoadmapCard } from "../planner/RoadmapCard";
import { appUi } from "../ui";
import { OfficialPlanRoadmap } from "./OfficialPlanRoadmap";
import { UsydEngineeringPlanSelector } from "./UsydEngineeringPlanSelector";

interface Props {
  degreeCode: string;
  universityCode: string;
  handbookYear: number;
  onOpenSubject: (subjectCode: string) => void;
}

export const UsydEngineeringStudyPlans = ({ degreeCode, universityCode, handbookYear, onOpenSubject }: Props) => {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [stream, setStream] = useState("");
  const [commencement, setCommencement] = useState<UsydCommencement | "">("");
  const [planId, setPlanId] = useState("");
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchDegreeStudyPlans(degreeCode, universityCode, handbookYear, controller.signal)
      .then((result) => { setPlans(result); setStatus("ready"); })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [degreeCode, handbookYear, reloadKey, universityCode]);

  const groups = useMemo(() => groupUsydStudyPlans(plans), [plans]);
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const visiblePlan = selectedPlan ? { ...selectedPlan, years: selectedPlan.years.filter((year) => !/^Year 0$/i.test(year.name.trim())) } : null;

  return <section className={appUi.studyPlansSection} aria-labelledby="study-plan-heading">
    <div className={appUi.sectionHeading}><div><p className={appUi.stepLabel}>Official CUSP roadmap</p><h2 id="study-plan-heading">Study plan</h2></div>
      <span className={appUi.readOnlyLabel}>Read only</span></div>
    <p className={appUi.sectionNote}>Choose your Engineering stream, commencement and official variant. Unresolved choices remain placeholders until formal eligible subjects are available.</p>
    {status === "loading" && <AsyncState kind="loading" label="Loading official study plans" />}
    {status === "error" && <AsyncState kind="error" label="We couldn't load the official study plans." onRetry={retry} />}
    {status === "ready" && plans.length === 0 && <AsyncState kind="empty" label="No official CUSP study plan is available for this degree." />}
    {status === "ready" && plans.length > 0 && <UsydEngineeringPlanSelector groups={groups} stream={stream}
      commencement={commencement} planId={planId}
      onStreamChange={(value) => { setStream(value); setCommencement(""); setPlanId(""); }}
      onCommencementChange={(value) => { setCommencement(value); setPlanId(""); }} onPlanChange={setPlanId} />}
    {status === "ready" && stream && !commencement && <p className={appUi.sectionNote}>Choose when you are commencing to see the matching CUSP variants.</p>}
    {status === "ready" && commencement && !planId && <p className={appUi.sectionNote}>Choose the base plan or a specialisation variant.</p>}
    {visiblePlan && <>
      <div className={appUi.planIntro}><h3>{visiblePlan.title}</h3>{visiblePlan.description && <p>{visiblePlan.description}</p>}
        {visiblePlan.sourceUrl && <p><a href={visiblePlan.sourceUrl} target="_blank" rel="noreferrer">View official CUSP source</a></p>}</div>
      <OfficialPlanRoadmap plan={visiblePlan} renderItem={(item, scheduled) => <RoadmapCard item={item} editable={false}
        scheduled={scheduled} issues={[]} readOnlyChoiceNote="Eligible subject options are not yet mapped"
        onChoose={() => undefined} onOpenSubject={(code) => onOpenSubject(code)}
        onRestoreChoice={() => undefined} key={item.id} />} />
    </>}
  </section>;
};
