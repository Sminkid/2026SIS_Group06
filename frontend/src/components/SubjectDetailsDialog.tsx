import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";
import { appUi, cn } from "./ui";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { fetchSubjectAccessConditions, fetchSubjectDetail } from "../api/subjects";
import type {
  SubjectAccessConditionGroup,
  SubjectAccessConditions,
  SubjectDetail,
} from "../types/subject";
import type { ValidationResult } from "../types/validation";
import { getPrerequisiteDisplayState, requirementIssueText } from "../domain/prerequisiteDisplay";
import { RequirementWarning } from "./planner/RequirementWarning";
import { plannerUi as ui } from "./planner/ui";
import { AsyncState } from "./AsyncState";

interface Props {
  subjectCode: string | null;
  universityCode: string;
  handbookYear: number;
  onClose: () => void;
  planIssues?: ValidationResult[];
  hasPlan?: boolean;
}

/** Resolves a readable label without exposing storage identifiers. */
const referencedLabel = (
  item: SubjectAccessConditionGroup["items"][number],
): string | null => {
  if (item.referencedSubject) return `${item.referencedSubject.code} · ${item.referencedSubject.name}`;
  if (item.referencedComponent) return `${item.referencedComponent.code} · ${item.referencedComponent.name}`;
  if (item.referencedDegree) return `${item.referencedDegree.code} · ${item.referencedDegree.name}`;
  return null;
};

interface ConditionReference {
  key: string;
  label: string;
  details: string | null;
}

/** Produces unique user-facing references without exposing imported item IDs. */
export const conditionReferences = (group: SubjectAccessConditionGroup): ConditionReference[] => {
  const references = new Map<string, ConditionReference>();
  for (const item of group.items) {
    const label = referencedLabel(item);
    const details = item.details.trim();
    const fallback = details && details !== group.rule?.trim() ? details : null;
    const value = label ?? fallback;
    if (!value) continue;
    const key = item.referencedSubject?.code
      ?? item.referencedComponent?.code
      ?? item.referencedDegree?.code
      ?? value;
    if (!references.has(key)) references.set(key, { key, label: value, details: label && fallback ? fallback : null });
  }
  return [...references.values()];
};

/** Shows each logical expression once, followed by unique resolved references. */
export const ConditionGroups = ({
  groups,
  emptyLabel,
}: {
  groups: SubjectAccessConditionGroup[];
  emptyLabel: string;
}) => groups.length === 0
  ? <p className="m-0 text-sm text-slate-600">{emptyLabel}</p>
  : <div className="condition-groups grid gap-3">{groups.map((group) => {
      const references = conditionReferences(group);
      return <section className="overflow-hidden rounded border border-solid border-slate-200" key={group.id}>
        <div className="grid gap-2 border-0 border-b border-solid border-slate-200 bg-slate-50 p-3 text-sm [overflow-wrap:anywhere]">
          <span>Logical rule</span>
          <code>{group.rule ?? "No machine-readable rule supplied"}</code>
        </div>
        {references.length > 0 && <div className="p-3 text-sm leading-6">
          <strong>Referenced subjects and requirements</strong>
          <ul className="mb-0 mt-2 list-disc pl-5">
            {references.map((reference) => <li key={reference.key}>{reference.label}
              {reference.details && <p className="mb-2 mt-1 whitespace-pre-wrap text-slate-600">{reference.details}</p>}
            </li>)}
          </ul>
        </div>}
      </section>;
    })}</div>;

interface OfferingView { key: string; fields: Array<{ label: string; value: string }> }
/** Selects human-readable offering fields while leaving imported content unchanged. */
const offeringViews = (offerings: unknown): OfferingView[] => {
  if (!Array.isArray(offerings)) return [];
  const labels: Array<[string, string]> = [
    ["mode", "Mode"], ["location", "Location"], ["teaching_period", "Session"], ["year", "Year"],
    ["student_types", "Student eligibility"], ["start_date", "Start date"], ["end_date", "End date"],
  ];
  return offerings.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const fields = labels.flatMap(([key, label]) => typeof record[key] === "string" && record[key].trim()
      ? [{ label, value: record[key].trim() }] : []);
    const language = record.language_of_instruction;
    if (language && typeof language === "object" && !Array.isArray(language)) {
      const label = (language as Record<string, unknown>).label;
      if (typeof label === "string" && label.trim()) fields.push({ label: "Language", value: label.trim() });
    }
    return fields.length > 0 ? [{ key: `${String(record.location ?? "offering")}-${String(record.teaching_period ?? index)}-${index}`, fields }] : [];
  });
};

