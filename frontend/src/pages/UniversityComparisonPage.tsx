import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appUi, cn } from "../components/ui";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { fetchCourseFees } from "../api/fees";
import { fetchUniversities, fetchLatestHandbook, fetchDegrees } from "../api/universities";
import {
  annualFee, compareToLowest, estimatedTotal, formatAud, formatDuration, lowestOf,
  MAX_COMPARED_COURSES, type FeeBasis,
} from "../domain/feeComparison";
import { latestRanking, rankingPosition } from "../domain/rankingLabel";
import { trapDialogFocus } from "../components/ui/dialog";
import { lockPageScroll } from "../components/ui/pageScroll";
import type { CourseRecommendation } from "../domain/courseAggregation";
import type { University, DegreeSummary } from "../types/handbook";
import type { CourseFee } from "../types/fee";

interface Props {
  course: CourseRecommendation;
  onSelectUniversity: (university: University, degree: DegreeSummary) => void;
  onHome: () => void;
  /** Omitted when the course was reached by browsing rather than through the quiz. */
  onBackToQuizResult?: () => void;
  onBackToRecommendations: () => void;
  recommendationsLabel?: string;
}

type Offering = { university: University; degree: DegreeSummary };

const feeFor = (fees: CourseFee[], universityCode: string, degree: DegreeSummary): CourseFee | null => {
  const matches = fees.filter((fee) => fee.universityCode === universityCode && fee.degreeId === degree.id);
  if (matches.length === 0) return null;
  const exactYear = matches.find((fee) => fee.feeYear === String(degree.handbookYear));
  if (exactYear) return exactYear;
  return [...matches].sort((a, b) => Number(b.feeYear) - Number(a.feeYear))[0];
};

const comparisonTag = (value: number | null, lowest: number | null): ReactNode => {
  const comparison = compareToLowest(value, lowest);
  if (comparison === null) return null;
  return comparison.kind === "lowest"
    ? <span className={appUi.feeTagLowest}>Lowest</span>
    : <span className={appUi.feeTagMore}>+{formatAud(comparison.difference)}</span>;
};

