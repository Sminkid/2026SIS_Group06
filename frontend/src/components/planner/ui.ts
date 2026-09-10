/** Shared utility classes keep the planner's repeated visual patterns consistent. */
export const plannerUi = {
  grid: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),15rem))] items-start gap-3",
  card: "flex min-h-60 min-w-0 w-full flex-col gap-2 rounded-lg border border-solid p-3 text-left [overflow-wrap:anywhere]",
  fixed: "border-slate-200 bg-white",
  choice: "border-dashed border-slate-400 bg-slate-50",
  selected: "border-emerald-300 bg-emerald-50/50",
  note: "m-0 text-xs leading-5 text-slate-600",
  action: "min-h-9 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2",
  primary: "min-h-10 cursor-pointer rounded border-0 bg-[#14213d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
  dialog: "m-auto w-[calc(100%-1.5rem)] max-w-3xl max-h-[90dvh] overflow-hidden rounded-xl border border-solid border-slate-200 bg-white p-0 text-[#14213d] shadow-xl backdrop:bg-slate-950/60",
  header: "shrink-0 border-0 border-b border-solid border-slate-200 p-4 sm:p-5",
  title: "m-0 text-xl font-bold leading-7 [overflow-wrap:anywhere]",
  section: "space-y-3 border-0 border-b border-solid border-slate-200 pb-5 last:border-0",
  warning: "rounded border border-solid border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-900",
  error: "rounded border border-solid border-red-300 bg-red-50 p-3 text-sm leading-5 text-red-900",
} as const;
