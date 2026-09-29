import { cn } from "./cn";

const feeCellBase = "[padding:1rem_1.25rem] [border-bottom:1px_solid_var(--line)] text-left align-middle";
const feeTagBase = "inline-block [padding:.15rem_.45rem] text-[length:.7rem] font-bold";

/** Static Tailwind recipes for the side-by-side course fee comparison. */
export const feeComparisonUi = {
  feeToolbar: "flex flex-wrap items-center gap-4",
  feeBasisToggle: "inline-flex border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)]",
  feeBasisButton: cn(
    "[padding:.55rem_1rem] border-0 bg-transparent text-[var(--muted)] text-[length:.85rem] font-bold cursor-pointer",
    "aria-pressed:bg-[var(--navy)] aria-pressed:text-[white]",
  ),
  feeTableScroller: "overflow-x-auto border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)]",
  feeTable: "w-full table-fixed [border-collapse:collapse] [font-variant-numeric:tabular-nums]",
  feeRowAlt: "bg-[var(--soft)]",
  feeRowLabel: cn(feeCellBase, "text-[var(--muted)] text-[length:.82rem] font-semibold"),
  feeCell: cn(feeCellBase, "[border-left:1px_solid_var(--line)]"),
  feeHead: cn(feeCellBase, "[border-left:1px_solid_var(--line)] relative align-top [padding-top:1.4rem] border-b-0 font-normal"),
  feeHeadCode: "block mb-2 text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em]",
  feeHeadName: "block pr-6 text-[length:1.05rem] font-bold [line-height:1.3]",
  feeRemove: cn(
    "absolute top-3 right-2 [padding:.25rem_.45rem] border-0 bg-transparent text-[var(--muted)]",
    "text-[length:1.1rem] [line-height:1] cursor-pointer [&:hover]:text-[var(--navy)]",
  ),
  feeControls: "grid gap-2",
  feeControl: "w-full [padding:.5rem_.6rem] border-[1px] border-solid border-[color:#bfc6d1] bg-[var(--surface)] text-[length:.85rem]",
  feeAddCell: "bg-[var(--soft)]",
  feeValue: "block font-medium",
  feeMoney: "block text-[length:1.1rem] font-bold",
  feeMissing: "text-[var(--muted)] italic",
  feeTagLowest: cn(feeTagBase, "bg-[var(--darkgreen)] [border-radius:var(--radius)] text-[white] uppercase [letter-spacing:.08em]"),
  feeTagMore: cn(feeTagBase, "border-[1px] [border-radius:var(--radius)] border-solid border-[color:var(--navy)] text-[var(--navy)]"),
  feeNotes: "grid gap-2 mt-6 max-w-168 text-[var(--muted)] text-[length:.85rem] [&_p]:m-0",
} as const;
