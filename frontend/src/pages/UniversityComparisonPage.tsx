import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appUi } from "../components/ui";
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
import { UniversityLogo } from "../components/UniversityLogo";

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

/** Universities shown when the page opens; more can be added up to MAX_COMPARED_COURSES. */
const DEFAULT_COMPARED = 2;

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
 * Lists the universities not yet compared. Picking one fills the next column with its card (`pending`),
 * then asks for the course there, preselecting that university's equivalent of the course being compared.
 */
/** The comparison column's header: logo above the name, with a remove button when the column can go. */
const UniversityHeaderCard = ({ university, onRemove }: { university: University; onRemove?: () => void }) => (
  <div className={appUi.uniHeaderCard}>
    {onRemove && (
      <button type="button" className={appUi.uniRemove} aria-label={`Remove ${university.name}`} onClick={onRemove}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"
          strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    )}
    <UniversityLogo university={university} />
    <span className={appUi.uniHeaderName}>{university.name}</span>
  </div>
);

/**
 * Lists the universities not yet compared. Picking one fills the next column with its card (`pending`),
 * then asks for the course there, preselecting that university's equivalent of the course being compared.
 */
function AddUniversityDialog({ courseKey, excludedCodes, pending, onPick, onBack, onClose, onAdd }: {
  courseKey: string; excludedCodes: string[]; pending: University | null;
  onPick: (university: University) => void; onBack: () => void; onClose: () => void; onAdd: (offering: Offering) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const [universities, setUniversities] = useState<University[] | null>(null);
  const [query, setQuery] = useState("");
  const [degrees, setDegrees] = useState<DegreeSummary[] | null>(null);
  const [selectedDegreeId, setSelectedDegreeId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (universities ?? []).filter((university) => !excludedCodes.includes(university.code)
      && (!normalized || `${university.name} ${university.code}`.toLowerCase().includes(normalized)));
  }, [universities, excludedCodes, query]);

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
    fetchUniversities(controller.signal).then(setUniversities).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setUniversities([]);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!pending) { setDegrees(null); setSelectedDegreeId(""); return; }
    const controller = new AbortController();
    setStatus("loading");
    setDegrees(null);
    fetchLatestHandbook(pending.code, controller.signal)
      .then((handbook) => fetchDegrees(pending.code, handbook.year, controller.signal))
      .then((result) => {
        setDegrees(result);
        setSelectedDegreeId(result.find((degree) => classifyDegree(degree.name, degree.code).key === courseKey)?.id ?? "");
        setStatus("idle");
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [pending, courseKey]);

  const confirmAdd = () => {
    const degree = degrees?.find((item) => item.id === selectedDegreeId);
    if (pending && degree) onAdd({ university: pending, degree });
  };

  return (
    <dialog ref={ref} onKeyDown={trapDialogFocus} aria-labelledby="add-university-heading"
      className="rounded-2xl border-0 p-0 backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="flex w-[min(28rem,90vw)] flex-col gap-4 p-6">
        {pending === null ? (
          <>
            <h2 id="add-university-heading" className="m-0 text-lg font-bold">Add university</h2>
            <label className={appUi.uniPickerSearch}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" className="outline-none" placeholder="Find a university" aria-label="Find a university"
                value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            {universities === null && <p className="m-0 text-sm">Loading universities…</p>}
            {universities !== null && matches.length === 0 && <p className="m-0 text-sm">No universities match your search.</p>}
            {matches.length > 0 && (
              <ul className={appUi.uniPickerList}>
                {matches.map((university) => (
                  <li key={university.id}>
                    <button type="button" className={appUi.uniPickerOption} onClick={() => onPick(university)}>
                      <span className={appUi.uniOptionTile}><UniversityLogo university={university} size="option" /></span>
                      <span className="grid">
                        <span className="font-bold">{university.name}</span>
                        <span className="text-sm text-[var(--muted)]">{university.code}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" className={appUi.cancelButton} onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="add-university-heading" className="m-0 text-lg font-bold">Choose a course at {pending.name}</h2>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Course
              <select
                className="rounded border border-solid border-[color:var(--line)] p-2 text-sm"
                value={selectedDegreeId}
                disabled={degrees === null}
                onChange={(event) => setSelectedDegreeId(event.target.value)}
              >
                <option value="">{status === "loading" ? "Loading courses…" : "Select a course…"}</option>
                {(degrees ?? []).map((degree) => (
                  <option key={degree.id} value={degree.id}>{degree.name}</option>
                ))}
              </select>
            </label>
            {status === "error" && <p role="alert" className="m-0 text-sm">We couldn't load this university's courses.</p>}
            <div className="flex flex-row justify-between">
              <button type="button" className={appUi.primaryButton} disabled={!selectedDegreeId} onClick={confirmAdd}>
                Add to comparison
              </button>
              <button type="button" className={appUi.cancelButton} onClick={onBack}>Back</button>
            </div>
          </>
        )}
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
  // Universities offering this course that are shown as columns; the rest can be added back from the dialog.
  const [shownIds, setShownIds] = useState<string[]>(() =>
    primaryOfferings(course).slice(0, DEFAULT_COMPARED).map((offering) => offering.university.id));
  const [isAddOpen, setIsAddOpen] = useState(false);
  // A university picked in the dialog whose course hasn't been chosen yet; it holds the next column meanwhile.
  const [pendingUniversity, setPendingUniversity] = useState<University | null>(null);
  const [basis, setBasis] = useState<FeeBasis>("domestic");
  // Chosen delivery variant per university, e.g. Co-op instead of the standard degree; defaults to the standard one.
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const variantsFor = (university: University) =>
    course.offerings.filter((offering) => offering.university.id === university.id);
  const courseOfferings = primaryOfferings(course).filter((primary) => shownIds.includes(primary.university.id)).map((primary): Offering => {
    const chosen = variantsFor(primary.university).find((offering) => offering.degree.id === variantChoice[primary.university.id]);
    return { university: primary.university, degree: (chosen ?? primary).degree };
  });
  const offerings = [...courseOfferings, ...extraOfferings];
  const canAdd = offerings.length + (pendingUniversity ? 1 : 0) < MAX_COMPARED_COURSES;
  const canRemove = offerings.length > DEFAULT_COMPARED;

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

  const removeOffering = (universityId: string) => {
    setShownIds((prev) => prev.filter((id) => id !== universityId));
    setExtraOfferings((prev) => prev.filter((offering) => offering.university.id !== universityId));
  };
  // A degree that belongs to this course goes back in as a course column, so its variant picker returns.
  const addOffering = (offering: Offering) => {
    if (course.offerings.some(({ degree }) => degree.id === offering.degree.id)) {
      setShownIds((prev) => [...prev, offering.university.id]);
      setVariantChoice((prev) => ({ ...prev, [offering.university.id]: offering.degree.id }));
    } else {
      setExtraOfferings((prev) => [...prev, offering]);
    }
    closeAdd();
  };
  const closeAdd = () => {
    setIsAddOpen(false);
    setPendingUniversity(null);
  };
  const placeholderCell = (rowIndex: number, text: string) => (
    <td>
      <div className={rowIndex % 2 === 0 ? appUi.uniInfo : appUi.uniInfoAlt}>
        <span className={appUi.feeMissing}>{text}</span>
      </div>
    </td>
  );

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
      <Breadcrumbs items={[{ label: "Home", onClick: onHome },
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
                      <th key={university.id} scope="col" className="align-top">
                        <UniversityHeaderCard university={university}
                          onRemove={canRemove ? () => removeOffering(university.id) : undefined} />
                        {variants.length > 1 && (
                          <select className={appUi.uniVariantSelect}
                            aria-label={`${university.name} degree option`} value={degree.id}
                            onChange={(event) => setVariantChoice((prev) => ({ ...prev, [university.id]: event.target.value }))}>
                            {variants.map((offering) => (
                              <option key={offering.degree.id} value={offering.degree.id}>{offering.degree.name} · {offering.degree.code}</option>
                            ))}
                          </select>
                        )}
                      </th>
                    );
                  })}
                  {pendingUniversity && (
                    <th scope="col" className="align-top">
                      <UniversityHeaderCard university={pendingUniversity} onRemove={closeAdd} />
                    </th>
                  )}
                  {canAdd && (
                    <th className="align-top">
                      <button className={appUi.uniAddSlot} type="button" onClick={() => setIsAddOpen(true)}>
                        <span className={appUi.uniAddIcon} aria-hidden="true">+</span>
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
                    {pendingUniversity && placeholderCell(rowIndex, rowIndex === 0 ? "Choose a course" : "—")}
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
                  {pendingUniversity && <td />}
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
          pending={pendingUniversity}
          onPick={setPendingUniversity}
          onBack={() => setPendingUniversity(null)}
          onClose={closeAdd}
          onAdd={addOffering}
        />
      )}
    </main>
  );
};