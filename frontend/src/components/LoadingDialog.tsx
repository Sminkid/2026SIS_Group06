import { useEffect, useRef } from "react";
import { appUi } from "./ui";
import { lockPageScroll } from "./ui/pageScroll";

/** Modal pop-up shown while a blocking request runs; it can't be dismissed and closes when unmounted. */
export const LoadingDialog = ({ label }: { label: string }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const unlockScroll = lockPageScroll();
    dialog?.showModal();
    return () => {
      unlockScroll();
      dialog?.close();
    };
  }, []);

  return (
    <dialog ref={ref} aria-label={label} aria-busy="true"
      className="m-auto rounded-2xl border-0 p-0 backdrop:bg-black/40"
      onCancel={(event) => event.preventDefault()}>
      <div className="grid w-[min(22rem,85vw)] place-items-center gap-4 p-8 text-center" role="status">
        <span className={appUi.spinner} aria-hidden="true" />
        <p className="m-0 text-[var(--muted)]">{label}</p>
      </div>
    </dialog>
  );
};
