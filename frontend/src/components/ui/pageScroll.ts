let locks = 0;
let wasLocked = false;

/**
 * Locks document scrolling while a native modal is open. Reference counting
 * keeps a subject detail dialog from unlocking its underlying choice dialog.
 * The original body class is restored after the last modal closes.
 */
export function lockPageScroll(): () => void {
  if (locks++ === 0) {
    wasLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0 && !wasLocked) document.body.classList.remove("overflow-hidden");
  };
}
