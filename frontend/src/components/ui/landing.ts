import { cn } from "./cn";

const container = "[width:min(100%_-_2rem,_74rem)] [margin:0_auto]";
// cn only joins classes, so the card shape leaves the border colour to each recipe.
const cardShape = "border-[1px] border-solid bg-[white] [border-radius:.75rem]";
const card = cn(cardShape, "border-[color:#dbe3f0]");
const ctaBase = cn(
  "inline-flex items-center justify-center gap-2 [padding:.85rem_1.25rem] [border-radius:.5rem]",
  "font-bold cursor-pointer no-underline",
);

/** Static Tailwind recipes for the UniXPrep landing page. Muted text uses #4b5563 to stay well above 4.5:1 on the tinted background. */
export const landingUi = {
  landing: "bg-[#f4f7fe] text-[#111827] [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]",
  landingHero: cn(container, "grid gap-12 [padding:3.5rem_0_4rem] md:grid-cols-2 md:items-center"),
  landingPill: cn(
    "inline-block [margin:0_0_1.5rem] [padding:.3rem_.75rem] border-[1px] border-solid border-[color:#2563eb]",
    "[border-radius:999px] text-[#1d4ed8] text-[length:.8rem] font-semibold",
  ),
  landingTitle: "[margin:0_0_1.5rem] text-[#2563eb] text-[length:clamp(2.5rem,5vw,3.75rem)] [line-height:1.05] [letter-spacing:-.04em]",
  landingLead: "max-w-xl [margin:0_0_2rem] text-[#374151] text-[length:1.15rem] [line-height:1.6]",
  landingActions: "flex flex-wrap items-center gap-5",
  landingPrimary: cn(ctaBase, "border-0 bg-[#a7f3d0] text-[#064e3b] [&:hover]:bg-[#86efac]"),
  landingSecondary: cn(ctaBase, "border-[1px] border-solid border-[color:#2563eb] bg-[white] text-[#1d4ed8] [&:hover]:bg-[#eff4ff]"),
  landingLink: "p-0 border-0 bg-transparent text-[#1d4ed8] font-bold cursor-pointer no-underline [&:hover]:underline",
  landingNote: "[margin:1rem_0_0] text-[#4b5563] text-[length:.85rem]",
  landingMuted: "m-0 text-[#4b5563] text-[length:.85rem]",
  landingCard: cn(card, "grid gap-3 p-6 [&_p]:m-0"),
  landingShortcut: cn(card, "flex flex-wrap items-center justify-between gap-4 mt-8 [padding:1rem_1.25rem] [&_p]:m-0"),
  landingVisual: "grid gap-4",
  landingScores: "grid gap-3 sm:grid-cols-3",
  landingCode: "text-[#2563eb] text-[length:2.5rem] font-extrabold [letter-spacing:.05em]",
  landingEyebrow: "[margin:0_0_.75rem] text-[#2563eb] text-[length:.75rem] font-extrabold [letter-spacing:.12em] uppercase",
  landingBand: "bg-[white] [border-top:1px_solid_#dbe3f0] [border-bottom:1px_solid_#dbe3f0]",
  landingSection: cn(container, "[padding:4.5rem_0]"),
  landingSectionTitle: "[margin:0_0_.5rem] text-[#2563eb] text-[length:clamp(1.9rem,4vw,2.6rem)] [line-height:1.1] [letter-spacing:-.03em]",
  landingBody: "m-0 text-[#374151] [line-height:1.6]",
  landingFeatures: "grid gap-4 mt-8 sm:grid-cols-3",
  landingStep: "grid gap-10 [padding:2.5rem_0] md:grid-cols-2 md:items-center",
  landingStepTitle: "[margin:0_0_.75rem] text-[length:1.6rem] [letter-spacing:-.02em]",
  // Previews of the app's pages use the app's own font, so they look like the real screens.
  landingMock: "p-5 [border-radius:1rem] bg-[#eef3fd] [&_p]:m-0 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]",
  landingPreview: "[&_p]:m-0 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]",
  landingStats: "grid gap-4 mt-8 sm:grid-cols-3",
  landingStat: cn(card, "p-5 [&_strong]:block [&_strong]:text-[#2563eb] [&_strong]:text-[length:2rem] [&_strong]:[line-height:1.15]"),
  landingFooter: cn(
    container,
    "flex flex-wrap justify-between gap-4 [padding:2rem_0] [border-top:1px_solid_#dbe3f0] text-[#4b5563] text-[length:.85rem]",
  ),
} as const;
