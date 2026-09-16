import { cn } from "./cn";

const plannerToolbarBase = cn(
    "flex items-center justify-between gap-8 mb-10 p-5 border-[1px] border-solid border-[color:var(--line)]",
    "[&_strong]:block [&_strong]:[margin-bottom:.35rem] [&_p]:max-w-180 [&_p]:m-0 [&_p]:text-[var(--muted)]",
    "[&_p]:text-[length:.82rem] [&_p]:[line-height:1.5] [@media(max-width:720px)]:items-stretch",
    "[@media(max-width:720px)]:flex-col [@media(max-width:720px)]:gap-4",
  );
const readOnlyLabelBase = cn(
    "[padding:.35rem_.65rem] border-[1px] border-solid border-[color:var(--line)] text-[length:.7rem]",
    "font-extrabold [letter-spacing:.08em] uppercase",
  );

/** Static Tailwind recipes preserve the handbook's studyPlan appearance and responsive states. */
export const studyPlanUi = {
  studyPlansSection: "[margin-top:clamp(4rem,_8vw,_7rem)] pt-8 [border-top:2px_solid_var(--navy)]",
  readOnlyLabelCustom: cn(readOnlyLabelBase, "text-[#216e4e] bg-[#f2faf6] [border-color:#9bc8b4]"),
  readOnlyLabel: cn(readOnlyLabelBase, "text-[var(--muted)] bg-[var(--surface)]"),
  planSelector: cn(
    "plan-selector grid [&_select]:min-w-0 [&_select]:w-full [gap:.45rem] max-w-168 [margin:0_0_2rem]",
    "text-[var(--muted)] text-[length:.8rem] font-bold [&_select]:[padding:.8rem_2.5rem_.8rem_.85rem]",
    "[&_select]:border-[1px] [&_select]:border-solid [&_select]:border-[color:#bfc6d1]",
    "[&_select]:text-[var(--navy)] [&_select]:bg-[var(--surface)]",
  ),
  planIntro: cn(
    "plan-intro max-w-232 mb-8 [&_h3]:[margin:0_0_.75rem] [&_h3]:text-[length:1.05rem] [&_h3]:[line-height:1.5]",
    "[&_p]:text-[var(--muted)] [&_p]:[line-height:1.65]",
  ),
  planSourceTitle: cn(
    "max-w-192 text-[var(--muted)] text-[length:.8rem] [&_summary]:w-fit [&_summary]:text-[var(--blue)]",
    "[&_summary]:font-bold [&_summary]:cursor-pointer [&_p]:[margin:.75rem_0_0] [&_p]:[padding:.85rem_1rem]",
    "[&_p]:[border-left:2px_solid_#aebbd0] [&_p]:bg-[var(--soft)] [&_p]:text-[length:.78rem]",
    "[&_p]:[overflow-wrap:anywhere]",
  ),
  plannerToolbarActive: cn(plannerToolbarBase, "bg-[#f5fbf8] [border-color:#9bc8b4]"),
  plannerToolbar: cn(plannerToolbarBase, "bg-[var(--surface)]"),
  plannerToolbarActions: "flex flex-wrap justify-end [gap:.65rem] shrink-0 [@media(max-width:720px)]:justify-start",
  roadmapBasis: cn(
    "grid gap-1 [margin:1rem_0] [padding:0.85rem_1rem] border-[1px] border-solid border-[color:var(--line)]",
    "[border-radius:0.75rem] bg-[var(--soft)] [&_strong]:text-[length:1rem] [&_span]:text-[var(--muted)]",
  ),
  plannerPlanColumn: "min-w-0",
  sessionHelp: cn(
    "mb-4 [padding:.8rem_1rem] border-[1px] border-solid border-[color:var(--line)] bg-[var(--soft)]",
    "[&_summary]:text-[var(--blue)] [&_summary]:text-[length:.8rem] [&_summary]:[font-weight:750]",
    "[&_summary]:cursor-pointer [&_dl]:grid [&_dl]:[gap:.4rem] [&_dl_div]:grid",
    "[&_dl_div]:[grid-template-columns:5rem_1fr] [&_dl_div]:[gap:.7rem] [&_dt]:[font-weight:750] [&_dd]:m-0",
    "[&_dd]:text-[var(--muted)] [&_dd]:text-[length:.75rem] [&_dd]:[line-height:1.45] [&_p]:m-0",
    "[&_p]:text-[var(--muted)] [&_p]:text-[length:.75rem] [&_p]:[line-height:1.45]",
  ),
  planPeriodEmpty: "p-4 text-[var(--muted)] border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)]",
  unassignedSection: cn(
    "mt-14 p-5 border-[1px] border-dashed border-[color:#9aa9bf] bg-[#f5f7fa] [&_>_div:first-child]:mb-4",
    "[&_h3]:[margin:0_0_.4rem] [&_>_div:first-child_>_p:last-child]:m-0",
    "[&_>_div:first-child_>_p:last-child]:text-[var(--muted)]",
    "[&_>_div:first-child_>_p:last-child]:text-[length:.78rem]",
  ),
} as const;
