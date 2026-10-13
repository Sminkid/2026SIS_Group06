import { cn } from "./cn";

/** Static Tailwind recipes preserve the handbook's studyPath appearance and responsive states. */
export const studyPathUi = {
  studyPathField: cn(
    "grid [grid-template-columns:minmax(10rem,_.45fr)_minmax(14rem,_1fr)] gap-4 items-center",
    "[&_>_span]:text-[var(--blue)] [&_>_span]:text-[length:.85rem] [&_>_span]:[font-weight:750]",
    "[&_>_span]:capitalize [&_select]:min-w-0 [&_select]:w-full [&_select]:[padding:.75rem_2rem_.75rem_.8rem]",
    "[&_select]:border-[1px] [&_select]:border-solid [&_select]:border-[color:#bfc6d1]",
    "[&_select]:bg-[var(--surface)]",
    "[@media(max-width:720px)]:[grid-template-columns:1fr] [@media(max-width:720px)]:[gap:.4rem]",
  ),
  pathPreview: cn(
    "[border-bottom:1px_solid_var(--line)] bg-[var(--surface)] [&:last-child]:[border-bottom:0] [&_summary]:flex",
    "[&_summary]:justify-between [&_summary]:gap-4 [&_summary]:[padding:.8rem_1rem] [&_summary]:cursor-pointer",
    "[&_summary_span]:text-[length:.82rem] [&_summary_span]:font-bold [&_summary_strong]:text-[var(--muted)]",
    "[&_summary_strong]:text-[length:.72rem] [&_summary_strong]:whitespace-nowrap",
  ),
  pathPreviewBody: cn(
    "[padding:0_1rem_1rem] [&_>_p]:[margin:.4rem_0_.8rem] [&_>_p]:text-[var(--muted)] [&_>_p]:text-[length:.75rem]",
    "[&_>_p]:[line-height:1.5]",
  ),
  broadRequirement: "[padding:.7rem_.8rem] [border-left:3px_solid_var(--blue)] bg-[#f4f7fc]",
  pathPreviewSubjects: cn(
    "grid [gap:.35rem] p-0 [margin:.6rem_0_0] list-none [&_li]:grid",
    "[&_li]:[grid-template-columns:5rem_minmax(0,1fr)_auto] [&_li]:gap-3 [&_li]:[padding:.55rem_.7rem]",
    "[&_li]:border-[1px] [&_li]:border-solid [&_li]:border-[color:var(--line)] [&_li]:text-[length:.75rem]",
    "[&_li_strong]:text-[var(--blue)] [&_li_small]:text-[var(--muted)]",
    "[@media(max-width:720px)]:[&_li]:[grid-template-columns:4.5rem_minmax(0,1fr)]",
    "[@media(max-width:720px)]:[&_li_small]:[grid-column:2]",
  ),
  selectedPathPreview: "selected-path-preview mt-4 border-[1px] border-solid border-[color:var(--line)] bg-[var(--soft)]",
  selectedPathPreviewHeading: cn(
    "flex justify-between gap-4 [padding:.9rem_1rem] [border-bottom:1px_solid_var(--line)]",
    "[&_span]:text-[var(--muted)] [&_span]:text-[length:.78rem]",
  ),
  selectedPathPreviewEmpty: "m-0 [padding:.9rem_1rem] text-[var(--muted)] text-[length:.78rem]",
  componentPlacementProgress: "[padding:12px] bg-[#eff6ff] [border-radius:8px]",
  selectedPathPreviewState: cn(
    "m-0 [padding:.9rem_1rem] text-[var(--muted)] text-[length:.78rem] mt-3 border-[1px] border-solid",
    "border-[color:var(--line)] bg-[var(--soft)]",
  ),
  pathDecision: "[padding:1.25rem_0] [border-top:1px_solid_var(--line)] [&:last-child]:[padding-bottom:0]",
  pathwaySelections: cn(
    "path-decision__detail grid gap-4 [&_h3]:m-0 [&_h3]:text-[length:1rem] [margin:1rem_0_0_min(18rem,_28%)]",
    "[@media(max-width:720px)]:ml-0",
  ),
  electiveAllocation: cn(
    "p-4 [border-left:3px_solid_var(--blue)] bg-[var(--soft)] [&_p]:[margin:.4rem_0_0] [&_p]:text-[var(--muted)]",
    "[&_p]:text-[length:.8rem] [&_p]:[line-height:1.5]",
  ),
  pathwaySelection: "pathway-selection min-w-0",
  studyPathPlanner: cn(
    "study-path [margin:0_0_2rem] p-6 border-[1px] border-solid border-[color:#b9c5d7]",
    "[border-top:3px_solid_var(--navy)] bg-[var(--surface)] [&_h2]:text-[length:1.5rem] [&_h2]:text-[color:inherit]",
    "[@media(max-width:720px)]:[margin-top:-1rem] [@media(max-width:720px)]:[padding:1.1rem]",
  ),
  studyPathContext: "[margin:.5rem_0_1.5rem] text-[var(--muted)] text-[length:.82rem]",
  pathDecisionDetail: "path-decision__detail [margin:1rem_0_0_min(18rem,_28%)] [@media(max-width:720px)]:ml-0",
  requiredPathway: "required-pathway [padding:12px] bg-[#eff6ff] [border-radius:8px]",
  pathCondition: cn(
    "[margin:.8rem_0_0_min(18rem,_28%)] [padding:.75rem_.9rem] [border-left:3px_solid_#bd8327] text-[#674a18]",
    "bg-[#fff9ed] text-[length:.75rem] [line-height:1.5] [@media(max-width:720px)]:ml-0",
  ),
} as const;
