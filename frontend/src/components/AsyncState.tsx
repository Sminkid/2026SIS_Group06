interface AsyncStateProps { kind: "loading" | "error" | "empty"; label: string; onRetry?: () => void; }

export const AsyncState = ({ kind, label, onRetry }: AsyncStateProps) => (
  <div className={`async-state async-state--${kind}`} role={kind === "error" ? "alert" : "status"}>
    {kind === "loading" && <span className="spinner" aria-hidden="true" />}
    <p>{label}</p>
    {onRetry && <button className="secondary-button" type="button" onClick={onRetry}>Try again</button>}
  </div>
);
