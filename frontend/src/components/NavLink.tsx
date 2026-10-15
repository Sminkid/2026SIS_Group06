import { useId } from "react";
import { appUi } from "./ui";

interface Props {
  label: string;
  /** Shown underneath on hover or keyboard focus, and read out by screen readers with the link. */
  description: string;
  onClick: () => void;
}

/** A navigation-bar link with a short pop-up explaining the page it opens. */
export const NavLink = ({ label, description, onClick }: Props) => {
  const tooltipId = useId();
  return (
    <span className={appUi.navItem}>
      <button className={appUi.textButton} type="button" onClick={onClick} aria-describedby={tooltipId}>
        {label}
      </button>
      <span className={appUi.navTooltip} id={tooltipId} role="tooltip">{description}</span>
    </span>
  );
};
