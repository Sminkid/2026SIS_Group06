import { cn } from "./cn";

// The marker (dot or tick) uses the text colour, so each state recolours the label and marker together.
const quizStepBase = "flex items-center text-sm";
const likertButtonBase = "w-10 h-10 grid place-items-center border-[1px] border-solid cursor-pointer font-bold";

/** Static Tailwind recipes preserve the quiz's appearance and responsive states. */
export const quizUi = {
  quizIntro: "grid gap-4 max-w-168",
  quizProgress: "[margin:0_0_1.5rem] text-[var(--blue)] text-[length:.76rem] font-extrabold [letter-spacing:.12em] uppercase",
  quizLayout: "flex items-start gap-6 [@media(max-width:720px)]:block",
  // Vertical question list beside the question; hidden on narrow screens, where the "Question n of m" label remains.
  quizStepList: cn(
    "flex grid gap-2 m-0 list-none text-[length:.85rem] [@media(max-width:720px)]:hidden",
    "p-4 border-[1px] border-solid border-[color:var(--line)] [border-radius:var(--radius)] bg-[var(--surface)]",
  ),
  quizStepPending: cn(quizStepBase, "text-[var(--muted)]"),
  quizStepCurrent: cn(quizStepBase, "text-[#0a0a0a] font-bold"),
  quizStepAnswered: cn(quizStepBase, "text-[var(--darkgreen)]"),
  quizStepMarker: "w-3 grid place-items-center",
  quizStepDot: "w-1 h-1 rounded-full bg-current",
  quizStepTick: "font-bold [line-height:1]",
  quizStepContent: "flex items-center gap-2",
  quizStepButton: cn(
    "group flex items-center gap-2 p-0 border-0 bg-transparent [font:inherit] text-left cursor-pointer",
    "[&:disabled]:cursor-default",
  ),
  // Only the label underlines on hover, so the dot/tick marker stays clean.
  quizStepLabel: "group-hover:underline group-disabled:no-underline",
  quizQuestionWrapper: cn(
    "flex-1 min-w-0 grid gap-3 [padding:1.1rem] [margin:0_0_1.5rem] border-[1px] border-solid border-[color:var(--line)] [border-radius:var(--radius)] bg-[var(--surface)]",
  ),
  quizQuestionCard: cn(
    "grid gap-3 [margin:0_0_1.5rem] border-none bg-[var(--surface)]",
  ),
  quizQuestionText: "m-0 font-bold",
  quizLikertRow: "flex gap-5 flex-wrap mb-5",
  // Idle/selected are two complete, non-overlapping strings picked one-at-a-time - never
  // concatenate them, since two conflicting `text-[...]` utilities from separate strings
  // don't resolve in class-attribute order (Tailwind's generated-CSS order decides instead).
  quizLikertButtonIdle: cn(
    likertButtonBase,
    "border-[color:var(--line)] [border-radius:var(--radius)] bg-transparent text-[var(--navy)] [&:hover]:border-[color:var(--blue)]",
  ),
  quizLikertButtonSelected: cn(likertButtonBase, "border-[color:var(--navy)] [border-radius:var(--radius)] bg-[var(--navy)] text-[white]"),
  quizFormFooter: "flex items-center justify-between gap-4 flex-wrap",
  quizResultSection: "grid gap-8 [margin:1.5rem_0]",
  quizScoreList: cn(
    "grid grid-cols-3 gap-2 p-0 m-0 list-none [&_li]:flex [&_li]:items-baseline [&_li]:justify-between [&_li]:gap-4",
    "[&_li]:[padding:.6rem_.8rem] [&_li]:border-[1px] [&_li]:[border-radius:var(--radius)] [&_li]:border-solid [&_li]:border-[color:var(--line)]",
    "[&_li]:bg-[var(--surface)] [&_li_strong]:text-[var(--blue)] [&_li_span]:text-[var(--muted)]",
  ),
  quizRecommendationCard: cn(
    "mt-5 mb-8 [padding:1.25rem] border-[1px] border-solid border-[color:var(--line)] [border-top:3px_solid_var(--navy)]",
    "[border-radius:var(--radius)] bg-[var(--surface)] grid gap-2",
  ),
  quizCourseList: "grid [grid-template-columns:repeat(auto-fit,_minmax(16rem,_1fr))] gap-4",
} as const;