/** Adds data-quality context while retaining the full subject, rule and offering details. */
export const SubjectDetailsDialog = ({
  subjectCode,
  universityCode,
  handbookYear,
  onClose,
  planIssues = [],
  hasPlan = false,
}: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [conditions, setConditions] = useState<SubjectAccessConditions | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const prerequisite = getPrerequisiteDisplayState(conditions, planIssues, { loading: status === "loading", hasPlan });
  const readableOfferings = offeringViews(detail?.offerings);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (subjectCode && dialog && !dialog.open) dialog.showModal();
    if (!subjectCode && dialog?.open) dialog.close();
  }, [subjectCode]);

  useEffect(() => {
    if (!subjectCode) return;
    const controller = new AbortController();
    setStatus("loading"); setDetail(null); setConditions(null);
    void Promise.all([
      fetchSubjectDetail(subjectCode, universityCode, handbookYear, controller.signal),
      fetchSubjectAccessConditions(subjectCode, universityCode, handbookYear, controller.signal).catch(() => null),
    ]).then(([subject, accessConditions]) => {
      if (controller.signal.aborted) return;
      setDetail(subject); setConditions(accessConditions); setStatus("ready");
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    });
    return () => controller.abort();
  }, [handbookYear, subjectCode, universityCode]);

  useEffect(() => {
    if (!subjectCode) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockScroll = lockPageScroll();
    return () => { unlockScroll(); trigger?.focus(); };
  }, [subjectCode]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return <dialog onKeyDown={trapDialogFocus}
    className={cn("subject-detail-dialog", ui.dialog)}
    ref={dialogRef}
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose}
    onClick={closeFromBackdrop}
  >
    <div className="flex max-h-[88dvh] flex-col">
      <header className={cn(ui.header, "flex items-start justify-between gap-3")}>
        <div><p className={appUi.eyebrow}>Subject details</p><h2 className={ui.title} id={titleId}>{detail?.name ?? subjectCode}</h2>
          {detail && <p><strong>{detail.code}</strong>{detail.creditPoints !== null && ` · ${detail.creditPoints} CP`}</p>}</div>
        <button className={cn(ui.action, "shrink-0 text-xl")} type="button" aria-label="Close subject details" onClick={onClose}>×</button>
      </header>
      <div className="min-h-0 space-y-5 overflow-y-auto p-4 sm:p-5">
        {status === "loading" && <AsyncState kind="loading" label="Loading subject details" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load this subject's details." />}
        {status === "error" && <RequirementWarning state={prerequisite} year={handbookYear} university={universityCode} />}
        {status === "ready" && detail && <>
          {planIssues.filter(issue => !["PREREQUISITE_TIMING", "COREQUISITE_TIMING"].includes(issue.code) && issue.severity !== "info").map((issue, index) =>
            <p className={ui.warning} key={`${issue.code}-${index}`}>{requirementIssueText(issue.message)}</p>)}
          <section className={ui.section}><h3 className="m-0 text-base font-bold">About this subject</h3>
            <p>{detail.description ?? "No description is available in this handbook."}</p></section>
          <section className={ui.section}><h3 className="m-0 text-base font-bold">Prerequisite and corequisite conditions</h3>
            <RequirementWarning state={prerequisite} year={handbookYear} university={universityCode} sourceUrl={detail.sourceUrl} />
            {(prerequisite.kind === "unmet" || prerequisite.kind === "late") && <aside className={cn("requirement-unmet", ui.warning)}><strong>{prerequisite.label}</strong>
              {planIssues.filter(issue => issue.code.includes("REQUISITE")).map((issue, index) => <p className="mb-0 mt-2" key={`${issue.code}-${index}`}>{requirementIssueText(issue.message)}</p>)}
            </aside>}
            {prerequisite.kind === "satisfied" && <p className="m-0 text-sm text-emerald-800">Prerequisites satisfied</p>}
            <p className="m-0 rounded bg-blue-50 p-3 text-sm leading-6 text-slate-700">Rules are shown exactly as supplied. Resolved handbook references are listed once below each rule; no AND/OR logic has been simplified.</p>
            <ConditionGroups groups={conditions?.requisiteGroups ?? []} emptyLabel="No requisite groups are listed." />
          </section>
          <section className={ui.section}><h3 className="m-0 text-base font-bold">Anti-requisites and exclusions</h3>
            <ConditionGroups groups={conditions?.antiRequisiteGroups ?? []} emptyLabel="No anti-requisites or exclusions are listed." />
          </section>
          <section className={ui.section}><h3 className="m-0 text-base font-bold">Offering information</h3>
            {readableOfferings.length > 0
              ? <div className="grid gap-3">{readableOfferings.map((offering) => <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] rounded border border-solid border-slate-200 bg-slate-50" key={offering.key}>{offering.fields.map((field) => <div className="p-3" key={field.label}><dt className="text-xs font-semibold text-slate-600">{field.label}</dt><dd className="m-0 min-w-0 p-3 text-sm leading-6 [overflow-wrap:anywhere]">{field.value}</dd></div>)}</dl>)}</div>
              : <p>No offering information is available in this handbook.</p>}
          </section>
        </>}
      </div>
    </div>
  </dialog>;
};