/** Lets the user pick any university + degree not already in the comparison and add it as a column. */
function AddUniversityDialog({ excludedCodes, onClose, onAdd }: {
  excludedCodes: string[]; onClose: () => void; onAdd: (offering: Offering) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const [universities, setUniversities] = useState<University[] | null>(null);
  const [selectedUniversityCode, setSelectedUniversityCode] = useState("");
  const [degrees, setDegrees] = useState<DegreeSummary[] | null>(null);
  const [selectedDegreeId, setSelectedDegreeId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const availableUniversities = useMemo(
    () => (universities ?? []).filter((university) => !excludedCodes.includes(university.code)),
    [universities, excludedCodes],
  );

  useEffect(() => {
    const dialog = ref.current;
    const unlockScroll = lockPageScroll();
    dialog?.showModal();
    return () => {
      unlockScroll();
      dialog?.close();
      returnFocus.current?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchUniversities(controller.signal).then(setUniversities).catch(() => setUniversities([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedUniversityCode) { setDegrees(null); setSelectedDegreeId(""); return; }
    const controller = new AbortController();
    setStatus("loading");
    setDegrees(null);
    fetchLatestHandbook(selectedUniversityCode, controller.signal)
      .then((handbook) => fetchDegrees(selectedUniversityCode, handbook.year, controller.signal))
      .then((result) => { setDegrees(result); setStatus("idle"); })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [selectedUniversityCode]);

  const confirmAdd = () => {
    const university = availableUniversities.find((item) => item.code === selectedUniversityCode);
    const degree = degrees?.find((item) => item.id === selectedDegreeId);
    if (university && degree) onAdd({ university, degree });
  };

  return (
    <dialog ref={ref} onKeyDown={trapDialogFocus} aria-labelledby="add-university-heading"
      className="rounded-2xl border-0 p-0 backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="flex w-[min(28rem,90vw)] flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="add-university-heading" className="m-0 text-lg font-bold">Add university</h2>
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          University
          <select
            className="rounded border border-solid border-[color:var(--line)] p-2 text-sm"
            value={selectedUniversityCode}
            onChange={(event) => setSelectedUniversityCode(event.target.value)}
          >
            <option value="">Select a university…</option>
            {availableUniversities.map((university) => (
              <option key={university.id} value={university.code}>{university.name}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-row justify-between">
          <button
            type="button"
            className={appUi.primaryButton}
            disabled={!selectedUniversityCode || !selectedDegreeId}
            onClick={confirmAdd}
          >
            Add to comparison
          </button>
          <button type="button" className={appUi.cancelButton} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}

export const UniversityComparisonPage = ({ course, onSelectUniversity, onHome, onBackToQuizResult, onBackToRecommendations, recommendationsLabel = "Recommendations" }: Props) => {
  const [fees, setFees] = useState<CourseFee[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [extraOfferings, setExtraOfferings] = useState<Offering[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [basis, setBasis] = useState<FeeBasis>("domestic");
  const offerings = [...course.offerings, ...extraOfferings];
  const canAdd = offerings.length < MAX_COMPARED_COURSES;

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchCourseFees(controller.signal)
      .then((data) => { setFees(data); setStatus("ready"); })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  // One fee record per offering, looked up client-side from the single bulk fetch above.
  const feeRecords = offerings.map(({ university, degree }) => feeFor(fees, university.code, degree));
  const annuals = feeRecords.map((fee) => (fee ? annualFee(fee, basis) : null));
  const totals = offerings.map((offering, index) =>
    (annuals[index] === null ? null : estimatedTotal(annuals[index], offering.degree.creditPoints)));
  const lowestAnnual = lowestOf(annuals);
  const lowestTotal = lowestOf(totals);
  const feeYear = feeRecords.find((fee) => fee !== null)?.feeYear;

  const rankingFor = (university: University): string => {
    const ranking = latestRanking(university.rankings);
    return ranking ? rankingPosition(ranking) : "Not available";
  };

  const removeExtraOffering = (universityId: string) =>
    setExtraOfferings((prev) => prev.filter((offering) => offering.university.id !== universityId));

  const rows: Array<{ id: string; label: ReactNode; render: (offering: Offering, index: number) => ReactNode }> = [
    { id: "course-code", label: "Course code", render: ({ degree }) => degree.code },
    {
      id: "credit-points",
      label: "Credit points",
      render: ({ degree }) => (degree.creditPoints === null ? "Not listed" : `${degree.creditPoints} CP`),
    },
    { id: "duration", label: "Duration (full-time)", render: ({ degree }) => formatDuration(degree.creditPoints) },
    {
      id: "annual-fee",
      label: `Annual fee (${basis})`,
      render: (_offering, index) => (annuals[index] === null
        ? <span className={appUi.feeMissing}>Not offered</span>
        : <>{formatAud(annuals[index])}{comparisonTag(annuals[index], lowestAnnual)}</>),
    },
    {
      id: "estimated-total",
      label: "Estimated total",
      render: (_offering, index) => (totals[index] === null
        ? <span className={appUi.feeMissing}>Not offered</span>
        : <>{formatAud(totals[index])}{comparisonTag(totals[index], lowestTotal)}</>),
    },
    { id: "ranking", label: "Ranking", render: ({ university }) => rankingFor(university) },
  ];

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Get Started", onClick: onHome },
                           ...(onBackToQuizResult ? [{ label: "Quiz Result", onClick: onBackToQuizResult }] : []),
                           { label: recommendationsLabel, onClick: onBackToRecommendations },
                           { label: "Comparison" }]} />
      <section className={appUi.pageIntroCompact} aria-labelledby="compare-heading">
        <p className={appUi.eyebrow}>Explore universities</p>
        <h1>Compare</h1>
        <h2 id="compare-heading">Compare universities for {course.courseName}</h2>

        <section className={appUi.contentSection}></section>
        <div className={appUi.sectionHeading}>
          <div>{feeYear && <p className={appUi.stepLabel}>{feeYear} fee guide</p>}</div>
          {status === "ready" && (
            <div className={appUi.feeToolbar}>
              <div className={appUi.feeBasisToggle} role="group" aria-label="Fee basis">
                {(["domestic", "international"] as const).map((option) => (
                  <button className={appUi.feeBasisButton} type="button" key={option}
                    aria-pressed={basis === option} onClick={() => setBasis(option)}>
                    {option === "domestic" ? "Domestic" : "International"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {status === "loading" && <AsyncState kind="loading" label="Loading course fees" />}
        {status === "error" && (
          <AsyncState kind="error" label="We couldn't load course fees. Check that the backend is running."
            onRetry={() => setReloadKey((key) => key + 1)} />
        )}

        {status !== "loading" && (
          <div className={appUi.tableWrapper}>
            <table className={appUi.comparisonTable}>
              <thead>
                <tr>
                  <th></th>
                  {offerings.map(({ university }) => {
                    const isExtra = extraOfferings.some((offering) => offering.university.id === university.id);
                    return (
                      <th key={university.id}>
                        <div className={cn(appUi.universityCard, "relative")}>
                          {isExtra && (
                            <button type="button" className={appUi.closeButton}
                              aria-label={`Remove ${university.name}`}
                              onClick={() => removeExtraOffering(university.id)}>
                              ✕
                            </button>
                          )}
                          {university.name}
                        </div>
                      </th>
                    );
                  })}
                  {canAdd && (
                    <th>
                      <button className={appUi.secondaryButton} type="button" onClick={() => setIsAddOpen(true)}>
                        Add university
                      </button>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={row.id} id={row.id}>
                    <th>
                      <div className={rowIndex % 2 === 0 ? appUi.uniInfo : appUi.uniInfoAlt}>
                         {row.label}
                      </div>
                    </th>
                    {offerings.map((offering, index) => (
                      <td key={offering.university.id}>
                        <div className={rowIndex % 2 === 0 ? appUi.uniInfo : appUi.uniInfoAlt}>
                          {row.render(offering, index)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td></td>
                  {offerings.map(({ university, degree }) => (
                    <td key={university.id}>
                      <button className={appUi.viewPlanButton} type="button"
                        onClick={() => onSelectUniversity(university, degree)}>
                        View Study Plan
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className={appUi.feeNotes}>
          <p>Annual fee is each university's guide price for 48 credit points, which is one year of full-time study.</p>
          <p>Estimated total multiplies the annual fee by the course length at current rates, so real totals will be higher as fees rise each year.</p>
          <p>Domestic figures are Commonwealth supported student contributions and vary with the units you take.</p>
        </div>
      </section>

      {isAddOpen && (
        <AddUniversityDialog
          excludedCodes={offerings.map(({ university }) => university.code)}
          onClose={() => setIsAddOpen(false)}
          onAdd={(offering) => { setExtraOfferings((prev) => [...prev, offering]); setIsAddOpen(false); }}
        />
      )}
    </main>
  );
};