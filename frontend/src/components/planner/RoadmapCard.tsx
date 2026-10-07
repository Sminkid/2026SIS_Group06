import { cn } from "../ui";
import type { StudyPlanItem } from "../../types/handbook";
import type { ValidationResult } from "../../types/validation";
import type { PrerequisiteDisplayState } from "../../domain/prerequisiteDisplay";
import { readableText } from "../../domain/readableText";
import { plannerUi as ui } from "./ui";

interface Props {
  item: StudyPlanItem; editable: boolean; scheduled?: string; issues: ValidationResult[];
  readOnlyChoiceNote?: string;
  prerequisite?: PrerequisiteDisplayState;
  onChoose: (item: StudyPlanItem) => void;
  onOpenSubject: (code: string, issues: ValidationResult[]) => void;
  onRestoreChoice: (id: string) => void; onSwap?: (id: string) => void;
  onMove?: (id: string) => void;
  showReadOnlyDetails?: boolean;
}

/** Renders a bounded summary; full enrolment explanations live in subject details. */
function PrerequisiteSummary({ state }: { state: PrerequisiteDisplayState }) {
  if (["none", "satisfied", "checking"].includes(state.kind)) return null;
  return <p className={cn("prerequisite-summary m-0 text-xs leading-5", state.kind === "unmet" || state.kind === "late" ? "text-amber-900" : "text-slate-600")}>
    {state.label}
  </p>;
}

/**
 * Displays one allocation at its current schedule position. Card size is shared
 * by fixed, empty and selected states; only compact actions and status change.
 */
export function RoadmapCard({ item, editable, scheduled, issues, prerequisite, readOnlyChoiceNote,
  onChoose, onOpenSubject, onRestoreChoice, onSwap, onMove, showReadOnlyDetails }: Props) {
  const placement = /\b(internship|placement|practicum|professional experience)\b/i.test(`${item.title} ${item.choiceOrigin?.title ?? ""}`);
  const fixedCore = item.choiceOrigin?.componentRequirementKind === "FIXED";
  const filled = Boolean(item.choiceOrigin && item.subject && !fixedCore);
  const choice = item.itemType === "CHOICE" || filled;
  const interactive = choice && !placement;
  const name = readableText(item.subject?.name ?? item.title);
  const code = item.subject?.code ?? item.rawCode;
  const points = item.subject?.creditPoints ?? item.creditPoints;
  const source = `${item.choiceOrigin?.sourceLabel ?? item.choiceOrigin?.title ?? "Official study plan"} ${item.choiceOrigin?.allocatedGroupLabel ?? ""}`.trim();
  const showDetails = () => { if (code) onOpenSubject(code, issues); };
  const secondaryIssue = issues.some(issue => !["PREREQUISITE_TIMING", "COREQUISITE_TIMING"].includes(issue.code) && issue.severity !== "info");
  return <article data-planner-item-id={item.id} className={cn("plan-item", interactive ? "plan-item--choice" : "", filled ? "plan-item--filled" : "", ui.card, filled ? ui.selected : interactive ? ui.choice : ui.fixed)}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-800">{placement ? "Professional placement" : filled ? "Selected subject" : choice ? "Choice" : "Subject"}</span>
      {points !== null && <span className="shrink-0 text-xs text-slate-600">{points} CP</span>}
    </div>
    {editable && interactive ? <button className="plan-item__main-action cursor-pointer bg-transparent text-inherit border-0 p-0 text-left hover:text-blue-800" type="button" onClick={() => onChoose(item)}>
      <h5 className="m-0 line-clamp-3 text-sm font-semibold leading-5" title={name}>{name}</h5>
    </button> : <h5 className="m-0 line-clamp-3 text-sm font-semibold leading-5" title={name}>{name}</h5>}
    {code && <p className="m-0 text-xs font-semibold text-blue-800">{code}</p>}
    {scheduled && <p className={cn("plan-item__note", ui.note)}>Scheduled: {scheduled}</p>}
    {item.choiceOrigin && <p className={cn("plan-item__note line-clamp-2", ui.note)} title={`Counts toward: ${source}`}>Counts toward: {source}</p>}
    {!item.subject && interactive && <p className={cn("plan-item__note", ui.note)}>{!editable && readOnlyChoiceNote
      ? readOnlyChoiceNote
      : item.choiceOrigin?.componentRequirementKind === "COMPONENT" ? "Choose a required Core or eligible Option" : "Choose an eligible subject"}</p>}
    {prerequisite && <PrerequisiteSummary state={prerequisite} />}
    {secondaryIssue && <p className="m-0 text-xs text-amber-900">Plan requirement needs review</p>}
    {!editable && showReadOnlyDetails && item.subject && <button className={ui.action} type="button" onClick={showDetails}>View requirements</button>}
    {editable && <div className="mt-auto flex flex-wrap items-center gap-1 border-0 border-t border-solid border-slate-200 pt-2">
      {interactive && <button className={ui.action} type="button" onClick={() => onChoose(item)}>{filled ? "Change" : "Choose"}</button>}
      {filled && !placement && onSwap && <button className={ui.action} type="button" aria-label="Swap position" onClick={() => onSwap(item.id)}>Swap</button>}
      {item.subject && onMove && <button className={ui.action} type="button" aria-label="Move subject" onClick={() => onMove(item.id)}>Move</button>}
      {filled && !placement && <button className={cn(ui.action, "text-red-800")} type="button" aria-label="Remove subject & restore choice" onClick={() => onRestoreChoice(item.id)}>Remove</button>}
      {item.subject && <button className={ui.action} type="button" onClick={showDetails}>View requirements</button>}
    </div>}
  </article>;
}
