import { cn } from "./cn";

const asyncStateBase = cn(
    "min-h-48 grid place-items-center content-center gap-4 p-8 border-[1px] border-solid",
    "border-[color:var(--line)] text-center [&_p]:m-0",
  );
const textButtonBase = "[padding:.7rem_.35rem] border-0 bg-transparent font-bold cursor-pointer [&:hover]:underline";

/** Static Tailwind recipes preserve the handbook's common appearance and responsive states. */
export const commonUi = {
  skipLink: cn(
    "skip-link fixed [z-index:100] [top:.65rem] [left:.65rem] [padding:.7rem_1rem] text-[white] bg-[var(--navy)]",
    "[font-weight:750] [transform:translateY(-160%)] [&:focus]:[transform:translateY(0)]",
  ),
  asyncStateError: cn(asyncStateBase, "text-[#8c2e35] bg-[#fffafa] [border-color:#e8c7ca]"),
  asyncState: cn(asyncStateBase, "text-[var(--muted)] bg-[var(--surface)]"),
  spinner: cn(
    "w-7 h-7 border-[2px] border-solid border-[color:var(--line)] [border-top-color:var(--blue)] rounded-full",
    "animate-spin [animation-duration:750ms] motion-reduce:animate-none",
  ),
  secondaryButton: "[padding:.65rem_1rem] border-[1px] border-solid border-[color:currentColor] bg-transparent cursor-pointer",
  stepLabel: "[margin:0_0_.8rem] text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em] uppercase",
  sectionHeading: cn(
    "w-fit flex flex-col mt-15 gap-5 bg-[var(--surface)] shadow-md [padding:2rem] rounded-2xl",
    "[@media(max-width:720px)]:items-stretch [@media(max-width:720px)]:flex-col [@media(max-width:720px)]:gap-5",
  ),
  sectionRow: "flex flex-row gap-2 items-center [&_p]:m-0",
  checkMark: "w-5 h-5",
  sectionNote: "[margin:-.75rem_0_2rem] text-[var(--muted)]",
  selectionNotice: "selection-notice [border-left:3px_solid_var(--warning,_#b86b00)] [margin:0_0_1rem] [padding:0.65rem_0.8rem] bg-[#fff8e8]",
  textButtonDanger: cn(textButtonBase, "text-[#9b2c35]"),
  primaryButton: cn(
    "[padding:.7rem_1rem] [border-radius:var(--radius)] border-none bg-[var(--mint)]",
    "font-bold cursor-pointer [&:hover]:bg-[var(--green)]",
  ),
  textButton: cn(textButtonBase, "text-[var(--blue)]"),
  eyebrow: "[margin:0_0_.8rem] text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em] uppercase",
  lead: "text-[var(--muted)] text-[length:clamp(1rem,_2vw,_1.2rem)] [line-height:1.7]",
  contentSection: "pt-8 [border-top:2px_solid_var(--line)]",
  degreeTools: cn(
    "flex items-center justify-between gap-8 mb-8 [&_p]:[margin-bottom:.45rem]",
    "[@media(max-width:720px)]:items-stretch [@media(max-width:720px)]:flex-col [@media(max-width:720px)]:gap-5",
  ),
  muted: "text-[var(--muted)] font-medium",
  srOnly: "sr-only",
} as const;
