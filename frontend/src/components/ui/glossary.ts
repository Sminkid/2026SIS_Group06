import { cn } from "./cn";

const glossaryMessageAssistantBase = cn(
    "flex flex-col [gap:.3rem] [padding:.75rem_.9rem] border-[1px] border-solid border-[color:var(--line)]",
    "text-[length:.85rem] [line-height:1.55] [&_p]:m-0 [&_p]:whitespace-pre-wrap",
  );

/** Static Tailwind recipes preserve the handbook's glossary appearance and responsive states. */
export const glossaryUi = {
  glossaryChatToggle: cn(
    "glossary-chat__toggle fixed [right:1.5rem] [bottom:1.5rem] [z-index:60] [padding:.85rem_1.35rem] border-[1px]",
    "border-solid border-[color:var(--navy)] text-[#fff] bg-[var(--navy)] [font-weight:750] cursor-pointer",
    "[box-shadow:0_8px_20px_rgba(20,33,61,.25)] [&:hover]:bg-[var(--blue)] [&:hover]:[border-color:var(--blue)]",
  ),
  glossaryChat: cn(
    "z-30 sticky top-0 self-start [height:100vh] shrink-0 [width:min(24rem,_100vw)] flex flex-col",
    "[border-left:1px_solid_var(--line)] bg-[var(--surface)] [box-shadow:-12px_0_32px_rgba(20,33,61,.14)]",
    "[@media(max-width:720px)]:fixed [@media(max-width:720px)]:inset-0 [@media(max-width:720px)]:[width:100vw]",
    "[@media(max-width:720px)]:h-dvh",
  ),
  glossaryChatHeader: cn(
    "flex items-start justify-between gap-4 [padding:1.25rem_1.25rem_1rem] [border-bottom:1px_solid_var(--line)]",
    "[&_h2]:m-0 [&_h2]:text-[length:1.1rem]",
  ),
  glossaryChatClose: cn(
    "[padding:0_.35rem] border-0 text-[var(--muted)] bg-transparent text-[length:1.4rem] [line-height:1]",
    "cursor-pointer [&:hover]:text-[var(--navy)]",
  ),
  glossaryChatMessages: "flex-1 overflow-y-auto p-5 flex flex-col gap-4",
  glossaryChatEmpty: "m-0 text-[var(--muted)] text-[length:.85rem] [line-height:1.6]",
  glossaryMessageUser: cn(glossaryMessageAssistantBase, "bg-[#eaf0fb] self-end [max-width:88%] [border-color:#c9d7ef] [&_>_span]:text-[var(--blue)]"),
  glossaryMessageError: cn(glossaryMessageAssistantBase, "bg-[#fdeceb] [border-color:#e6b3ad] text-[#a10000] [&_>_span]:text-[#a10000]"),
  glossaryMessageAssistant: cn(glossaryMessageAssistantBase, "bg-[var(--soft)] self-start [max-width:88%]"),
  glossaryChatMessageRole: "text-[var(--muted)] text-[length:.65rem] font-extrabold [letter-spacing:.08em] uppercase",
  glossaryMessagePending: cn(glossaryMessageAssistantBase, "bg-[var(--soft)] self-start [max-width:88%] [&_>_p]:text-[var(--muted)] [&_>_p]:italic"),
  glossaryChatForm: cn(
    "flex items-center [gap:.6rem] [padding:1rem_1.25rem] [border-top:1px_solid_var(--line)] bg-[var(--surface)]",
    "[&_textarea]:min-w-0 [&_textarea]:flex-1 [&_textarea]:resize-none [&_textarea]:[padding:.65rem_.75rem]",
    "[&_textarea]:border-[1px] [&_textarea]:border-solid [&_textarea]:border-[color:#bfc6d1]",
    "[&_textarea]:text-[var(--navy)] [&_textarea]:bg-[var(--soft)] [&_textarea]:[font:inherit]",
  ),
  glossaryChatSend: cn(
    "grid place-items-center shrink-0 w-10 h-10 border-[1px] border-solid border-[color:var(--navy)] rounded-full",
    "text-[#fff] bg-[var(--navy)] cursor-pointer [&:hover:not(:disabled)]:bg-[var(--blue)]",
    "[&:hover:not(:disabled)]:[border-color:var(--blue)] [&:disabled]:[opacity:.55]",
    "[&:disabled]:cursor-not-allowed",
  ),
  glossaryChatSpinner: cn(
    "w-4 h-4 border-[2px] border-solid border-[color:rgba(255,255,255,.4)] [border-top-color:#fff] rounded-full",
    "animate-spin [animation-duration:700ms] motion-reduce:animate-none",
  ),
} as const;
