import { cn } from "./cn";

// The marker (dot or tick) uses the text colour, so each state recolours the label and marker together.
const quizStepBase = "flex items-center text-sm";
// Same card as the landing page's example answers: the number on top, its meaning underneath.
const likertButtonBase = cn(
  "grid content-center gap-1 min-h-16 [padding:.65rem_.25rem] border-[1px] border-solid [border-radius:.75rem]",
  "[font:inherit] text-[length:.8rem] [@media(max-width:480px)]:text-[length:.68rem] [line-height:1.2] text-center cursor-pointer min-w-0",
);

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
  quizQuestionText: "m-0 font-bold text-xl",
  quizLikertRow: "grid grid-cols-5 gap-2 max-w-[34rem] mb-5",
  quizLikertNumber: "block text-[length:1rem] font-medium",
  // Idle/selected are two complete, non-overlapping strings picked one-at-a-time - never
  // concatenate them, since two conflicting `text-[...]` utilities from separate strings
  // don't resolve in class-attribute order (Tailwind's generated-CSS order decides instead).
  quizLikertButtonIdle: cn(
    likertButtonBase,
    "border-[color:var(--line)] bg-[white] text-[#111827] [&:hover]:border-[color:#2563eb]",
  ),
  quizLikertButtonSelected: cn(likertButtonBase, "border-[color:#2563eb] bg-[#eff4ff] text-[#1d4ed8]"),
  quizFormFooter: "flex items-center justify-between gap-4 flex-wrap",
  quizResultSection: "grid gap-8 [margin:1.5rem_0]",
  // Result page: the Holland Code heading, the top-3 cards and the bars for the remaining areas.
  // Per-category colours are set inline from the page, since they depend on the result.
  quizHollandCode: "m-0 [margin-top:.25rem] text-[var(--navy)] text-[length:clamp(2.5rem,10vw,4rem)] font-extrabold [line-height:1.3] [letter-spacing:.08em]",
  quizHollandNames: "m-0 [margin:.75rem_0_.5rem] font-semibold text-[length:1.05rem]",
  quizBreakdown: cn(
    "grid gap-5 [padding:1.5rem] border-[1px] border-solid border-[color:var(--line)] [border-radius:var(--radius)] bg-[var(--surface)]",
    "[&_h2]:m-0",
  ),
  quizTopList: "grid gap-4 p-0 m-0 list-none md:grid-cols-3",
  quizTopCard: cn(
    "flex flex-col gap-2 [padding:1.25rem] border-[1px] border-solid border-[color:var(--line)] [border-radius:var(--radius)]",
    "bg-[var(--surface)] shadow-sm",
  ),
  quizTopCardHeader: "flex items-start justify-between gap-3 mb-2",
  quizTopIcon: "w-11 h-11 grid place-items-center [border-radius:12px] border-[1px] border-solid",
  quizTopPercent: "text-[length:1.6rem] font-extrabold [line-height:1]",
  quizTopName: "m-0 p-0 font-bold text-[length:1.05rem]",
  quizTopTag: "m-0 text-[length:.72rem] font-extrabold [letter-spacing:.06em] uppercase",
  quizTopDescription: "m-0 flex-1 text-[var(--muted)] text-[length:.85rem]",
  quizBarTrack: "block w-full h-2 [border-radius:999px] bg-[#e5e7eb] overflow-hidden",
  quizBar: "block h-full [border-radius:999px]",
  quizOtherHeading: "m-0 p-0 text-[length:1.05rem]",
  quizOtherList: "grid gap-4 p-0 m-0 list-none",
  // On phones the bar drops below the name and percentage, spanning both columns.
  quizOtherRow: cn(
    "grid items-center gap-x-4 gap-y-2 [grid-template-columns:minmax(8rem,12rem)_1fr_3.5rem]",
    "[@media(max-width:480px)]:[grid-template-columns:1fr_3.5rem]",
  ),
  quizOtherBar: "[@media(max-width:480px)]:order-last [@media(max-width:480px)]:col-span-2",
  quizOtherName: "font-semibold",
  quizOtherPercent: "text-right font-bold",
  quizRecommendationCard: cn(
    "mt-5 mb-8 [padding:1.25rem] border-[1px] border-solid border-[color:var(--line)] [border-top:3px_solid_var(--navy)]",
    "[border-radius:var(--radius)] bg-[var(--surface)] grid gap-2",
  ),
  quizCourseList: "grid [grid-template-columns:repeat(auto-fit,_minmax(16rem,_1fr))] gap-4",
  // Back/Next sit adjacent (not spread to opposite ends like appUi.buttonContainer) so the
  // cursor doesn't have to travel across the row between them.
  quizQuestionNav: "flex flex-row gap-3",
  // Deliberately plain/quiet - a text link, not a real button, so it doesn't compete with
  // Back/Next for attention. Skipping isn't something we want to encourage.
  quizSkipButton: cn(
    "block self-start mt-2 p-0 border-none bg-transparent cursor-pointer text-left",
    "text-[length:.8rem] text-[var(--muted)] underline [&:hover]:text-[var(--navy)]",
  ),
} as const;
