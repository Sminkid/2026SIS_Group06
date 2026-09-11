import { cn } from "./cn";

const subjectPoolSelectableBase = cn(
    "subject-pool border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)] [&_>_header]:flex",
    "[&_>_header]:items-start [&_>_header]:justify-between [&_>_header]:gap-4 [&_>_header]:[padding:.9rem_1rem]",
    "[&_>_header]:[border-bottom:1px_solid_var(--line)] [&_>_header]:bg-[var(--soft)] [&_>_header_div]:grid",
    "[&_>_header_div]:gap-1 [&_>_header_span]:text-[var(--navy)] [&_>_header_span]:text-[length:.84rem]",
    "[&_>_header_span]:[font-weight:850] [&_>_header_span]:[letter-spacing:.04em] [&_>_header_span]:uppercase",
    "[&_>_header_strong]:text-[var(--muted)] [&_>_header_strong]:text-[length:.68rem] [&_>_header_p]:m-0",
    "[&_>_header_p]:text-[var(--blue)] [&_>_header_p]:text-[length:.74rem] [&_>_header_p]:font-extrabold",
    "[&_>_header_p]:whitespace-nowrap [&_>_div]:[padding:.6rem] [&_article]:[border-left:0]",
    "[&_article]:[border-right:0] [&_article]:[border-top:0] [&_article:last-child]:[border-bottom:0]",
  );
const candidateAccessBase = "[margin:.65rem_0_0] text-[length:.72rem] [line-height:1.45]";

/** Static Tailwind recipes preserve the handbook's subjectChoice appearance and responsive states. */
export const subjectChoiceUi = {
  subjectResultList: "grid [gap:.6rem] pt-4",
  subjectResult: cn(
    "subject-result grid [grid-template-columns:minmax(0,1fr)_10.5rem] items-center gap-5 p-4 border-[1px]",
    "border-solid border-[color:var(--line)] bg-[var(--surface)] [&_h3]:[margin:.25rem_0_.55rem]",
    "[&_h3]:text-[length:.92rem] [&_h3]:[line-height:1.35] [@media(max-width:720px)]:[grid-template-columns:1fr]",
    "[@media(max-width:720px)]:items-stretch",
  ),
  subjectResultMain: "min-w-0 [overflow-wrap:anywhere]",
  subjectResultCode: "subject-result__code text-[var(--blue)] text-[length:.72rem] font-extrabold",
  subjectResultMeta: "flex flex-wrap [gap:.45rem_.75rem] items-center text-[var(--muted)] text-[length:.7rem]",
  matchBadge: "[padding:.2rem_.4rem] text-[#216e4e] bg-[#e8f5ee] [font-weight:750]",
  candidateAccess: cn(candidateAccessBase, ""),
  candidateAccessSatisfied: cn(candidateAccessBase, "text-[#216e4e]"),
  candidateAccessWarning: cn(candidateAccessBase, "text-[#842c34]"),
  subjectResultActions: cn(
    "flex [flex:0_0_10.5rem] flex-col items-stretch justify-center [gap:.45rem] [&_button]:w-full",
    "[&_button]:whitespace-normal [@media(max-width:720px)]:[width:min(100%,_16rem)]",
  ),
  subjectDialog: cn(
    "[width:min(100%_-_2rem,_52rem)] max-w-none h-auto [max-height:90vh] m-auto p-0 border-0 text-[var(--navy)]",
    "bg-[var(--surface)] [box-shadow:-.5rem_0_1.75rem_rgba(20,33,61,.16)] [&::backdrop]:bg-[rgba(14,24,43,.55)]",
    "[@media(max-width:720px)]:w-full [@media(max-width:720px)]:h-auto [@media(max-width:720px)]:[max-height:92vh]",
    "[@media(max-width:720px)]:mt-auto",
  ),
  subjectDialogPanel: "[max-height:90vh] flex flex-col overflow-y-auto",
  subjectDialogHeader: cn(
    "flex items-start justify-between gap-6 p-6 [border-bottom:1px_solid_var(--line)] sticky top-0",
    "bg-[var(--surface)] [z-index:1] [&_h2]:[margin-bottom:.45rem] [&_p:last-child]:m-0",
    "[&_p:last-child]:text-[var(--muted)] [&_p:last-child]:text-[length:.85rem]",
  ),
  dialogClose: cn(
    "w-10 h-10 [flex:0_0_auto] border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)]",
    "text-[length:1.5rem] [line-height:1] cursor-pointer",
  ),
  eligibilityNoteMatched: cn(
    "[margin:1.25rem_1.5rem_0] [padding:.85rem_1rem] [border-left:3px_solid_#bd8327] text-[#225a42] bg-[#f2faf6]",
    "text-[length:.78rem] [line-height:1.5] [border-left-color:#36805e]",
  ),
  eligibilityNote: cn(
    "[margin:1.25rem_1.5rem_0] [padding:.85rem_1rem] [border-left:3px_solid_#bd8327] text-[#674a18] bg-[#fff9ed]",
    "text-[length:.78rem] [line-height:1.5]",
  ),
  subjectResultsGrouped: "min-h-0 flex-1 overflow-y-auto [padding:1rem_1.5rem_1.5rem] [&_[role]]:mt-4 grid gap-4",
  subjectPoolSelectable: cn(subjectPoolSelectableBase, "subject-pool--selectable [border-color:#9aabc3]"),
  subjectPoolContext: cn(subjectPoolSelectableBase, "[border-left:3px_solid_#8094b3]"),
  externalSubjectSearch: cn(
    "[flex:0_1_auto] [max-height:55%] overflow-y-auto [padding:1rem_1.5rem] [border-top:1px_solid_var(--line)]",
    "bg-[var(--soft)] [&_summary]:text-[var(--blue)] [&_summary]:text-[length:.8rem] [&_summary]:[font-weight:750]",
    "[&_summary]:cursor-pointer [&_>_p]:[margin:.65rem_0_0] [&_>_p]:text-[#674a18] [&_>_p]:text-[length:.75rem]",
    "[&_form]:[padding-left:0] [&_form]:[padding-right:0]",
  ),
  subjectSearch: cn(
    "grid gap-2 [padding:1.25rem_1.5rem] [border-bottom:1px_solid_var(--line)] [&_>_label]:text-[length:.78rem]",
    "[&_>_label]:[font-weight:750] [&_>_div]:grid [&_>_div]:[grid-template-columns:minmax(0,1fr)_auto]",
    "[&_input]:min-w-0 [&_input]:[padding:.75rem_.85rem] [&_input]:border-[1px] [&_input]:border-solid",
    "[&_input]:border-[color:#bfc6d1] [&_input]:[border-right:0]",
  ),
  fieldError: "m-0 text-[#9b2c35] text-[length:.75rem]",
} as const;
