import { cn } from "./cn";

const cardBase = "relative flex h-[176px] w-full flex-col items-center justify-center [border-radius:18px] [padding:20px_14px_16px] text-center";
const codeTile = "grid place-items-center bg-[#E8EEFB] text-[#1d4ed8] font-extrabold";

/** Static Tailwind recipes for the comparison table's university header cards and the university picker. */
export const universityHeaderUi = {
  uniHeaderCard: cn(cardBase, "bg-[white] [border:1.5px_solid_#D9DEE7] motion-safe:[animation:pop-in_200ms_ease-out]"),
  uniLogo: "block h-[76px] w-auto max-w-[132px] object-contain",
  uniLogoFallback: cn(codeTile, "h-[76px] w-[76px] [border-radius:16px] text-[length:1rem]"),
  uniHeaderName: "mt-3 text-[length:15px] font-bold [line-height:1.25] line-clamp-2",
  uniRemove: cn(
    "absolute top-2 right-2 grid h-8 w-8 place-items-center [border-radius:8px] border-0 bg-transparent",
    "text-[#5B6475] cursor-pointer [&:hover]:bg-[#EEF3FD]",
  ),
  uniAddSlot: cn(
    cardBase, "gap-4 [border:1.5px_dashed_#B8C0CC] bg-transparent cursor-pointer",
    "font-bold text-[length:15px] [&:hover]:bg-[#EEF3FD]",
  ),
  uniAddIcon: "grid h-14 w-14 place-items-center [border-radius:999px] bg-[#E8EEFB] text-[#2563eb] text-[length:1.6rem] font-normal",
  uniVariantSelect: "mt-2 block w-full rounded border border-solid border-[color:var(--line)] p-1 text-xs font-normal",
  uniPickerSearch: cn(
    "flex items-center gap-2 [padding:.65rem_.9rem] [border:1.5px_solid_#D9DEE7] [border-radius:12px] text-[var(--muted)]",
    "[&:focus-within]:[border-color:#2563eb] [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#0a0a0a]",
  ),
  uniPickerList: "m-0 grid max-h-80 gap-1 overflow-y-auto p-0 list-none",
  uniPickerOption: cn(
    "flex w-full min-h-[52px] items-center gap-3 [padding:.4rem_.6rem] border-0 [border-radius:12px] bg-transparent",
    "text-left cursor-pointer [&:hover]:bg-[#EEF3FD] [&:focus-visible]:bg-[#EEF3FD]",
  ),
  uniOptionTile: "grid h-10 w-10 shrink-0 place-items-center [border-radius:8px] bg-[white]",
  uniOptionLogo: "block h-9 w-9 object-contain",
  uniOptionFallback: cn(codeTile, "h-10 w-10 [border-radius:8px] text-[length:.6rem]"),
} as const;
