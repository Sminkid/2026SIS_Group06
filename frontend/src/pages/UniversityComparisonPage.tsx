import { useEffect, useMemo, useRef, useState } from "react";
import { appUi, cn } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { fetchCourseFees } from "../api/fees";
import { fetchUniversities, fetchLatestHandbook, fetchDegrees } from "../api/universities";
import { formatDuration, formatAud, annualFee } from "../domain/feeComparison";
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
  onBackToQuizResult: () => void;
  onBackToRecommendations: () => void;
}

type Offering = { university: University; degree: DegreeSummary };

const feeFor = (fees: CourseFee[], universityCode: string, degree: DegreeSummary): CourseFee | null => {
  const matches = fees.filter((fee) => fee.universityCode === universityCode && fee.degreeId === degree.id);
  if (matches.length === 0) return null;
  // Prefer the fee row matching this degree's own handbook edition...
  const exactYear = matches.find((fee) => fee.feeYear === String(degree.handbookYear));
  if (exactYear) return exactYear;
  // ...otherwise fall back to the most recent feeYear available.
  return [...matches].sort((a, b) => Number(b.feeYear) - Number(a.feeYear))[0];
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

export const UniversityComparisonPage = ({ course, onSelectUniversity, onHome, onBackToQuizResult, onBackToRecommendations }: Props) => {
  // One bulk fetch for every offering, not one call per university — /api/fees already returns
  // the whole table, so we just look up each offering's row client-side.
  const [fees, setFees] = useState<CourseFee[] | null>(null);
  const [extraOfferings, setExtraOfferings] = useState<Offering[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const offerings = [...course.offerings, ...extraOfferings];

  useEffect(() => {
    const controller = new AbortController();
    fetchCourseFees(controller.signal)
      .then(setFees)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFees([]);
      });
    return () => controller.abort();
  }, []);

  const tuitionFor = (university: University, degree: DegreeSummary): string => {
    if (fees === null) return "Loading…";
    const fee = feeFor(fees, university.code, degree);
    const domestic = fee ? annualFee(fee, "domestic") : null;
    return domestic === null ? "Not available" : formatAud(domestic);
  };

  const rankingFor = (university: University): string => {
    const ranking = latestRanking(university.rankings);
    return ranking ? rankingPosition(ranking) : "Not available";
  };

  const removeExtraOffering = (universityId: string) =>
    setExtraOfferings((prev) => prev.filter((offering) => offering.university.id !== universityId));

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Get Started", onClick: onHome },
                           { label: "Quiz Result", onClick: onBackToQuizResult },
                           { label: "Recommendations", onClick: onBackToRecommendations },
                           { label: "Comparison" }]} />
      <section className={appUi.pageIntroCompact} aria-labelledby="compare-heading">
        <p className={appUi.eyebrow}>Explore universities</p>
        <h1>Compare</h1>
        <h2 id="compare-heading">Compare universities for {course.courseName}</h2>

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
                          <button
                            type="button"
                            className={appUi.closeButton}
                            aria-label={`Remove ${university.name}`}
                            onClick={() => removeExtraOffering(university.id)}
                          >
                            ✕
                          </button>
                        )}
                        {university.name}
                      </div>
                    </th>
                  );
                })}
                <th>
                  <button className={appUi.secondaryButton} type="button" onClick={() => setIsAddOpen(true)}>
                    Add university
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr id="course-code">
                <th className={appUi.uniInfo}>Course code</th>
                {offerings.map(({ university, degree }) => (
                  <td key={university.id}><div className={appUi.uniInfo}>{degree.code}</div></td>
                ))}
              </tr>
              <tr id="duration">
                <th className={appUi.uniInfoAlt}>Duration</th>
                {offerings.map(({ university, degree }) => (
                  <td key={university.id}><div className={appUi.uniInfoAlt}>{formatDuration(degree.creditPoints)}</div></td>
                ))}
              </tr>
              <tr id="tuition-fee">
                <th className={appUi.uniInfo}>Annual tuition fee</th>
                {offerings.map(({ university, degree }) => (
                  <td key={university.id}><div className={appUi.uniInfo}>{tuitionFor(university, degree)}</div></td>
                ))}
              </tr>
              <tr id="ranking">
                <th className={appUi.uniInfoAlt}>Ranking</th>
                {offerings.map(({ university }) => (
                  <td key={university.id}><div className={appUi.uniInfoAlt}>{rankingFor(university)}</div></td>
                ))}
              </tr>
              <tr id="employment-rate">
                <th className={appUi.uniInfo}>Employment rate</th>
                {offerings.map(({ university }) => (
                  <td key={university.id}><div className={appUi.uniInfo}>Not available</div></td>
                ))}
              </tr>
              <tr>
                <td></td>
                {offerings.map(({ university, degree }) => (
                  <td key={university.id}>
                    <button className={appUi.viewPlanButton} type="button" onClick={() => onSelectUniversity(university, degree)}>
                      View Study Plan
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
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