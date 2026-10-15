import { useState } from "react";
import { appUi } from "./ui";
import type { University } from "../types/handbook";

/** Logos live in public/logos as <code>.png (e.g. public/logos/unsw.png), so a new university only needs a file. */
const logoSrc = (code: string) => `/logos/${code.toLowerCase()}.png`;

interface Props {
  university: University;
  /** "card" is the 76px comparison header logo; "option" is the 36px picker logo, shown beside the name. */
  size?: "card" | "option";
}

/** The university's logo, or its short code in a same-size tile when there's no file or it fails to load. */
export const UniversityLogo = ({ university, size = "card" }: Props) => {
  const src = logoSrc(university.code);
  // Remembers which file failed, so switching to another university tries its logo afresh.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    return <span className={size === "card" ? appUi.uniLogoFallback : appUi.uniOptionFallback} aria-hidden="true">{university.code}</span>;
  }
  return (
    <img
      className={size === "card" ? appUi.uniLogo : appUi.uniOptionLogo}
      src={src}
      alt={size === "card" ? `${university.name} logo` : ""}
      onError={() => setFailedSrc(src)}
    />
  );
};
