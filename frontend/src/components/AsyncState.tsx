import { appUi } from "./ui";
interface AsyncStateProps { kind: "loading" | "error" | "empty"; label: string; onRetry?: () => void; }

/** Announces loading, error or empty content and exposes a retry action when available. */
export const AsyncState = ({ kind, label, onRetry }: AsyncStateProps) => (
  <div className={kind === "error" ? appUi.asyncStateError : appUi.asyncState} role={kind === "error" ? "alert" : "status"}>
    {kind === "loading" && <span className={appUi.spinner} aria-hidden="true" />}
    <p>{label}</p>
    {onRetry && <button className={appUi.secondaryButton} type="button" onClick={onRetry}>Try again</button>}
  </div>
);
