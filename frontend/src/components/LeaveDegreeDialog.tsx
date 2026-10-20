import { useEffect, useRef } from "react";
import { appUi } from "./ui";
import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";

interface Props {
  /** Clears the page and continues to where the user was going. */
  onConfirm: () => void;
  /** Cancels leaving; Escape does the same. */
  onStay: () => void;
}

/** Warns that leaving the degree page resets its course structure choices and study plan. */
export const LeaveDegreeDialog = ({ onConfirm, onStay }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);

  useEffect(() => {
    const dialog = ref.current;
    const unlockScroll = lockPageScroll();
    dialog?.showModal();
    return () => {
      unlockScroll();
      dialog?.close();
      returnFocus.current?.focus();
    };
  }, []);

  return (
    <dialog ref={ref} onKeyDown={trapDialogFocus} aria-labelledby="leave-degree-heading" aria-describedby="leave-degree-description"
      className="m-auto rounded-2xl border-0 p-0 backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); onStay(); }}>
      <div className="flex w-[min(28rem,90vw)] flex-col gap-4 p-6">
        <p id="leave-degree-heading" className="m-0 text-lg font-bold">Leaving resets this page</p>
        <p id="leave-degree-description" className={appUi.description}>
          Your course structure choices and study plan changes aren&apos;t saved. If you leave or refresh, this degree
          page starts again from the official handbook.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={appUi.primaryButton} onClick={onStay}>Stay on this page</button>
          <button type="button" className={appUi.secondaryButton} onClick={onConfirm} autoFocus>Leave</button>
        </div>
      </div>
    </dialog>
  );
};
