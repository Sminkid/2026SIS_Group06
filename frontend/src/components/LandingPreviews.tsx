import type { ReactNode } from "react";
import { appUi, cn } from "./ui";
import { ScoreBar, styleFor, TOP_TAGS } from "./QuizCategory";
import { LIKERT_OPTIONS } from "../domain/likertScale";
import { compareToLowest, estimatedTotal, formatAud, formatDuration, lowestOf } from "../domain/feeComparison";

/*
 * Small, decorative copies of the real pages for the landing page. They reuse the pages' own style recipes
 * and formatting so they stay in step with the real designs; update them when a page's layout changes.
 *
 * The courses, fees, rankings and employment rates are real (2026–27 fee guide, QS 2027, QILT 2025);
 * the quiz scores are examples.
 */

export const PROFILE = [
  { name: "Realistic", score: 0.88 },
  { name: "Conventional", score: 0.74 },
  { name: "Artistic", score: 0.69 },
];
const OTHER_AREAS = [
  { name: "Investigative", score: 0.52 },
  { name: "Enterprising", score: 0.41 },
  { name: "Social", score: 0.33 },
];
const percent = (score: number) => `${Math.round(score * 100)}%`;
export const HOLLAND_CODE = PROFILE.map((area) => area.name.charAt(0)).join(" – ");
export const PROFILE_NAMES = PROFILE.map((area) => area.name).join(" • ");

/** Real courses and how many of UNSW, USYD and UTS offer each one. */
export const COURSES = [
  { name: "Bachelor of Engineering (Honours)", universities: 3 },
  { name: "Bachelor of Engineering Science", universities: 2 },
  { name: "Bachelor of Design", universities: 2 },
  { name: "Bachelor of Computing", universities: 3 },
];
export const offeredBy = (count: number) => `${count} ${count === 1 ? "university offers" : "universities offer"} this`;

/** Bachelor of Engineering (Honours) at UTS (C09066) and USYD (BHENGINE-04). */
const ENGINEERING = [
  { university: "University of Technology Sydney", code: "C09066", creditPoints: 198, annualFee: 9880, world: "#87", subject: "#77", employment: "72.2%" },
  { university: "The University of Sydney", code: "BHENGINE-04", creditPoints: 192, annualFee: 9537, world: "#28", subject: "#46", employment: "74.3%" },
];

const previewCard = "grid gap-3 [padding:1.1rem] border-[1px] border-solid border-[color:var(--line)] [border-radius:var(--radius)] bg-[var(--surface)]";
const previewEyebrow = "text-[var(--blue)] text-[length:.7rem] font-extrabold [letter-spacing:.12em] uppercase";
// Mirrors the study plan's subject card, without its fixed height.
const planCard = "flex min-w-0 flex-col gap-1.5 rounded-lg border border-solid p-3 text-left";
const planLabel = "text-[10px] font-bold uppercase tracking-wide text-blue-800";

const FeeTag = ({ value, values }: { value: number; values: number[] }) => {
  const comparison = compareToLowest(value, lowestOf(values));
  if (comparison === null) return null;
  return comparison.kind === "lowest"
    ? <span className={appUi.feeTagLowest}>Lowest</span>
    : <span className={appUi.feeTagMore}>+{formatAud(comparison.difference)}</span>;
};

/** The quiz question screen. */
export const QuizPreview = () => (
  <div className={previewCard}>
    <p className={previewEyebrow}>General interests · Question 4 of 18</p>
    <p className="font-bold text-[length:1.15rem]">Building or fixing something with your hands</p>
    <p className={appUi.description}>Select how well this fits you.</p>
    <div className={appUi.quizLikertRow}>
      {LIKERT_OPTIONS.map(({ value, label }) => (
        <span className={value === 4 ? appUi.quizLikertButtonSelected : appUi.quizLikertButtonIdle} key={value}>
          <strong className={appUi.quizLikertNumber}>{value}</strong> 
          <p className={appUi.description}>{label}</p>
        </span>
      ))}
    </div>
  </div>
);

