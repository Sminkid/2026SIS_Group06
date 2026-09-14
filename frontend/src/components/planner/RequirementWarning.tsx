import { cn } from "../ui";
import type { PrerequisiteDisplayState } from "../../domain/prerequisiteDisplay";
import { plannerUi as ui } from "./ui";

/** Shows a data-quality warning only for missing or unresolved prerequisite data. */
export function RequirementWarning({ state, year, university, sourceUrl }: {
  state: PrerequisiteDisplayState; year: number; university: string; sourceUrl?: string | null;
}) {
  if (state.kind !== "unavailable") return null;
  const safeUrl = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;
  return <aside role="alert" className={cn("requirement-warning", ui.error)}>
    <h4 className="mb-2 mt-0 text-sm font-bold">Prerequisite information unavailable</h4>
    <p className="my-2">Complete prerequisite details are not available in the current dataset. Verify this subject in the official {university} handbook before finalising the plan.</p>
    <ul className="my-2 list-disc space-y-1 pl-5">{state.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    {state.rawText.map(text => <p className="my-2 whitespace-pre-wrap [overflow-wrap:anywhere]" key={text}>Handbook reference: {text}</p>)}
    <p className="mb-0 mt-2">Handbook year: {year}{safeUrl && <> · <a className="underline text-blue-800" href={safeUrl} target="_blank" rel="noreferrer">Official subject source</a></>}</p>
  </aside>;
}
