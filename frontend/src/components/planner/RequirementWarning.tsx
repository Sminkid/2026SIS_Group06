import { cn } from "../ui";
import type { PrerequisiteDisplayState } from "../../domain/prerequisiteDisplay";
import { plannerUi as ui } from "./ui";

/** Shows a neutral data-coverage notice for missing or unresolved prerequisite data. */
export function RequirementWarning({ state, year, university, sourceUrl }: {
  state: PrerequisiteDisplayState; year: number; university: string; sourceUrl?: string | null;
}) {
  if (state.kind !== "unavailable" && state.kind !== "review") return null;
  const safeUrl = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;
  return <aside role="status" className={cn("requirement-information", ui.info)}>
    <h4 className="mb-2 mt-0 text-sm font-bold">Prerequisite information</h4>
    <p className="my-2">{state.kind === "review"
      ? `Some prerequisite conditions require manual verification against the official ${university} handbook.`
      : `Prerequisite information is not available in the current dataset. Check the official ${university} handbook when planning enrolment.`}</p>
    <ul className="my-2 list-disc space-y-1 pl-5">{state.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    {state.rawText.map(text => <p className="my-2 whitespace-pre-wrap [overflow-wrap:anywhere]" key={text}>Handbook reference: {text}</p>)}
    <p className="mb-0 mt-2">Handbook year: {year}{safeUrl && <> · <a className="underline text-blue-800" href={safeUrl} target="_blank" rel="noreferrer">Official subject source</a></>}</p>
  </aside>;
}