/** The quiz result page: the Holland Code, the top-3 cards and the other interest areas. */
export const ResultPreview = () => (
  <div className={previewCard}>
    <p className={previewEyebrow}>Your initial result</p>
    <p className="font-extrabold text-[length:1.15rem]">Your Holland Code Profile is</p>
    <p className="text-[var(--navy)] text-[length:2rem] font-extrabold [line-height:1.1]">{HOLLAND_CODE}</p>
    <p className="font-semibold text-[length:.85rem]">{PROFILE_NAMES}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      {PROFILE.map((area, index) => {
        const { colour, tint, icon } = styleFor(area.name);
        return (
          <div className="grid gap-1.5 [padding:.75rem] border-[1px] border-solid border-[color:var(--line)] [border-radius:14px] bg-[var(--surface)] shadow-sm" key={area.name}>
            <span className="flex items-start justify-between">
              <span className="w-8 h-8 grid place-items-center [border-radius:10px] border-[1px] border-solid [&_svg]:w-4 [&_svg]:h-4"
                style={{ color: colour, background: tint, borderColor: `${colour}33` }}>{icon}</span>
              <span className="text-[length:1.1rem] font-extrabold" style={{ color: colour }}>{percent(area.score)}</span>
            </span>
            <span className="font-bold text-[length:.8rem]">{area.name} ({area.name.charAt(0)})</span>
            <span className="text-[length:.58rem] font-extrabold [letter-spacing:.06em] uppercase" style={{ color: colour }}>{TOP_TAGS[index]}</span>
            <ScoreBar score={area.score} colour={colour} />
          </div>
        );
      })}
    </div>
    <div className="grid gap-2 text-[length:.78rem]">
      {OTHER_AREAS.map((area, index) => (
        <span className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3" key={area.name}>
          <span className="font-semibold">{PROFILE.length + index + 1}. {area.name}</span>
          <ScoreBar score={area.score} colour={styleFor(area.name).colour} />
          <span className="text-right font-bold">{percent(area.score)}</span>
        </span>
      ))}
    </div>
  </div>
);

/** One card from the course list. */
export const CourseCard = ({ name, universities }: { name: string; universities: number }) => (
  <div className={cn(appUi.degreeCard, "[padding:1rem]")}>
    <span className="font-bold text-[length:.92rem]">{name}</span>
    <span className="text-[var(--blue)] text-[length:.8rem] font-bold">{offeredBy(universities)} →</span>
  </div>
);

/** The course list after the quiz. */
export const CoursesPreview = () => (
  <div className="grid gap-3">
    <p className="text-[var(--navy)] text-[length:1.1rem] font-bold">Recommended courses</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {COURSES.map((course) => <CourseCard key={course.name} {...course} />)}
    </div>
  </div>
);

