import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { appUi, cn } from "./ui";

interface Props {
  label: string;
  /** Shown underneath on hover or keyboard focus, and read out by screen readers with the link. */
  description: string;
  onClick: () => void;
}

/** Below this width the nav links fill their own row and each pop-up spans that row instead. */
const PHONE_QUERY = "(max-width: 560px)";

/** A navigation-bar link with a short pop-up explaining the page it opens. */
export const NavLink = ({ label, description, onClick }: Props) => {
  const tooltipId = useId();
  const itemRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  // The pop-up lines up with the link's left edge, unless that would run past the right edge of the screen.
  const [alignRight, setAlignRight] = useState(false);

  const updateAlignment = useCallback(() => {
    const item = itemRef.current;
    const tooltip = tooltipRef.current;
    if (!item || !tooltip || window.matchMedia(PHONE_QUERY).matches) { setAlignRight(false); return; }
    setAlignRight(item.getBoundingClientRect().left + tooltip.offsetWidth > document.documentElement.clientWidth);
  }, []);

  // Before the first paint, so an overflowing pop-up never widens the page; again once web fonts shift the links.
  useLayoutEffect(() => {
    updateAlignment();
    void document.fonts?.ready.then(updateAlignment);
    window.addEventListener("resize", updateAlignment);
    return () => window.removeEventListener("resize", updateAlignment);
  }, [updateAlignment]);

  return (
    <span className={appUi.navItem} ref={itemRef} onPointerEnter={updateAlignment} onFocus={updateAlignment}>
      <button className={appUi.textButton} type="button" onClick={onClick} aria-describedby={tooltipId}>
        {label}
      </button>
      <span className={cn(appUi.navTooltip, alignRight ? "right-0" : "left-0")} ref={tooltipRef} id={tooltipId} role="tooltip">
        {description}
      </span>
    </span>
  );
};
