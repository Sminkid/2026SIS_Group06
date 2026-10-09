import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appUi, cn } from "../components/ui";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { fetchCourseFees } from "../api/fees";
import { fetchUniversities, fetchLatestHandbook, fetchDegrees, fetchEmploymentBenchmark } from "../api/universities";
import {
  annualFee, compareToLowest, estimatedTotal, formatAud, formatDuration, lowestOf,
  MAX_COMPARED_COURSES, type FeeBasis,
} from "../domain/feeComparison";
import { employmentFor, formatPercent, formatRank, subjectRankingLine, worldRanking } from "../domain/universityOutcomes";
import { trapDialogFocus } from "../components/ui/dialog";
import { lockPageScroll } from "../components/ui/pageScroll";
import { primaryOfferings, type CourseRecommendation } from "../domain/courseAggregation";
import { classifyDegree } from "../domain/degreeClassification";
import type { University, DegreeSummary, EmploymentBenchmark } from "../types/handbook";
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

/**
 * Lets the user pick any university + degree not already in the comparison and add it as a column,
 * preselecting that university's equivalent of the course being compared when it has one.
 */
function AddUniversityDialog({ courseKey, excludedCodes, onClose, onAdd }: {
  courseKey: string; excludedCodes: string[]; onClose: () => void; onAdd: (offering: Offering) => void;
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
      .then((result) => {
        setDegrees(result);
        setSelectedDegreeId(result.find((degree) => classifyDegree(degree.name).key === courseKey)?.id ?? "");
        setStatus("idle");
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [selectedUniversityCode, courseKey]);

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

        {selectedUniversityCode && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Degree
            <select
              className="rounded border border-solid border-[color:var(--line)] p-2 text-sm"
              value={selectedDegreeId}
              disabled={degrees === null}
              onChange={(event) => setSelectedDegreeId(event.target.value)}
            >
              <option value="">{status === "loading" ? "Loading degrees…" : "Select a degree…"}</option>
              {(degrees ?? []).map((degree) => (
                <option key={degree.id} value={degree.id}>{degree.name}</option>
              ))}
            </select>
          </label>
        )}
        {status === "error" && <p role="alert" className="m-0 text-sm">We couldn't load this university's degrees.</p>}

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
  const [benchmark, setBenchmark] = useState<EmploymentBenchmark | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [extraOfferings, setExtraOfferings] = useState<Offering[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [basis, setBasis] = useState<FeeBasis>("domestic");
  // Chosen delivery variant per university, e.g. Co-op instead of the standard degree; defaults to the standard one.
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const variantsFor = (university: University) =>
    course.offerings.filter((offering) => offering.university.id === university.id);
  const courseOfferings = primaryOfferings(course).map((primary): Offering => {
    const chosen = variantsFor(primary.university).find((offering) => offering.degree.id === variantChoice[primary.university.id]);
    return { university: primary.university, degree: (chosen ?? primary).degree };
  });
  const offerings = [...courseOfferings, ...extraOfferings];
  const canAdd = offerings.length < MAX_COMPARED_COURSES;

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void Promise.all([fetchCourseFees(controller.signal), fetchEmploymentBenchmark(controller.signal).catch(() => null)])
      .then(([feeData, benchmarkData]) => { setFees(feeData); setBenchmark(benchmarkData); setStatus("ready"); })
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
  const feeYear = feeRecords.find((fee) => fee !== null)?.feeYear.replace("-", "–");
  const notAvailable = <span className={appUi.feeMissing}>Not available</span>;

  const removeExtraOffering = (universityId: string) =>
    setExtraOfferings((prev) => prev.filter((offering) => offering.university.id !== universityId));

  const rows: Array<{ id: string; label: ReactNode; render: (offering: Offering, index: number) => ReactNode }> = [
    { id: "course-code", label: "Course Code", render: ({ degree }) => degree.code },
    { id: "course-name", label: "Course Name", render: ({ degree }) => degree.name },
    {
      id: "credit-points",
      label: "Credit Points",
      render: ({ degree }) => (degree.creditPoints === null ? "Not listed" : `${degree.creditPoints} CP`),
    },
    { id: "duration", label: "Duration (Full-Time)", render: ({ degree }) => formatDuration(degree.creditPoints) },
    {
      id: "annual-fee",
      label: `Annual Fee (${basis})`,
      render: (_offering, index) => (annuals[index] === null
        ? <span className={appUi.feeMissing}>Not offered</span>
        : <>{formatAud(annuals[index])}{comparisonTag(annuals[index], lowestAnnual)}</>),
    },
    {
      id: "estimated-total",
      label: "Estimated Total",
      render: (_offering, index) => (totals[index] === null
        ? <span className={appUi.feeMissing}>Not offered</span>
        : <>{formatAud(totals[index])}{comparisonTag(totals[index], lowestTotal)}</>),
    },
    {
      id: "ranking",
      label: "QS World Ranking",
      render: ({ university, degree }) => {
        const world = worldRanking(university);
        if (!world) return notAvailable;
        const subjectLine = subjectRankingLine(university, degree.name);
        return (
          <div className="text-center">
            {formatRank(world)}
            {subjectLine && <span className={appUi.feeSubline}>{subjectLine}</span>}
          </div>
        );
      },
    },
    {
      id: "employment-rate",
      label: "Employment Rate",
      render: ({ university }) => {
        const employment = employmentFor(university, basis);
        return employment === null ? notAvailable : (
          <div className="text-center">
            {formatPercent(employment.fullTimeRate)}
            <span className={appUi.feeSubline}>Full-time, {basis} graduates, {employment.period}</span>
          </div>
        );
      },
    },
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
                  {offerings.map(({ university, degree }) => {
                    const isExtra = extraOfferings.some((offering) => offering.university.id === university.id);
                    const variants = isExtra ? [] : variantsFor(university);
                    return (
                      <th key={university.id}>
                        <div className={cn(appUi.universityCard, "relative h-full")}>
                          {isExtra && (
                            <button type="button" className={appUi.closeButton}
                              aria-label={`Remove ${university.name}`}
                              onClick={() => removeExtraOffering(university.id)}>
                              ✕
                            </button>
                          )}
                          {university.name}
                          {variants.length > 1 && (
                            <select className="mt-2 block w-full rounded border border-solid border-[color:var(--line)] p-1 text-xs font-normal"
                              aria-label={`${university.name} degree option`} value={degree.id}
                              onChange={(event) => setVariantChoice((prev) => ({ ...prev, [university.id]: event.target.value }))}>
                              {variants.map((offering) => (
                                <option key={offering.degree.id} value={offering.degree.id}>{offering.degree.name}</option>
                              ))}
                            </select>
                          )}
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
          <p>Estimated total multiplies the annual fee by the course length at current rates, so real totals will be higher as fees rise each year. Honours entries of 48 CP cover the honours year only.</p>
          <p>Domestic figures are Commonwealth supported student contributions and vary with the units you take.</p>
          <p>Ranking is the university's position in the QS World University Rankings 2027. The second line is the QS subject ranking for the subject area closest to the course; double degrees show the overall ranking only.</p>
          <p>
            Employment rate is the share of the university's undergraduates in full-time work about 4–6 months after finishing (QILT Graduate Outcomes Survey 2025). It covers the whole university, not the individual course.
            {benchmark?.domestic && benchmark.international
              && ` The average across all Australian universities is ${formatPercent(benchmark.domestic.fullTimeRate)} for domestic and ${formatPercent(benchmark.international.fullTimeRate)} for international graduates.`}
          </p>
        </div>
      </section>

      {isAddOpen && (
        <AddUniversityDialog
          courseKey={course.courseKey}
          excludedCodes={offerings.map(({ university }) => university.code)}
          onClose={() => setIsAddOpen(false)}
          onAdd={(offering) => { setExtraOfferings((prev) => [...prev, offering]); setIsAddOpen(false); }}
        />
      )}
    </main>
  );
};