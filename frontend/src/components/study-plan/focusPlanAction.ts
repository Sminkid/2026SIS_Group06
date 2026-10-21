/**
 * Scrolls the study plan toolbar to the top of the screen, then focuses and briefly pulses one of its buttons,
 * e.g. "Customise plan" from a read-only choice card. A mouse click leaves no visible focus ring, so the pulse
 * shows where the user landed.
 */
export const focusPlanAction = (button: HTMLButtonElement | null) => {
  if (!button) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // The page's scroll padding keeps the toolbar clear of the sticky header.
  (button.closest("[data-plan-toolbar]") ?? button).scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  button.focus({ preventScroll: true });
  if (!reduceMotion) button.animate?.([
    { boxShadow: "0 0 0 0 rgba(54, 128, 94, .55)" },
    { boxShadow: "0 0 0 12px rgba(54, 128, 94, 0)" },
  ], { duration: 900, delay: 350, iterations: 2, easing: "ease-out" });
};
