import { cn } from "./cn";

const likertButtonBase = "w-10 h-10 grid place-items-center border-[1px] border-solid cursor-pointer font-bold";

/** Static Tailwind recipes preserve the quiz's appearance and responsive states. */
export const quizUi = {
  quizIntro: "grid gap-4 max-w-168",
  quizProgress: "[margin:0_0_1.5rem] text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em] uppercase",
  quizQuestionCard: cn(
    "grid gap-3 [padding:1.1rem] [margin:0_0_1.5rem] border-[1px] border-solid border-[color:var(--line)] bg-[var(--surface)]",
  ),
  quizQuestionText: "m-0 font-bold text-[var(--navy)]",
  quizLikertRow: "flex gap-2 flex-wrap",
  // Idle/selected are two complete, non-overlapping strings picked one-at-a-time - never
  // concatenate them, since two conflicting `text-[...]` utilities from separate strings
  // don't resolve in class-attribute order (Tailwind's generated-CSS order decides instead).
  quizLikertButtonIdle: cn(
    likertButtonBase,
    "border-[color:var(--line)] bg-transparent text-[var(--navy)] [&:hover]:border-[color:var(--blue)]",
  ),
  quizLikertButtonSelected: cn(likertButtonBase, "border-[color:var(--navy)] bg-[var(--navy)] text-[white]"),
  quizFormFooter: "flex items-center justify-between gap-4 flex-wrap",
  quizResultSection: "grid gap-8 [margin:1.5rem_0]",
  quizScoreList: cn(
    "grid gap-2 p-0 m-0 list-none [&_li]:flex [&_li]:items-baseline [&_li]:justify-between [&_li]:gap-4",
    "[&_li]:[padding:.6rem_.8rem] [&_li]:border-[1px] [&_li]:border-solid [&_li]:border-[color:var(--line)]",
    "[&_li]:bg-[var(--surface)] [&_li_strong]:text-[var(--navy)] [&_li_span]:text-[var(--muted)]",
  ),
  quizRecommendationCard: cn(
    "[padding:1.25rem] border-[1px] border-solid border-[color:var(--line)] [border-top:3px_solid_var(--navy)]",
    "bg-[var(--surface)] grid gap-2",
  ),
} as const;
