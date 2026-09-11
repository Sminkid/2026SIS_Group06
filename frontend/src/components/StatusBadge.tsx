import type { ApiStatus } from "../hooks/useApiHealth";

interface StatusBadgeProps {
  status: ApiStatus;
}

const statusClasses: Record<ApiStatus, string> = {
  checking: "text-[var(--muted)]",
  online: "text-[#216e4e]",
  offline: "text-[#9b2c35]",
};

/** Presents API health when embedded by a host view; no network request is made here. */
export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span className={`inline-flex items-center gap-2 text-sm ${statusClasses[status]}`}>
    <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
    API {status}
  </span>
);
