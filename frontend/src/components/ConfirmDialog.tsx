import { useEffect, useId, useRef } from "react";
import { appUi } from "./ui";
import { trapDialogFocus } from "./ui/dialog";
import { lockPageScroll } from "./ui/pageScroll";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  /** Styles the confirm button as destructive, e.g. for removing the custom plan. */
  danger?: boolean;
  onConfirm: () => void;
  /** Escape and clicking outside also cancel. */
  onCancel: () => void;
}

/** Asks the user to confirm an action that changes their study plan before it happens. */
export const ConfirmDialog = ({ title, message, confirmLabel, danger = false, onConfirm, onCancel }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll();
    dialog?.showModal();
    return () => {
      unlockScroll();
      dialog?.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className={appUi.confirmDialog} onKeyDown={trapDialogFocus}
      aria-labelledby={headingId} aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className={appUi.confirmDialogBody}>
        <h2 id={headingId}>{title}</h2>
        <p id={messageId}>{message}</p>
      </div>
      <div className={appUi.confirmDialogFooter}>
        <button className={appUi.secondaryButton} type="button" onClick={onCancel} autoFocus>Cancel</button>
        <button className={danger ? appUi.dangerButton : appUi.primaryButton} type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
};
