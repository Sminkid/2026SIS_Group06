import { useCallback, useEffect, useState } from "react";
import { fetchDegreeStudyPlans } from "../api/degrees";
import type { StudyPlan, StudyPlanItem } from "../types/handbook";
import { AsyncState } from "./AsyncState";

interface Props { degreeCode: string; universityCode: string; handbookYear: number; }

const PlanItemCard = ({ item }: { item: StudyPlanItem }) => {
  const isChoice = item.itemType === "CHOICE";
  const code = item.subject?.code ?? item.rawCode;
  const name = item.subject?.name ?? item.title;
  const creditPoints = item.subject?.creditPoints ?? item.creditPoints;

  return <article className={`plan-item${isChoice ? " plan-item--choice" : ""}`}>
    <div className="plan-item__top">
      <span className="plan-item__kind">{isChoice ? "Choice" : "Subject"}</span>
      {creditPoints !== null && <span className="plan-item__cp">{creditPoints} CP</span>}
    </div>
    <h5>{name}</h5>
    {code && <p className="plan-item__code">{code}</p>}
    {isChoice && <p className="plan-item__note">Can be customised in a future planner step</p>}
  </article>;
};

export const StudyPlansSection = ({ degreeCode, universityCode, handbookYear }: Props) => {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchDegreeStudyPlans(degreeCode, universityCode, handbookYear, controller.signal)
      .then((result) => {
        setPlans(result);
        setSelectedPlanId((current) => result.some((plan) => plan.id === current) ? current : (result[0]?.id ?? ""));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [degreeCode, handbookYear, reloadKey, universityCode]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];

  return <section className="study-plans-section" aria-labelledby="study-plan-heading">
    <div className="section-heading">
      <div><p className="step-label">Official recommended sequence</p><h2 id="study-plan-heading">Study plan</h2></div>
      <span className="read-only-label">Read only</span>
    </div>
    <p className="section-note">This is the university's recommended sequence, not the formal degree requirement definition.</p>
    {status === "loading" && <AsyncState kind="loading" label="Loading official study plan" />}
    {status === "error" && <AsyncState kind="error" label="We couldn't load the official study plan." onRetry={retry} />}
    {status === "ready" && plans.length === 0 && <AsyncState kind="empty" label="No official recommended study plan is available for this degree." />}
    {status === "ready" && selectedPlan && <>
      {plans.length > 1 && <label className="plan-selector"><span>Study plan variant</span>
        <select value={selectedPlan.id} onChange={(event) => setSelectedPlanId(event.target.value)}>
          {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.title}</option>)}
        </select>
      </label>}
      <div className="plan-intro"><h3>{selectedPlan.title}</h3>{selectedPlan.description && <p>{selectedPlan.description}</p>}</div>
      <div className="plan-years">
        {selectedPlan.years.map((year) => <section className="plan-year" key={year.id}>
          <h3>{year.name}</h3>
          <div className="plan-periods">
            {year.periods.map((period) => <section className="plan-period" key={period.id}>
              <h4>{period.name}</h4>
              {period.items.length === 0 ? <p className="plan-period__empty">No items listed</p> :
                <div className="plan-items">{period.items.map((item) => <PlanItemCard item={item} key={item.id} />)}</div>}
            </section>)}
          </div>
        </section>)}
      </div>
    </>}
  </section>;
};
