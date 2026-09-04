import { useEffect, useRef, useState, type MouseEvent } from "react";
import { fetchSubjectAccessConditions, fetchSubjectDetail } from "../api/subjects";
import type {
  SubjectAccessConditionGroup,
  SubjectAccessConditions,
  SubjectDetail,
} from "../types/subject";
import { AsyncState } from "./AsyncState";

interface Props {
  subjectCode: string | null;
  universityCode: string;
  handbookYear: number;
  onClose: () => void;
}

const referencedLabel = (
  item: SubjectAccessConditionGroup["items"][number],
): string | null => {
  if (item.referencedSubject) return `${item.referencedSubject.code} · ${item.referencedSubject.name}`;
  if (item.referencedComponent) return `${item.referencedComponent.code} · ${item.referencedComponent.name}`;
  if (item.referencedDegree) return `${item.referencedDegree.code} · ${item.referencedDegree.name}`;
  return null;
};

const ConditionGroups = ({
  groups,
  emptyLabel,
}: {
  groups: SubjectAccessConditionGroup[];
  emptyLabel: string;
}) => groups.length === 0
  ? <p className="condition-empty">{emptyLabel}</p>
  : <div className="condition-groups">{groups.map((group) => (
      <section className="condition-group" key={group.id}>
        <div className="condition-rule">
          <span>Logical rule</span>
          <code>{group.rule ?? "No machine-readable rule supplied"}</code>
        </div>
        <dl className="condition-items">
          {group.items.map((item) => {
            const reference = referencedLabel(item);
            return <div className="condition-item" key={item.id}>
              <dt>{item.itemKey}</dt>
              <dd>
                {item.requisiteType && <span className="condition-type">{item.requisiteType}</span>}
                <p>{item.details}</p>
                {reference && <small>Resolved reference: {reference}</small>}
              </dd>
            </div>;
          })}
        </dl>
      </section>
    ))}</div>;

interface OfferingView { key: string; fields: Array<{ label: string; value: string }> }
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

export const SubjectDetailsDialog = ({
  subjectCode,
  universityCode,
  handbookYear,
  onClose,
}: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [conditions, setConditions] = useState<SubjectAccessConditions | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
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
      fetchSubjectAccessConditions(subjectCode, universityCode, handbookYear, controller.signal),
    ]).then(([subject, accessConditions]) => {
      setDetail(subject); setConditions(accessConditions); setStatus("ready");
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    });
    return () => controller.abort();
  }, [handbookYear, subjectCode, universityCode]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return <dialog
    className="subject-detail-dialog"
    ref={dialogRef}
    aria-labelledby="subject-detail-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose}
    onClick={closeFromBackdrop}
  >
    <div className="subject-detail-dialog__panel">
      <header className="subject-detail-dialog__header">
        <div><p className="eyebrow">Subject details</p><h2 id="subject-detail-title">{detail?.name ?? subjectCode}</h2>
          {detail && <p><strong>{detail.code}</strong>{detail.creditPoints !== null && ` · ${detail.creditPoints} CP`}</p>}</div>
        <button className="dialog-close" type="button" aria-label="Close subject details" onClick={onClose}>×</button>
      </header>
      <div className="subject-detail-dialog__body">
        {status === "loading" && <AsyncState kind="loading" label="Loading subject details" />}
        {status === "error" && <AsyncState kind="error" label="We couldn't load this subject's details." />}
        {status === "ready" && detail && conditions && <>
          <section className="subject-detail-section"><h3>About this subject</h3>
            <p>{detail.description ?? "No description is available in this handbook."}</p></section>
          <section className="subject-detail-section"><h3>Prerequisite and corequisite conditions</h3>
            <p className="condition-guidance">Rules are shown exactly as supplied. Item keys map to the condition details below; no AND/OR logic has been simplified.</p>
            <ConditionGroups groups={conditions.requisiteGroups} emptyLabel="No requisite groups are listed." />
          </section>
          <section className="subject-detail-section"><h3>Anti-requisites and exclusions</h3>
            <ConditionGroups groups={conditions.antiRequisiteGroups} emptyLabel="No anti-requisites or exclusions are listed." />
          </section>
          <section className="subject-detail-section"><h3>Offering information</h3>
            {readableOfferings.length > 0
              ? <div className="offering-list">{readableOfferings.map((offering) => <dl key={offering.key}>{offering.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>)}</div>
              : <p>No offering information is available in this handbook.</p>}
          </section>
        </>}
      </div>
    </div>
  </dialog>;
};
