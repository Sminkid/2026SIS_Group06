import type { ReactNode } from "react";
import { appUi } from "./ui";

/** Colours, icons and rank tags for the RIASEC categories, shared by the quiz result page and the landing preview. */
export const TOP_TAGS = ["Dominant strength", "High affinity", "Strong interest"];

interface CategoryStyle { colour: string; tint: string; icon: ReactNode }

const icon = (paths: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);

/** Colour and icon per RIASEC category, keyed by its lower-cased name. */
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  realistic: {
    colour: "#15803d", tint: "#ecfdf3",
    icon: icon(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  },
  investigative: {
    colour: "#7c3aed", tint: "#f5f3ff",
    icon: icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  },
  artistic: {
    colour: "#c2410c", tint: "#fff7ed",
    icon: icon(<><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="12" cy="7" r="1" /><circle cx="16.5" cy="10.5" r="1" /></>),
  },
  social: {
    colour: "#be185d", tint: "#fdf2f8",
    icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  },
  enterprising: {
    colour: "#0f766e", tint: "#f0fdfa",
    icon: icon(<><path d="M22 7 13.5 15.5 8.5 10.5 2 17" /><path d="M16 7h6v6" /></>),
  },
  conventional: {
    colour: "#1d4ed8", tint: "#eff6ff",
    icon: icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /></>),
  },
};
const FALLBACK_STYLE: CategoryStyle = { colour: "#2457a7", tint: "#f7f8fa", icon: icon(<circle cx="12" cy="12" r="8" />) };
export const styleFor = (categoryName: string) => CATEGORY_STYLES[categoryName.toLowerCase()] ?? FALLBACK_STYLE;


export const ScoreBar = ({ score, colour }: { score: number; colour: string }) => (
  <span className={appUi.quizBarTrack} aria-hidden="true">
    <span className={appUi.quizBar} style={{ width: `${Math.round(score * 100)}%`, background: colour }} />
  </span>
);

