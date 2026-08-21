import type { ApiStatus } from "../hooks/useApiHealth";

interface StatusBadgeProps {
  status: ApiStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span className={`status status--${status}`}>
    <span className="status__dot" aria-hidden="true" />
    API {status}
  </span>
);

