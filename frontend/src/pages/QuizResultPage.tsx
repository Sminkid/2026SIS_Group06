import type { ReactNode } from "react";
import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatScorePercent } from "../domain/quizResult";
import type { QuizCategorySummary, QuizResult } from "../domain/quizRecommendation";

interface Props {
  result: QuizResult;
  onViewCourses: () => void;
  /** Continues the same quiz session with the fine-tuning questions (initial results only). */
  onPersonalise: () => void;
  onRetake: () => void;
  onHome: () => void;
  /** Set when the quiz was launched from a degree page. */
  onBackToDegree?: () => void;
}

const TOP_DESCRIBED = 3;
const TOP_TAGS = ["Dominant strength", "High affinity", "Strong interest"];

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
const styleFor = (category: QuizCategorySummary) => CATEGORY_STYLES[category.name.toLowerCase()] ?? FALLBACK_STYLE;

const letterOf = (category: QuizCategorySummary) => category.name.charAt(0).toUpperCase();

const ScoreBar = ({ score, colour }: { score: number; colour: string }) => (
  <span className={appUi.quizBarTrack} aria-hidden="true">
    <span className={appUi.quizBar} style={{ width: `${Math.round(score * 100)}%`, background: colour }} />
  </span>
);

/** Shows initial results first, then (optionally) the personalised result after fine-tuning. */
export const QuizResultPage = ({ result, onViewCourses, onPersonalise, onRetake, onHome, onBackToDegree }: Props) => {
  const personalised = result.stage === "personalised";
  const top = result.rankedCategories.slice(0, TOP_DESCRIBED);
  const others = result.rankedCategories.slice(TOP_DESCRIBED);

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Home", onClick: onHome }, { label: "Quiz Result" }]} />
      <section className={appUi.pageIntroCompact}>
        <p className={appUi.eyebrow}>{personalised ? "Your personalised result" : "Your initial result"}</p>
        <h2 className="text-black">Your Holland Code Profile is</h2>
        {top.length > 0 && (
          <p className={appUi.quizHollandCode} aria-label={`Holland Code ${top.map(letterOf).join(", ")}`}>
            {top.map(letterOf).join(" – ")}
          </p>
        )}
        <p className={appUi.quizHollandNames}>
          {top.length > 0 ? top.map((category) => category.name).join(" • ") : result.primaryInterest}
        </p>
        <p className={appUi.landingNote}>{result.summary}</p>
      </section>

      <section className={appUi.quizResultSection}>
        <div className={appUi.quizBreakdown}>
          <h2>Top {top.length} dimensions breakdown</h2>
          <ol className={appUi.quizTopList} aria-label="Your top interest areas">
            {top.map((category, index) => {
              const { colour, tint, icon: categoryIcon } = styleFor(category);
              return (
                <li className={appUi.quizTopCard} key={category.id}>
                  <div className={appUi.quizTopCardHeader}>
                    <span className={appUi.quizTopIcon} style={{ color: colour, background: tint, borderColor: `${colour}33` }}>
                      {categoryIcon}
                    </span>
                    {category.score !== null && (
                      <span className={appUi.quizTopPercent} style={{ color: colour }}>{formatScorePercent(category.score)}</span>
                    )}
                  </div>
                  <h3 className={appUi.quizTopName}>
                    <span className={appUi.srOnly}>#{index + 1} </span>{category.name} ({letterOf(category)})
                  </h3>
                  <p className={appUi.quizTopTag} style={{ color: colour }}>{TOP_TAGS[index]}</p>
                  {category.description && <p className={appUi.quizTopDescription}>{category.description}</p>}
                  {category.score !== null && <ScoreBar score={category.score} colour={colour} />}
                </li>
              );
            })}
          </ol>

          {others.length > 0 && (
            <>
              <h3 className={appUi.quizOtherHeading}>Your other interest areas</h3>
              <ol className={appUi.quizOtherList} start={TOP_DESCRIBED + 1} aria-label="Your other interest areas">
                {others.map((category, index) => {
                  const { colour } = styleFor(category);
                  return (
                    <li className={appUi.quizOtherRow} key={category.id}>
                      <span className={appUi.quizOtherName}>{TOP_DESCRIBED + index + 1}. {category.name}</span>
                      {category.score !== null ? (
                        <>
                          <span className={appUi.quizOtherBar}><ScoreBar score={category.score} colour={colour} /></span>
                          <span className={appUi.quizOtherPercent}>{formatScorePercent(category.score)}</span>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        {personalised && result.suggestedMajor && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Suggested major or stream</p>
            <h2>{result.suggestedMajor.name}</h2>
            <p className={appUi.muted}>
              {result.suggestedMajor.code} · {result.suggestedMajor.type}
              {result.suggestedMajorDegree &&
                ` · within ${result.suggestedMajorDegree.name} (${result.suggestedMajorDegree.universityCode})`}
            </p>
          </div>
        )}

        {!personalised && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Want a more precise match?</p>
            <p>
              These results are based on your general answers. Answer 25 more questions about your specific
              interests to refine them and find the best major or stream within your matched courses. You can view
              course recommendations now and come back to this whenever you like.
            </p>
            <div>
              <button className={appUi.backButton} type="button" onClick={onPersonalise}>
                Personalise further
              </button>
            </div>
          </div>
        )}

        <div className={appUi.buttonContainer}>
          <button className={appUi.backButton} type="button" onClick={onRetake}>
            Retake quiz
          </button>
          <button className={appUi.primaryButton} type="button" onClick={onViewCourses}>
            View course recommendations <span aria-hidden="true">→</span>
          </button>
        </div>
        {onBackToDegree && (
          <div>
            <button className={appUi.textButton} type="button" onClick={onBackToDegree}>
              ← Back to degree
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
