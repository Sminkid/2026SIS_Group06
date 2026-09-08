import type { KeyboardEvent } from "react";

/** Wraps Tab at the visible modal controls; native dialogs still own Escape and inertness. */
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== "Tab") return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])",
  )).filter(control => control.getClientRects().length > 0 && !control.closest("[inert]"));
  const first = controls[0], last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
