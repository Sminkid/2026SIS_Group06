import { cn } from "./cn";

const asyncStateBase = cn(
    "min-h-48 grid place-items-center content-center gap-4 p-8",
    "border-none text-center [&_p]:m-0",
  );
const textButtonBase = "[padding:.7rem_.35rem] border-0 bg-transparent font-bold cursor-pointer [&:hover]:underline";

/** Static Tailwind recipes preserve the handbook's common appearance and responsive states. */
export const commonUi = {
  skipLink: cn(
    "skip-link fixed [z-index:100] [top:.65rem] [left:.65rem] [padding:.7rem_1rem] text-[white] bg-[var(--navy)]",
    "[font-weight:750] [transform:translateY(-160%)] [&:focus]:[transform:translateY(0)]",
  ),
  asyncStateError: cn(asyncStateBase, "text-[#8c2e35]"),
  asyncState: cn(asyncStateBase, "text-[var(--muted)]"),
  spinner: cn(
    "w-7 h-7 border-[2px] border-solid border-[color:var(--line)] [border-top-color:var(--blue)] rounded-full",
    "animate-spin [animation-duration:750ms] motion-reduce:animate-none",
  ),
  // Outlined companion to primaryButton, e.g. "Select", "Reset to official plan", "Try again".
  secondaryButton: cn(
    "[padding:.6rem_1rem] [border-radius:var(--radius)] border-[1px] border-solid [border-color:var(--line)] bg-[var(--surface)]",
    "text-[#0a0a0a] font-bold cursor-pointer [&:hover:not(:disabled)]:[border-color:var(--navy)] [&:hover:not(:disabled)]:text-[var(--navy)]",
    "[&:disabled]:opacity-50 [&:disabled]:cursor-not-allowed",
  ),
  stepLabel: "[margin:0_0_.8rem] text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em] uppercase",
  sectionHeading: cn(
    "flex items-end justify-between gap-8 mb-8 [&_p]:[margin-bottom:.45rem]",
    "[@media(max-width:720px)]:items-stretch [@media(max-width:720px)]:flex-col [@media(max-width:720px)]:gap-5",
  ),
  subheading: cn(
    "w-fit flex flex-col mt-15 gap-5 bg-[var(--surface)] shadow-md [padding:2rem] rounded-2xl",
    "[@media(max-width:720px)]:items-stretch [@media(max-width:720px)]:flex-col [@media(max-width:720px)]:gap-5",
  ),
  sectionRow: "flex flex-row gap-2 items-center [&_p]:m-0",
  checkMark: "w-5 h-5",
  sectionNote: "[margin:-.75rem_0_2rem] text-[var(--muted)]",
  // Information banner on degree and course lists, e.g. which study plans are complete.
  // Amber study plan coverage warning: icon, bold heading and explanation, like the pathway condition note but stronger.
  coverageNotice: cn(
    "coverage-notice flex items-start gap-3 [margin:1.25rem_0_0] [padding:.9rem_1.1rem] border-[1px] border-solid",
    "[border-color:#f0c97a] [border-left:4px_solid_#b86b00] bg-[#fff6e0] text-[#5c3d0b]",
    "[&_svg]:shrink-0 [&_svg]:mt-[.1rem] [&_svg]:text-[#b86b00] [&_strong]:block [&_strong]:text-[#4a3108]",
    "[&_strong]:text-[length:.95rem] [&_strong]:font-extrabold [&_p]:[margin:.2rem_0_0] [&_p]:text-[length:.88rem] [&_p]:[line-height:1.55]",
  ),
  // Confirms a study plan action such as Reset or Exit custom mode; same shape as the pathway condition note, in green.
  actionNotice: cn(
    "action-notice flex items-center gap-2 [margin:0_0_1.25rem] [padding:.85rem_1rem] [border-left:3px_solid_#36805e]",
    "bg-[#f2faf6] text-[#225a42] text-[length:.92rem] font-semibold [line-height:1.5]",
  ),
  selectionNotice: "selection-notice [border-left:3px_solid_var(--warning,_#b86b00)] [margin:0_0_1rem] [padding:0.65rem_0.8rem] bg-[#fff8e8]",
  textButtonDanger: cn(textButtonBase, "text-[#9b2c35]"),
  primaryButton: cn(
    "min-w-30 [padding:.7rem_1rem] [border-radius:var(--radius)] border-none bg-[var(--mint)] text-[#0a0a0a]",
    "font-bold cursor-pointer [&:hover:not(:disabled)]:bg-[var(--green)]",
    "[&:disabled]:opacity-50 [&:disabled]:cursor-not-allowed",
  ),
  // Filled red button for confirming destructive actions, e.g. "Exit custom mode".
  dangerButton: cn(
    "min-w-30 [padding:.7rem_1rem] [border-radius:var(--radius)] border-none bg-[#9b2c35] text-white",
    "font-bold cursor-pointer [&:hover:not(:disabled)]:bg-[#7f222a] [&:disabled]:opacity-50 [&:disabled]:cursor-not-allowed",
  ),
  // Small confirmation pop-up, e.g. before resetting or clearing a custom study plan.
  confirmDialog: cn(
    "[width:min(100%_-_2rem,_28rem)] max-w-none h-fit m-auto p-0 border-0 bg-[var(--surface)] text-[#0a0a0a]",
    "[box-shadow:0_1rem_2.5rem_rgba(20,33,61,.18)] [&::backdrop]:bg-[rgba(14,24,43,.55)]",
  ),
  confirmDialogBody: cn(
    "[padding:1.5rem_1.5rem_1.25rem] [&_h2]:[margin:0_0_.6rem] [&_h2]:text-[#0a0a0a] [&_h2]:text-[length:1.25rem]",
    "[&_p]:m-0 [&_p]:text-[var(--muted)] [&_p]:text-[length:.92rem] [&_p]:[line-height:1.6]",
  ),
  confirmDialogFooter: "flex flex-wrap justify-end gap-3 [padding:1rem_1.5rem] [border-top:1px_solid_var(--line)]",
  viewPlanButton: cn(
    "w-full [padding:.7rem] [border-radius:var(--radius)] border-none bg-[var(--mint)]",
    "font-bold cursor-pointer [&:hover]:bg-[var(--green)]",
  ),
  cancelButton: cn(
    "[padding:.7rem_1rem] [border-radius:var(--radius)] border border-[color:var(--line)] bg-[var(--line)]",
    "font-bold cursor-pointer [&:hover]:bg-white",
  ),
  closeButton: cn(
    "bg-transparent border-none cursor-pointer",
    "absolute right-2 top-2 text-[color:var(--muted)]",
  ),
  textButton: cn(textButtonBase, "text-[var(--blue)]"),
  backButton: cn(
    "min-w-30 [padding:.7rem_1rem]",
    "border-[1px] [border-radius:var(--radius)] border-solid [border-color:var(--line)] bg-[var(--surface)]",
    "font-bold cursor-pointer [&:hover]:bg-[var(--line)]",
  ),
  eyebrow: "[margin:0_0_.8rem] text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em] uppercase",
  lead: "text-[var(--muted)] text-[length:clamp(1rem,_2vw,_1.2rem)] [line-height:1.7]",
  contentSection: "mt-8 p-4 [border-top:2px_solid_var(--line)]",
  degreeTools: cn(
    "flex items-center justify-between gap-8 mb-8 [&_p]:[margin-bottom:.45rem]",
    "[@media(max-width:720px)]:items-stretch [@media(max-width:720px)]:flex-col [@media(max-width:720px)]:gap-5",
  ),
  muted: "text-[var(--muted)] font-medium",
  srOnly: "sr-only",
  tableWrapper: "w-full overflow-x-auto overscroll-x-contain",
  comparisonTable: cn(
    "w-full min-w-[700px] table-fixed text-center",
    "border-separate border-spacing-x-2 border-spacing-y-4",
    "[&_th]:p-0 [&_td]:p-0",
    // A 1px cell height lets each cell's content box use h-full and stretch to the row's tallest cell.
    "[&_th]:h-px [&_td]:h-px",
  ),
  uniInfo: cn(
    "flex flex-row justify-center items-center gap-2",
    "h-full min-w-[200px] p-3 text-base align-middle",
    "bg-[var(--surface)] shadow-sm",
  ),

  uniInfoAlt: cn(
    "flex flex-row justify-center items-center gap-2",
    "h-full min-w-[200px] p-3 text-base align-middle",
    "bg-[var(--amber)] shadow-sm",
  ),
  buttonContainer: "flex flex-row justify-between",
  description: "m-0 text-xs text-[var(--muted)]",
} as const;