/** The university comparison table for one course. */
export const ComparisonPreview = () => {
  const fees = ENGINEERING.map((offering) => offering.annualFee);
  const totalFor = (offering: (typeof ENGINEERING)[number]) => estimatedTotal(offering.annualFee, offering.creditPoints) ?? 0;
  const totals = ENGINEERING.map(totalFor);
  const rows: Array<[label: string, render: (offering: (typeof ENGINEERING)[number]) => ReactNode]> = [
    ["Course Code", (offering) => offering.code],
    ["Duration (Full-Time)", (offering) => formatDuration(offering.creditPoints)],
    ["Annual Fee (domestic)", (offering) => <>{formatAud(offering.annualFee)} <FeeTag value={offering.annualFee} values={fees} /></>],
    ["Estimated Total", (offering) => <>{formatAud(totalFor(offering))} <FeeTag value={totalFor(offering)} values={totals} /></>],
    ["QS World Ranking", (offering) => <>{offering.world}</>],
    ["Employment Rate", (offering) => offering.employment],
  ];
  const cell = (index: number) => cn("[padding:.5rem_.35rem] shadow-sm", index % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--amber)]");
  return (
    <>
      <p className="mb-2 font-bold text-[var(--navy)]">Compare universities for Bachelor of Engineering (Honours)</p>
      <table className="w-full [border-collapse:separate] [border-spacing:.35rem] [table-layout:fixed] text-center text-[length:.76rem]">
        <thead>
          <tr>
            <td className="w-[28%]" />
            {ENGINEERING.map((offering) => (
              <th key={offering.code}>
                <div className="flex min-h-15 items-center justify-center [padding:.7rem_.4rem] border-[1px] border-solid border-[color:var(--line)] [border-radius:10px] bg-[var(--surface)] text-[length:.8rem]">{offering.university}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, render], index) => (
            <tr key={label}>
              <th className={cell(index)}>{label}</th>
              {ENGINEERING.map((offering) => <td className={cell(index)} key={offering.code}>{render(offering)}</td>)}
            </tr>
          ))}
          <tr>
            <td />
            {ENGINEERING.map((offering) => (
              <td key={offering.code}><span className={cn(appUi.viewPlanButton, "block [padding:.45rem]")}>View Study Plan</span></td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
};

const PlanSubject = ({ name, code }: { name: string; code: string }) => (
  <div className={cn(planCard, "border-slate-200 bg-white")}>
    <span className="flex items-start justify-between gap-2"><span className={planLabel}>Subject</span><span className="text-xs text-slate-600">6 CP</span></span>
    <span className="text-sm font-semibold leading-5">{name}</span>
    <span className="text-xs font-semibold text-blue-800">{code}</span>
  </div>
);

const PlanSession = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="grid gap-2">
    <p className="flex justify-between text-[length:.72rem]">
      <span className="font-bold uppercase tracking-wide text-slate-600">{name}</span>
      <span className="text-slate-600">12 CP scheduled</span>
    </p>
    <div className="grid grid-cols-2 gap-2">{children}</div>
  </div>
);

/** The first year of UTS Bachelor of Engineering (Honours), Software Engineering major. */
export const StudyPlanPreview = () => (
  <div className="grid gap-3">
    <p className="pb-2 [border-bottom:1px_solid_var(--line)] font-bold text-[length:1.15rem]">Year 1</p>
    <PlanSession name="Autumn session">
      <PlanSubject name="Mathematics 1" code="33130" />
      <PlanSubject name="Introduction to Engineering Projects" code="48230" />
    </PlanSession>
    <PlanSession name="Spring session">
      <PlanSubject name="Mathematics 2" code="33230" />
      <div className={cn(planCard, "border-dashed border-slate-400 bg-slate-50")}>
        <span className="flex items-start justify-between gap-2"><span className={planLabel}>Choice</span><span className="text-xs text-slate-600">6 CP</span></span>
        <span className="text-sm font-semibold leading-5">Elective</span>
        <span className="text-xs leading-5 text-slate-600">Choose an eligible subject</span>
      </div>
    </PlanSession>
  </div>
);

/** The glossary assistant panel. */
export const AssistantPreview = () => (
  <div className="flex flex-col overflow-hidden rounded-2xl border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)] [box-shadow:0_12px_32px_rgba(20,33,61,.12)]">
    <div className={appUi.glossaryChatHeader}>
      <span className="text-[var(--navy)] text-[length:1.1rem] font-extrabold">Assistant</span>
      <span className="text-[var(--muted)] text-[length:1.4rem] [line-height:1]">×</span>
    </div>
    <div className={appUi.glossaryChatMessages}>
      <div className={appUi.glossaryMessageUser}>
        <span className={appUi.glossaryChatMessageRole}>You</span>
        <p>What is an elective?</p>
      </div>
      <div className={appUi.glossaryMessageAssistant}>
        <span className={appUi.glossaryChatMessageRole}>Assistant</span>
        <p>An elective is a subject you choose yourself, instead of one your degree requires.</p>
      </div>
    </div>
    <div className={appUi.glossaryChatForm}>
      <span className="min-w-0 flex-1 [padding:.65rem_.75rem] border-[1px] border-solid border-[color:#bfc6d1] text-[var(--muted)] text-[length:.85rem]">
        Ask a terminology question…
      </span>
      <span className={appUi.glossaryChatSend}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </span>
    </div>
  </div>
);
