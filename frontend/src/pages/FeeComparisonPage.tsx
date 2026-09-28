import { appUi } from "../components/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchCourseFees } from "../api/fees";
import { fetchUniversities } from "../api/universities";
import { AsyncState } from "../components/AsyncState";
import { Breadcrumbs } from "../components/Breadcrumbs";
import {
  annualFee, applyQuery, closestCourse, compareToLowest, courseOptions, estimatedTotal, formatAud, formatDuration,
  initialColumns, leastUsedUniversity, lowestOf, MAX_COMPARED_COURSES, type ComparisonColumn, type FeeBasis,
} from "../domain/feeComparison";
import type { DegreeSummary, University } from "../types/handbook";
import type { CourseFee } from "../types/fee";

interface Props { onHome: () => void; onViewDegree: (university: University, degree: DegreeSummary) => void; }

const comparisonTag = (value: number | null, lowest: number | null): ReactNode => {
  const comparison = compareToLowest(value, lowest);
  if (comparison === null) return null;
  return comparison.kind === "lowest"
    ? <span className={appUi.feeTagLowest}>Lowest</span>
    : <span className={appUi.feeTagMore}>+{formatAud(comparison.difference)}</span>;
};

/** Compares yearly and whole-course fees for up to four courses across universities. */
export const FeeComparisonPage = ({ onHome, onViewDegree }: Props) => {
  const [fees, setFees] = useState<CourseFee[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [columns, setColumns] = useState<ComparisonColumn[]>([]);
  const [basis, setBasis] = useState<FeeBasis>("domestic");
  const [addUniversityCode, setAddUniversityCode] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void Promise.all([fetchCourseFees(controller.signal), fetchUniversities(controller.signal)])
      .then(([feeData, universityData]) => {
        const withFees = universityData.filter((university) => feeData.some((fee) => fee.universityCode === university.code));
        setFees(feeData); setUniversities(withFees); setColumns(initialColumns(feeData, withFees.map((university) => university.code))); setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  const courseById = new Map(fees.map((fee) => [fee.degreeId, fee]));
  const selected = columns.map((column) => (column.degreeId ? courseById.get(column.degreeId) ?? null : null));
  const takenIds = (exceptIndex: number) =>
    new Set(columns.flatMap((column, index) => (index !== exceptIndex && column.degreeId ? [column.degreeId] : [])));
  const updateColumn = (index: number, next: ComparisonColumn) =>
    setColumns((current) => current.map((column, i) => (i === index ? next : column)));

  const changeUniversity = (index: number, universityCode: string) => {
    const match = closestCourse(fees, universityCode, selected[index]?.degreeName ?? "", takenIds(index));
    updateColumn(index, { universityCode, degreeId: match?.degreeId ?? null, query: "" });
  };
  const changeQuery = (index: number, query: string) => updateColumn(index, applyQuery(fees, columns[index], query));
  const suggestedUniversity = leastUsedUniversity(universities.map((university) => university.code), columns) ?? "";
  const addColumn = () => {
    const universityCode = addUniversityCode || suggestedUniversity;
    const match = closestCourse(fees, universityCode, selected[0]?.degreeName ?? "", takenIds(-1));
    setColumns((current) => [...current, { universityCode, degreeId: match?.degreeId ?? null, query: "" }]);
    setAddUniversityCode("");
  };

  const canAdd = columns.length < MAX_COMPARED_COURSES;
  const annuals = selected.map((course) => (course ? annualFee(course, basis) : null));
  const totals = selected.map((course, index) => (course ? estimatedTotal(annuals[index], course.creditPoints) : null));
  const lowestAnnual = lowestOf(annuals);
  const lowestTotal = lowestOf(totals);
  const feeYear = fees[0]?.feeYear.replace("-", "–");
  const missing = <span className={appUi.feeMissing}>Not offered</span>;

  const rows: Array<{ label: string; render: (course: CourseFee, index: number) => ReactNode }> = [
    { label: "Course code", render: (course) => <span className={appUi.feeValue}>{course.degreeCode}</span> },
    { label: "Credit points", render: (course) => <span className={appUi.feeValue}>{course.creditPoints === null ? "Not listed" : `${course.creditPoints} CP`}</span> },
    { label: "Duration, full-time", render: (course) => <span className={appUi.feeValue}>{formatDuration(course.creditPoints)}</span> },
    {
      label: `Annual fee, ${basis}`,
      render: (_course, index) => (annuals[index] === null ? missing
        : <><span className={appUi.feeMoney}>{formatAud(annuals[index])}</span>{comparisonTag(annuals[index], lowestAnnual)}</>),
    },
    {
      label: "Estimated total",
      render: (_course, index) => (totals[index] === null ? missing
        : <><span className={appUi.feeMoney}>≈ {formatAud(totals[index])}</span>{comparisonTag(totals[index], lowestTotal)}</>),
    },
    {
      label: "",
      render: (course) => {
        const university = universities.find((item) => item.code === course.universityCode);
        return university && (
          <button className={appUi.textButton} type="button" onClick={() => onViewDegree(university, {
            id: course.degreeId, code: course.degreeCode, name: course.degreeName,
            creditPoints: course.creditPoints, handbookYear: course.handbookYear,
          })}>View degree →</button>
        );
      },
    },
  ];

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Universities", onClick: onHome }, { label: "Compare fees" }]} />
      <section className={appUi.pageIntroCompact}>
        <p className={appUi.eyebrow}>Know what your degree costs</p>
        <h1>Compare course fees</h1>
        <p className={appUi.lead}>Put courses side by side and see the yearly fee, how long each takes, and what the whole degree adds up to.</p>
      </section>
      <section className={appUi.contentSection} aria-labelledby="fees-heading">
        <div className={appUi.sectionHeading}>
          <div>{feeYear && <p className={appUi.stepLabel}>{feeYear} fee guide</p>}<h2 id="fees-heading">Courses compared</h2></div>
          {status === "ready" && (
            <div className={appUi.feeToolbar}>
              <div className={appUi.feeBasisToggle} role="group" aria-label="Fee basis">
                {(["domestic", "international"] as const).map((option) => (
                  <button className={appUi.feeBasisButton} type="button" key={option} aria-pressed={basis === option} onClick={() => setBasis(option)}>
                    {option === "domestic" ? "Domestic" : "International"}
                  </button>
                ))}
              </div>
              <span className={appUi.resultCount}>{columns.length} of {MAX_COMPARED_COURSES} selected</span>
            </div>
          )}
        </div>
        {status === "loading" && <AsyncState kind="loading" label="Loading course fees" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load course fees. Check that the backend is running." onRetry={retry} />}
        {status === "ready" && fees.length === 0 && <AsyncState kind="empty" label="No course fees are available yet." />}
        {status === "ready" && fees.length > 0 && (
          <div className={appUi.feeTableScroller}>
            <table className={appUi.feeTable} style={{ minWidth: `${10 + columns.length * 14 + (canAdd ? 12.5 : 0)}rem` }}>
              <caption className={appUi.srOnly}>Fees for the selected courses, {basis} students</caption>
              <colgroup>
                <col style={{ width: "10rem" }} />
                {columns.map((_, index) => <col key={index} />)}
                {canAdd && <col style={{ width: "12.5rem" }} />}
              </colgroup>
              <thead>
                <tr>
                  <td className={appUi.feeRowLabel} />
                  {columns.map((column, index) => (
                    <th className={appUi.feeHead} scope="col" key={index}>
                      {columns.length > 1 && (
                        <button className={appUi.feeRemove} type="button" aria-label={`Remove ${selected[index]?.degreeName ?? "course"}`}
                          onClick={() => setColumns((current) => current.filter((_, i) => i !== index))}>×</button>
                      )}
                      <span className={appUi.feeHeadCode}>{column.universityCode}</span>
                      <span className={appUi.feeHeadName}>{selected[index]?.degreeName ?? "Choose a course"}</span>
                    </th>
                  ))}
                  {canAdd && (
                    <th className={`${appUi.feeHead} ${appUi.feeAddCell}`} scope="col">
                      <span className={appUi.feeHeadCode}>Add</span>
                      <span className={appUi.feeHeadName}>Another course</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className={appUi.feeRowLabel} scope="row">Choose course</th>
                  {columns.map((column, index) => {
                    const listed = courseOptions(fees, column, selected[index]);
                    return (
                      <td className={appUi.feeCell} key={index}>
                        <div className={appUi.feeControls}>
                          <select className={appUi.feeControl} aria-label={`University for column ${index + 1}`} value={column.universityCode}
                            onChange={(event) => changeUniversity(index, event.target.value)}>
                            {universities.map((university) => <option key={university.code} value={university.code}>{university.name}</option>)}
                          </select>
                          <input className={appUi.feeControl} type="search" placeholder="Filter courses…" aria-label={`Filter courses for column ${index + 1}`}
                            value={column.query} onChange={(event) => changeQuery(index, event.target.value)} />
                          <select className={appUi.feeControl} aria-label={`Course for column ${index + 1}`} value={column.degreeId ?? ""}
                            onChange={(event) => updateColumn(index, { ...column, degreeId: event.target.value })}>
                            {listed.length === 0 && <option value="">No matching courses</option>}
                            {listed.map((course) => <option key={course.degreeId} value={course.degreeId}>{course.degreeName}</option>)}
                          </select>
                        </div>
                      </td>
                    );
                  })}
                  {canAdd && (
                    <td className={`${appUi.feeCell} ${appUi.feeAddCell}`}>
                      <div className={appUi.feeControls}>
                        <select className={appUi.feeControl} aria-label="University for the new column" value={addUniversityCode || suggestedUniversity}
                          onChange={(event) => setAddUniversityCode(event.target.value)}>
                          {universities.map((university) => <option key={university.code} value={university.code}>{university.name}</option>)}
                        </select>
                        <button className={appUi.primaryButton} type="button" onClick={addColumn}>Add course</button>
                      </div>
                    </td>
                  )}
                </tr>
                {rows.map((row, rowIndex) => (
                  <tr className={rowIndex % 2 === 0 ? appUi.feeRowAlt : undefined} key={row.label || "actions"}>
                    <th className={appUi.feeRowLabel} scope="row">{row.label}</th>
                    {selected.map((course, index) => (
                      <td className={appUi.feeCell} key={index}>{course ? row.render(course, index) : "—"}</td>
                    ))}
                    {canAdd && <td className={`${appUi.feeCell} ${appUi.feeAddCell}`} />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={appUi.feeNotes}>
          <p>Annual fee is each university's guide price for 48 credit points, which is one year of full-time study.</p>
          <p>Estimated total multiplies the annual fee by the course length at current rates, so real totals will be higher as fees rise each year. Honours entries of 48 CP cover the honours year only.</p>
          <p>Domestic figures are Commonwealth supported student contributions and vary with the units you take.</p>
        </div>
      </section>
    </main>
  );
};
